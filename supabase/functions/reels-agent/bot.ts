import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type ContentBrief,
  briefFromQuests,
  isAwaitingReelInput,
  parseReelCommand,
} from "./content_brief.ts";
import {
  type PlayerProgress,
  executeLog,
  formatProgressSummary,
  goalPercent,
  mergeProgress,
  parseLogCommand,
  progressContextForLlm,
  syncPublicProgress,
} from "./player_progress.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? Deno.env.get("LLM_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b";
const KNOWLEDGE_URL =
  Deno.env.get("REELS_KNOWLEDGE_URL") ??
  "https://alicetcvetkova.github.io/portfolio/data/reels-agent-knowledge.json";
const ALLOWED = (Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
};

type Session = {
  chat_id: number;
  quests: string[];
  xp_goal: number;
  revision_notes: string;
  last_storyboard: Record<string, unknown> | null;
  skill_shoot_index: number;
  skill_edit_index: number;
  awaiting_today: boolean;
  awaiting_add: boolean;
  player_progress: PlayerProgress;
  content_brief: Record<string, unknown> | null;
};

type Knowledge = {
  system_prompt: string;
  knowledge_text: string;
};

let knowledgeCache: { data: Knowledge; at: number } | null = null;

const OUTPUT_LANGUAGE = Deno.env.get("OUTPUT_LANGUAGE") ?? "en";

const WELCOME = `Hi! I'm <b>Reels Agent</b> for @sashaiamdrawing 🎬

Three content lines · one universe: 🎮 Life as a Game · 🎨 Why I Create · 🍵 Little Things

<b>Commands:</b>
/reel [type] [duration] [mood] + input → <b>3 variants</b>
/storyboard — diary mode (/today quests)
/today · /add · /rewrite · /done · /retry · /status · /progress · /log

<b>Types:</b> diary · talking · detail · hybrid · surprise

<b>Example:</b>
/reel talking 30 vulnerable
Why do I gamify my life?

/reel
Bought new brushes — nowhere to store them`;

const RESOURCE_RULES: [string[], string, string, string, "gain" | "spend"][] = [
  [["кино", "фильм", "семей", "movie", "cinema"], "Inspiration", "+15", "gem-shimmer.gif", "gain"],
  [["отклик", "вакан", "job", "resume", "резюме"], "Experience", "+15", "sticker_work.png", "gain"],
  [["собес", "interview"], "Experience", "+30", "sticker_work.png", "gain"],
  [["игр", "прототип", "gamedev", "game dev"], "Experience", "−25", "sticker_new_experience_gained.png", "spend"],
  [["рис", "draw", "sketch", "paint"], "Inspiration", "−20", "sticker_materials.png", "spend"],
  [["рукод", "craft", "handmade"], "Inspiration", "−15", "sticker_materials.png", "spend"],
  [["убор", "быт", "дом", "clean"], "Energy", "−10", "sticker_energy.png", "spend"],
  [["полить", "растен", "цвет", "plant", "water"], "Energy", "−8", "sticker_plants.png", "spend"],
  [["живот", "кот", "собак", "pet", "cat", "dog"], "Energy", "−10", "sticker_dog.png", "spend"],
  [["облож", "cover", "песн", "song"], "Inspiration", "−20", "sticker_reputation.png", "spend"],
  [["публик", "reels", "post"], "Reputation", "+25", "sticker_reputation.png", "gain"],
];

const SHOOT_SKILLS = [
  { title: "Phone + tripod", tip: "iPhone 15 Pro on tripod; lock orientation." },
  { title: "Framing", tip: "Rule of thirds — subject on a third line." },
  { title: "Wide / medium / close", tip: "Wide → medium → close on one quest." },
  { title: "Filming a person", tip: "Medium shot, window light." },
  { title: "Self-filming", tip: "Tripod + headroom for 9:16 crop." },
  { title: "B-roll", tip: "5–10 sec details: hands, texture." },
  { title: "Camera movement", tip: "Slow pan on tripod." },
  { title: "Window light", tip: "Subject at 45° to window." },
  { title: "Artificial light", tip: "Fill light opposite the window." },
  { title: "Sound + headset mic", tip: "10 sec VO in a quiet room." },
  { title: "Exposure / WB", tip: "Lock exposure on paper/face." },
  { title: "Stability", tip: "30fps + tripod, slow moves." },
];

const EDIT_SKILLS = [
  { title: "Organize footage", tip: "iMovie: lay out by storyboard scene before cutting." },
  { title: "Pick takes", tip: "2–3 takes per scene." },
  { title: "Pacing + cuts", tip: "Cut every 2–3 sec." },
  { title: "Rhythm", tip: "Fast hook → slower recap." },
  { title: "J-cut / L-cut", tip: "Audio from next scene before the cut." },
  { title: "B-roll over A-roll", tip: "Resource pop overlay." },
  { title: "Music + SFX", tip: "SFX in iMovie; music in Instagram." },
  { title: "On-screen text", tip: "Max 6 words, ≥1.5 sec on screen." },
  { title: "Color correction", tip: "Warmth + contrast in iMovie." },
  { title: "Color grading", tip: "One cozy preset for the whole Reel." },
  { title: "Voice track", tip: "VO lane, trim pauses." },
  { title: "Export 9:16", tip: "1080×1920, text safe zone." },
];

function parseQuestLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.trim().split("\n")) {
    let line = raw.trim();
    if (!line) continue;
    for (const p of ["✔", "✓", "☑", "-", "•", "*"]) {
      if (line.startsWith(p)) {
        line = line.slice(p.length).trim();
        break;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function guessResource(quest: string) {
  const lower = quest.toLowerCase();
  for (const [keys, resource, amount, sticker, flow] of RESOURCE_RULES) {
    if (keys.some((k) => lower.includes(k))) {
      return { resource, amount, sticker, flow };
    }
  }
  return { resource: "Energy", amount: "−5", sticker: "sticker_energy.png", flow: "spend" as const };
}

function questBonus(quests: string[]) {
  const t = quests.join(" ").toLowerCase();
  let shoot = 0, edit = 0;
  if (/рис|draw|sketch/.test(t)) { shoot = 7; edit = 5; }
  if (/кино|фильм|семей/.test(t)) { shoot = 4; edit = 3; }
  if (/игр|прототип/.test(t)) { shoot = 10; edit = 4; }
  if (/полить|цвет|живот|быт|убор/.test(t)) { shoot = 5; edit = 5; }
  return { shoot, edit };
}

function pickVideoLearning(quests: string[], session: Session, advance = false, applyBonus = true) {
  let shoot_i = session.skill_shoot_index % SHOOT_SKILLS.length;
  let edit_i = session.skill_edit_index % EDIT_SKILLS.length;
  if (applyBonus) {
    const bonus = questBonus(quests);
    if (bonus.shoot) shoot_i = bonus.shoot;
    if (bonus.edit) edit_i = bonus.edit;
  }
  const shoot = SHOOT_SKILLS[shoot_i];
  const edit = EDIT_SKILLS[edit_i];
  if (advance) {
    session.skill_shoot_index += 1;
    session.skill_edit_index += 1;
  }
  return {
    focus_shoot: shoot.title,
    focus_shoot_tip: shoot.tip,
    focus_edit: edit.title,
    focus_edit_tip: edit.tip,
    practice: [
      `Shoot: ${shoot.tip}`,
      `Edit: ${edit.tip}`,
      quests[0] ? `Apply in scenes with: «${quests[0].slice(0, 40)}»` : "",
    ].filter(Boolean),
    after_reel:
      `Done with «${shoot.title}» + «${edit.title}»? Reply <b>done</b> or /done for next · /retry to repeat`,
    next_shoot: SHOOT_SKILLS[(session.skill_shoot_index + 1) % SHOOT_SKILLS.length].title,
    next_edit: EDIT_SKILLS[(session.skill_edit_index + 1) % EDIT_SKILLS.length].title,
  };
}

function completeVideoLearning(quests: string[], session: Session) {
  const prev = session.last_storyboard?.video_learning as Record<string, unknown> | undefined;
  const completed = {
    focus_shoot: String(prev?.focus_shoot ?? SHOOT_SKILLS[session.skill_shoot_index % SHOOT_SKILLS.length].title),
    focus_edit: String(prev?.focus_edit ?? EDIT_SKILLS[session.skill_edit_index % EDIT_SKILLS.length].title),
  };
  session.skill_shoot_index += 1;
  session.skill_edit_index += 1;
  const next = pickVideoLearning(quests, session, false, false);
  return { completed, next };
}

function parseSkillReply(text: string): "done" | "retry" | null {
  const raw = text.trim();
  const lower = raw.toLowerCase().replace(/[!.…]+$/g, "");
  if (lower.startsWith("/done")) return "done";
  if (lower.startsWith("/retry")) return "retry";
  if (raw.length > 60) return null;
  const retry = ["retry", "again", "repeat", "no", "нет", "ещё раз", "еще раз", "повтор", "заново"];
  if (retry.includes(lower)) return "retry";
  const done = ["done", "yes", "y", "ok", "okay", "готово", "да", "сделала", "сделано", "выполнила", "next", "новое"];
  if (done.includes(lower)) return "done";
  return null;
}

function formatVideoLearningBlock(vl: Record<string, unknown>): string {
  const lines = [
    "📚 <b>Practice on this Reels</b>",
    `<b>Shoot:</b> ${vl.focus_shoot}`,
    `   ${vl.focus_shoot_tip}`,
    `<b>Edit:</b> ${vl.focus_edit}`,
    `   ${vl.focus_edit_tip}`,
  ];
  for (const p of (vl.practice as string[]) ?? []) lines.push(`• ${p}`);
  if (vl.after_reel) lines.push(`✅ ${vl.after_reel}`);
  return lines.join("\n");
}

function formatSkillComplete(completed: Record<string, string>, next: Record<string, unknown>): string {
  return [
    "✅ <b>Practice logged</b>",
    `Completed: ${completed.focus_shoot} + ${completed.focus_edit}`,
    "",
    "➡️ <b>Next assignment:</b>",
    formatVideoLearningBlock(next),
  ].join("\n");
}

function buildPublishPack(quests: string[], fogTease = "") {
  const n = quests.length;
  const hint = quests[0]?.slice(0, 35) ?? "today's session";
  const fog = fogTease || "Mug still locked until I find work";
  return {
    hook_pick:
      "Open on quest list or sketchbook snap + «Level 33 · session» — VO: Level 33 — playing my life again today.",
    hook_alternatives: [
      `Resource angle: tie hook to «${hint}» + first resource pop`,
      `List tease: «${n} quests → 1 Reels» + quick scroll through planner`,
    ],
    cover_suggestion: "Scene 1 — quest list or face + sketchbook, warm light, text readable small",
    caption_first_line: `Level 33 — I turned today's list into a game session (${n} quests).`,
    caption:
      `Level 33 — I turned today's list into a game session (${n} quests).\n\n` +
      "Real quests, real resources — gain and spend, not a generic productivity reel.\n" +
      `${fog}.\n\nSave if you gamify your creative week too.`,
    hashtags: [
      "#sashaiamdrawing", "#sashaiamdrawingreport", "#birdsinmyforest", "#level33",
      "#artprocess", "#sketchbook", "#cozyart", "#slowliving", "#illustrationprocess", "#gamifiedlife",
    ],
    hashtag_note: "3 branded + niche art/process + series tags — rotate 2–3 niche tags vs last post",
    bonus_tips: [
      "Pin a comment: one-line explainer of the 5 resources",
      "Caption first line must match on-screen hook in first 2 sec",
      "Ask which quest they'd pick first — genuine comment prompt",
      "Alt text: Level 33 game session quest list drawing process",
    ],
  };
}

async function loadKnowledge(): Promise<Knowledge> {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeCache.at < 5 * 60 * 1000) {
    return knowledgeCache.data;
  }
  const res = await fetch(KNOWLEDGE_URL);
  if (!res.ok) throw new Error(`Knowledge fetch failed: ${res.status}`);
  const data = (await res.json()) as Knowledge;
  knowledgeCache = { data, at: now };
  return data;
}

async function chatGroq(system: string, user: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

function extractJson(text: string): Record<string, unknown> {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : text.trim();
  return JSON.parse(raw);
}

function buildTemplateStoryboard(quests: string[], xp_goal: number, session: Session) {
  const resources_gained = quests.map((q) => {
    const { resource, amount, sticker, flow } = guessResource(q);
    return { resource, amount, from_quest: q, sticker, flow };
  });

  const scenes: Record<string, string>[] = [
    {
      timecode: "0–2 sec", label: "Hook",       on_screen_text: "Level 33 · session",
      my_thought: "Level 33 — playing my life again today.",
      shot_description: "Close-up of sketchbook or quest list",
      edit_note: "iMovie: hard cut · 1.5 sec VO", resource_awarded: "", sticker_suggestion: "quest-shimmer.gif",
      learn_note: "",
    },
    {
      timecode: "2–6 sec", label: "Quest list",       on_screen_text: `${quests.length} quests`,
      my_thought: "Not a todo list — quests for one session.",
      shot_description: "Scroll through today's list", edit_note: "Max 6 words · 2 sec VO", resource_awarded: "",
      sticker_suggestion: "", learn_note: "",
    },
  ];

  const blocks = [[6, 11], [11, 16], [16, 21], [21, 26]];
  quests.slice(0, 4).forEach((quest, i) => {
    const [start, end] = blocks[i] ?? [26, 30];
    const { resource, amount, sticker, flow } = guessResource(quest);
    const verb = flow === "gain" ? "gained" : "spent";
    const thought = `Quest "${quest.slice(0, 25)}" — ${verb} ${resource}.`;
    scenes.push({
      timecode: `${start}–${end} sec`, label: quest.slice(0, 30), on_screen_text: quest.slice(0, 40),
      my_thought: thought,
      shot_description: `B-roll: ${quest}`, edit_note: "Cut 2–3 sec · 1.5 sec VO",
      resource_awarded: `${amount} ${resource} (${verb})`, sticker_suggestion: sticker, learn_note: "",
    });
  });

  scenes.push({
    timecode: "28–35 sec", label: "Recap + fog", on_screen_text: "Mug 🔒 until job",
    my_thought: "Behind the fog — the mug unlocks when I find work.",
    shot_description: "Resource balance + fog tease", edit_note: "SFX + music · 2 sec VO outro",
    resource_awarded: "", sticker_suggestion: "sticker_new_quest_open.png", learn_note: "",
  });

  const video_learning = pickVideoLearning(quests, session, false);
  if (scenes[0]) scenes[0].learn_note = `📚 Shoot: ${video_learning.focus_shoot_tip}`;
  if (scenes[1]) scenes[1].learn_note = `📚 Edit: ${video_learning.focus_edit_tip}`;

  const pp = session.player_progress;
  const song = pp.goals.song_cover;
  const songPct = goalPercent(song);
  const fogTease = pp.unlocks.mug.locked
    ? `Mug 🔒 — ${pp.unlocks.mug.reason_ru ?? pp.unlocks.mug.reason}`
    : "Mug unlocked ☕";
  const songNote =
    `Song cover ${songPct}% — Insp ${song.invested.Inspiration ?? 0}/${song.targets.Inspiration}, ` +
    `Exp ${song.invested.Experience ?? 0}/${song.targets.Experience}, ` +
    `Energy ${song.invested.Energy ?? 0}/${song.targets.Energy}`;

  return {
    total_seconds: 35, player_level: 33, daily_goal_xp: xp_goal,
    projected_xp: resources_gained.length * 15,
    resources_gained, fog_tease: fogTease,
    agent_notes: `${songNote}. /log apply after filming to save totals.`,
    video_learning, publish: buildPublishPack(quests, fogTease),
    scenes, _mode: "template",
  };
}

async function generateReel(session: Session, brief: ContentBrief) {
  const { quests, xp_goal, revision_notes, last_storyboard } = session;
  const practiceLines = quests.length ? quests : brief.input_text.split("\n").filter(Boolean);

  if (!GROQ_API_KEY) {
    if (brief.content_type === "diary" && quests.length) {
      const fb = buildTemplateStoryboard(quests, xp_goal, session);
      return ensureVariants(fb, brief);
    }
    return buildTalkingFallback(brief, session);
  }

  try {
    const kb = await loadKnowledge();
    let userMsg = `Knowledge base:\n${kb.knowledge_text}\n\n---\nCONTENT BRIEF:\n`;
    userMsg += `- content_type: ${brief.content_type}\n- input: ${brief.input_text}\n`;
    userMsg += `- mood: ${brief.mood}\n- goal: ${brief.goal}\n- format: ${brief.format_pref}\n- duration: ${brief.duration} sec\n`;
    if (quests.length) userMsg += `\nSaved quests:\n${quests.map((q) => `- ${q}`).join("\n")}\n`;
    userMsg += `\n${progressContextForLlm(session.player_progress)}\n`;
    userMsg += `\nSession focus: ${xp_goal}\nOutput language: ${OUTPUT_LANGUAGE}\n`;
    if (revision_notes) userMsg += `\nUser revision:\n${revision_notes}\n`;
    if (last_storyboard?.variants) {
      const labels = (last_storyboard.variants as Record<string, string>[]).map((v) => v.label).slice(0, 3);
      userMsg += `\nPrevious variants: ${labels.join(", ")}\n`;
    }
    userMsg += `\nReturn JSON per system prompt: content_type, pillar, detected_story, variants[3] (id, label, tone, mechanic, hook, scenes[], publish), bridge_suggestion, agent_notes. Each variant MUST have at least 3 scenes. Diary: resources_gained[], fog_tease. Do NOT return empty variants[]. JSON only.`;

    const raw = await chatGroq(kb.system_prompt, userMsg);
    const data = extractJson(raw) as Record<string, unknown>;
    data._mode = "llm";
    data.video_learning = pickVideoLearning(practiceLines, session, false);
    const out = ensureVariants(data, brief);
    if (!hasValidVariants(out)) throw new Error("No variants with scenes");
    return out;
  } catch (e) {
    console.error("LLM fallback:", e);
    if (brief.content_type === "diary" && quests.length) {
      const fb = buildTemplateStoryboard(quests, xp_goal, session);
      fb._mode = "fallback";
      fb._llm_error = String(e).slice(0, 150);
      return ensureVariants(fb, brief);
    }
    const fb = buildTalkingFallback(brief, session);
    fb._llm_error = String(e).slice(0, 150);
    return fb;
  }
}

function hasValidVariants(data: Record<string, unknown>): boolean {
  const variants = data.variants as Record<string, unknown>[] | undefined;
  if (!Array.isArray(variants) || !variants.length) return false;
  return variants.some((v) => Array.isArray(v.scenes) && (v.scenes as unknown[]).length > 0);
}

function buildTalkingFallback(brief: ContentBrief, session: Session) {
  const input = brief.input_text.trim();
  const pillar = brief.content_type === "detail" ? "little_things"
    : brief.content_type === "diary" ? "life_as_game" : "why_i_create";

  const makeVariant = (
    id: string,
    label: string,
    tone: string,
    mechanic: string,
    hook: string,
    thought: string,
  ) => ({
    id,
    label,
    tone,
    mechanic,
    hook,
    total_seconds: brief.duration,
    scenes: [
      {
        timecode: "0–2 sec",
        label: "Hook",
        on_screen_text: hook.slice(0, 40),
        my_thought: hook,
        shot_description: "Face or hands, window light, 9:16",
        edit_note: "Hard cut · 1.5 sec VO",
      },
      {
        timecode: "2–22 sec",
        label: "Story",
        on_screen_text: mechanic.replace(/_/g, " ").slice(0, 24),
        my_thought: thought,
        shot_description: "Talking head or VO over cozy B-roll",
        edit_note: "Cut every 2–3 sec",
      },
      {
        timecode: "22–30 sec",
        label: "Close",
        on_screen_text: "Level 33",
        my_thought: "Still figuring it out — and that's okay.",
        shot_description: "Sketchbook / detail shot",
        edit_note: "Soft outro VO",
      },
    ],
    publish: {
      hook_pick: hook,
      caption_first_line: thought.slice(0, 120),
      hashtags: ["#sashaiamdrawing", "#sashaiamdrawingreport", "#level33"],
    },
  });

  return {
    content_type: brief.content_type,
    pillar,
    detected_story: input.slice(0, 160),
    duration: brief.duration,
    mood: brief.mood,
    variants: [
      makeVariant("variant_a", "Personal story", brief.mood, "personal_story", input, input),
      makeVariant("variant_b", "Provocative", brief.mood, "hot_take", `Honest take: ${input}`, `Hot take: ${input}`),
      makeVariant("variant_c", "Calm reflection", "thoughtful", "quiet_reflection", input.split(".")[0] || input, `Quiet thought: ${input}`),
    ],
    bridge_suggestion: "Next: tie this to a small daily quest (Life as a Game) or a detail shot (Little Things).",
    video_learning: pickVideoLearning([input], session, false),
    agent_notes: "Template fallback — AI returned empty variants or was unavailable. Send /reel again for full Groq output.",
    _mode: "fallback",
  };
}

async function generateStoryboard(session: Session) {
  const brief = briefFromQuests(session.quests, session.xp_goal);
  return generateReel(session, brief);
}

function ensureVariants(data: Record<string, unknown>, brief: ContentBrief) {
  if (hasValidVariants(data)) return data;
  const scenes = (data.scenes as Record<string, string>[]) ?? [];
  const publish = (data.publish as Record<string, unknown>) ?? {};
  data.variants = [{
    id: "variant_a",
    label: "Game session",
    tone: brief.mood,
    mechanic: "session_recap",
    hook: scenes[0]?.on_screen_text ?? "",
    total_seconds: data.total_seconds ?? brief.duration,
    scenes,
    publish,
  }];
  data.content_type ??= brief.content_type;
  data.pillar ??= "life_as_game";
  data.detected_story ??= brief.input_text.slice(0, 160);
  data.duration ??= brief.duration;
  return data;
}

function splitMessage(text: string, limit = 4096): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let at = rest.lastIndexOf("\n\n", limit);
    if (at < limit / 2) at = limit;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatStoryboard(data: Record<string, unknown>): string {
  const PILLAR: Record<string, string> = {
    life_as_game: "🎮 Life as a Game",
    why_i_create: "🎨 Why I Create",
    little_things: "🍵 Little Things",
  };
  const ctype = String(data.content_type ?? "diary");
  const pillar = PILLAR[String(data.pillar ?? "")] ?? String(data.pillar ?? "");
  const lines: string[] = [
    `🎬 <b>Reels · ${escapeHtml(ctype)} · ${escapeHtml(pillar)}</b>`,
    `⏱ ${data.duration ?? data.total_seconds ?? 30} sec`,
    "",
  ];
  if (data._mode === "llm") lines.push("🤖 <i>AI · Groq (Supabase)</i>", "");
  if (data._mode === "fallback") lines.push("⚠️ <i>Fallback template — retry /reel for full AI</i>", "");
  if (data.detected_story) lines.push(`📖 <b>Story:</b> ${escapeHtml(String(data.detected_story))}`, "");

  const gained = (data.resources_gained as Record<string, string>[]) ?? [];
  if (gained.length) {
    lines.push("<b>Session resources:</b>");
    for (const r of gained) lines.push(`• ${escapeHtml(String(r.amount))} ${escapeHtml(String(r.resource))} ← ${escapeHtml(String(r.from_quest))}`);
    lines.push("");
  }
  if (data.fog_tease) lines.push(`🌫 <b>Fog:</b> ${escapeHtml(String(data.fog_tease))}`, "");

  const variants = (data.variants as Record<string, unknown>[]) ?? [];
  if (variants.length) {
    variants.slice(0, 3).forEach((v, i) => {
      const letter = String.fromCharCode(65 + i);
      lines.push(`━━ <b>Variant ${letter}: ${escapeHtml(String(v.label ?? ""))}</b>`);
      lines.push(`<i>${escapeHtml(String(v.tone ?? ""))} · ${escapeHtml(String(v.mechanic ?? ""))}</i>`);
      if (v.hook) lines.push(`🪝 ${escapeHtml(String(v.hook))}`);
      const pub = v.publish as Record<string, unknown> | undefined;
      if (pub?.hook_pick) lines.push(`<b>Hook:</b> ${escapeHtml(String(pub.hook_pick))}`);
      if (pub?.caption_first_line) lines.push(`<b>Caption:</b> «${escapeHtml(String(pub.caption_first_line))}»`);
      for (const scene of (v.scenes as Record<string, string>[]) ?? []) {
        lines.push(`<b>${escapeHtml(String(scene.timecode ?? ""))}</b> — ${escapeHtml(String(scene.label ?? ""))}`);
        if (scene.on_screen_text) lines.push(`   📱 «${escapeHtml(String(scene.on_screen_text))}»`);
        if (scene.my_thought) lines.push(`   🎙 «${escapeHtml(String(scene.my_thought))}»`);
        if (scene.shot_description) lines.push(`   🎥 ${escapeHtml(String(scene.shot_description))}`);
      }
      lines.push("");
    });
  } else {
    lines.push("<b>Storyboard</b>");
    for (const scene of (data.scenes as Record<string, string>[]) ?? []) {
      lines.push(`<b>${escapeHtml(String(scene.timecode ?? ""))}</b> — ${escapeHtml(String(scene.label ?? ""))}`);
      if (scene.my_thought) lines.push(`   🎙 «${escapeHtml(String(scene.my_thought))}»`);
    }
    lines.push("");
  }

  if (data.bridge_suggestion) lines.push(`🌉 <b>Bridge:</b> ${escapeHtml(String(data.bridge_suggestion))}`, "");

  const vl = data.video_learning as Record<string, unknown> | undefined;
  if (vl) {
    lines.push(
      "📚 <b>Practice on this Reels</b>",
      `<b>Shoot:</b> ${escapeHtml(String(vl.focus_shoot ?? ""))}`,
      `   ${escapeHtml(String(vl.focus_shoot_tip ?? ""))}`,
      `<b>Edit:</b> ${escapeHtml(String(vl.focus_edit ?? ""))}`,
      `   ${escapeHtml(String(vl.focus_edit_tip ?? ""))}`,
    );
    for (const p of (vl.practice as string[]) ?? []) lines.push(`• ${escapeHtml(p)}`);
    if (vl.after_reel) lines.push(`✅ ${String(vl.after_reel)}`);
    lines.push("");
  }

  if (data.agent_notes) lines.push(`💡 ${escapeHtml(String(data.agent_notes))}`);
  lines.push("", "<i>Pick a variant · /done · /reel for new topic</i>");
  return lines.join("\n").trim();
}

async function sendMessage(chatId: number, text: string) {
  for (const chunk of splitMessage(text)) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!body.ok) {
      console.error("Telegram HTML send failed:", body);
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: chunk.replace(/<[^>]+>/g, "") }),
      });
    }
  }
}

async function loadSession(supabase: SupabaseClient, chatId: number): Promise<Session> {
  const { data } = await supabase
    .from("reels_agent_sessions")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (data) {
    return {
      chat_id: chatId,
      quests: (data.quests as string[]) ?? [],
      xp_goal: data.xp_goal ?? 100,
      revision_notes: data.revision_notes ?? "",
      last_storyboard: data.last_storyboard as Record<string, unknown> | null,
      skill_shoot_index: data.skill_shoot_index ?? 0,
      skill_edit_index: data.skill_edit_index ?? 0,
      awaiting_today: data.awaiting_today ?? false,
      awaiting_add: data.awaiting_add ?? false,
      player_progress: mergeProgress(data.player_progress),
      content_brief: (data.content_brief as Record<string, unknown> | null) ?? null,
    };
  }
  return {
    chat_id: chatId, quests: [], xp_goal: 100, revision_notes: "",
    last_storyboard: null, skill_shoot_index: 0, skill_edit_index: 0,
    awaiting_today: false, awaiting_add: false,
    player_progress: mergeProgress(null),
    content_brief: null,
  };
}

async function saveSession(supabase: SupabaseClient, session: Session) {
  const row: Record<string, unknown> = {
    chat_id: session.chat_id,
    quests: session.quests,
    xp_goal: session.xp_goal,
    revision_notes: session.revision_notes,
    last_storyboard: session.last_storyboard,
    skill_shoot_index: session.skill_shoot_index,
    skill_edit_index: session.skill_edit_index,
    awaiting_today: session.awaiting_today,
    awaiting_add: session.awaiting_add,
    player_progress: session.player_progress,
    content_brief: session.content_brief,
    updated_at: new Date().toISOString(),
  };
  let { error } = await supabase.from("reels_agent_sessions").upsert(row);
  if (error?.message?.includes("player_progress") || error?.message?.includes("content_brief")) {
    delete row.player_progress;
    delete row.content_brief;
    ({ error } = await supabase.from("reels_agent_sessions").upsert(row));
  }
  if (error) throw error;
  try {
    await syncPublicProgress(supabase, session.player_progress);
  } catch (e) {
    console.warn("syncPublicProgress:", e);
  }
}

async function runLog(chatId: number, session: Session, supabase: SupabaseClient, text: string) {
  const parsed = parseLogCommand(text);
  if (!parsed) {
    await sendMessage(chatId, "Usage: /log +15 experience");
    return;
  }
  const storyboardResources = (session.last_storyboard?.resources_gained as Record<string, unknown>[]) ?? [];
  const reply = executeLog(session.player_progress, parsed.action, parsed.payload, storyboardResources);
  await saveSession(supabase, session);
  await sendMessage(chatId, reply);
}

async function runReel(chatId: number, session: Session, brief: ContentBrief, supabase: SupabaseClient) {
  await sendMessage(chatId, "⏳ Reading input · generating 3 variants…");
  const data = await generateReel(session, brief);
  session.last_storyboard = data;
  session.revision_notes = "";
  session.content_brief = null;
  await sendMessage(chatId, formatStoryboard(data));
  try {
    await saveSession(supabase, session);
  } catch (e) {
    console.error("saveSession after reel:", e);
    await sendMessage(chatId, "<i>⚠️ Storyboard sent, but session save failed. Run phase9 SQL if /log fails.</i>");
  }
}

async function runStoryboard(chatId: number, session: Session, supabase: SupabaseClient) {
  if (!session.quests.length) {
    await sendMessage(chatId, "Send /today first");
    return;
  }
  await sendMessage(chatId, "⏳ Generating storyboard…");
  const data = await generateStoryboard(session);
  session.last_storyboard = data;
  session.revision_notes = "";
  await saveSession(supabase, session);
  await sendMessage(chatId, formatStoryboard(data));
  await sendMessage(chatId, "✏️ /add — add tasks · /rewrite — revise · /done — next practice");
}

async function runSkillDone(chatId: number, session: Session, supabase: SupabaseClient) {
  const ctx = session.quests.length
    ? session.quests
    : [String(session.last_storyboard?.detected_story ?? "practice")];
  if (!ctx[0]) {
    await sendMessage(chatId, "Send /today or /reel first");
    return;
  }
  const { completed, next } = completeVideoLearning(ctx, session);
  if (session.last_storyboard) session.last_storyboard.video_learning = next;
  await saveSession(supabase, session);
  await sendMessage(chatId, formatSkillComplete(completed, next));
}

async function runSkillRetry(chatId: number, session: Session, supabase: SupabaseClient) {
  const ctx = session.quests.length
    ? session.quests
    : [String(session.last_storyboard?.detected_story ?? "practice")];
  if (!ctx[0]) {
    await sendMessage(chatId, "Send /today or /reel first");
    return;
  }
  const next = pickVideoLearning(ctx, session, false);
  if (session.last_storyboard) session.last_storyboard.video_learning = next;
  await saveSession(supabase, session);
  await sendMessage(chatId, formatVideoLearningBlock(next));
}

export async function handleUpdate(update: TelegramUpdate, supabase: SupabaseClient) {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  if (ALLOWED.length && !ALLOWED.includes(String(chatId))) {
    console.warn("Unauthorized chat:", chatId);
    await sendMessage(
      chatId,
      `⛔ Owner access only.\n\nYour chat_id: <code>${chatId}</code>\nAdd it to Supabase → Secrets → <code>TELEGRAM_ALLOWED_CHAT_IDS</code> and send /start again.`,
    );
    return;
  }

  const text = msg.text.trim();
  const session = await loadSession(supabase, chatId);

  if (text.startsWith("/start") || text.startsWith("/help")) {
    await sendMessage(chatId, WELCOME);
    return;
  }

  if (text.startsWith("/today")) {
    const rest = text.replace(/^\/today\s*/, "").trim();
    if (rest) {
      session.quests = parseQuestLines(rest);
      session.awaiting_today = false;
      session.last_storyboard = null;
      await saveSession(supabase, session);
      await sendMessage(chatId, `✅ ${session.quests.length} quests.\n/storyboard — generate plan.`);
      return;
    }
    session.awaiting_today = true;
    await saveSession(supabase, session);
    await sendMessage(chatId, "Send your quest list — one per line ✔");
    return;
  }

  if (text.startsWith("/goal")) {
    const n = parseInt(text.split(/\s+/)[1] ?? "", 10);
    if (!n) {
      await sendMessage(chatId, `Focus: ${session.xp_goal}. /goal 100`);
      return;
    }
    session.xp_goal = n;
    await saveSession(supabase, session);
    await sendMessage(chatId, `🎯 Focus: <b>${n}</b>`);
    return;
  }

  if (text.startsWith("/status")) {
    const list = session.quests.map((q) => `• ${q}`).join("\n") || "(empty)";
    const hasSb = session.last_storyboard ? "yes" : "no";
    await sendMessage(
      chatId,
      `<b>Quests:</b>\n${list}\n\nFocus: ${session.xp_goal} · Storyboard: ${hasSb}\n\n${formatProgressSummary(session.player_progress)}`,
    );
    return;
  }

  if (text.startsWith("/progress")) {
    await sendMessage(chatId, formatProgressSummary(session.player_progress));
    return;
  }

  if (text.startsWith("/log") || parseLogCommand(text)) {
    await runLog(chatId, session, supabase, text);
    return;
  }

  if (text.startsWith("/storyboard")) {
    await runStoryboard(chatId, session, supabase);
    return;
  }

  if (text.startsWith("/reel")) {
    const brief = parseReelCommand(text);
    if (!brief.input_text.trim()) {
      session.content_brief = { ...brief, _awaiting: true, input_text: "" };
      await saveSession(supabase, session);
      await sendMessage(
        chatId,
        "📝 Send your topic in the <b>next message</b> (or one line after /reel).\n\n"
        + "Example:\n/reel talking 30 thoughtful\nWhy do I draw?",
      );
      return;
    }
    await runReel(chatId, session, brief, supabase);
    return;
  }

  if (text.startsWith("/add")) {
    const rest = text.replace(/^\/add\s*/, "").trim();
    if (!rest) {
      session.awaiting_add = true;
      await saveSession(supabase, session);
      await sendMessage(chatId, "Send tasks to add.");
      return;
    }
    session.quests.push(...parseQuestLines(rest));
    await saveSession(supabase, session);
    await sendMessage(chatId, `➕ Added. Total ${session.quests.length}. Regenerating…`);
    await runStoryboard(chatId, session, supabase);
    return;
  }

  if (text.startsWith("/rewrite")) {
    if (!session.quests.length) {
      await sendMessage(chatId, "Send /today first");
      return;
    }
    session.revision_notes = text.replace(/^\/rewrite\s*/, "").trim();
    await runStoryboard(chatId, session, supabase);
    return;
  }

  if (text.startsWith("/done")) {
    await runSkillDone(chatId, session, supabase);
    return;
  }

  if (text.startsWith("/retry")) {
    await runSkillRetry(chatId, session, supabase);
    return;
  }

  const skillReply = parseSkillReply(text);
  if (skillReply === "done") {
    await runSkillDone(chatId, session, supabase);
    return;
  }
  if (skillReply === "retry") {
    await runSkillRetry(chatId, session, supabase);
    return;
  }

  if (session.awaiting_add) {
    session.quests.push(...parseQuestLines(text));
    session.awaiting_add = false;
    await saveSession(supabase, session);
    await runStoryboard(chatId, session, supabase);
    return;
  }

  if (isAwaitingReelInput(session.content_brief)) {
    const pending = session.content_brief;
    const brief: ContentBrief = {
      content_type: String(pending.content_type ?? "surprise"),
      input_text: text,
      mood: String(pending.mood ?? "cozy"),
      goal: String(pending.goal ?? "tell a story"),
      format_pref: String(pending.format_pref ?? "mixed"),
      duration: Number(pending.duration ?? 30),
    };
    session.content_brief = null;
    await runReel(chatId, session, brief, supabase);
    return;
  }

  if (session.awaiting_today) {
    session.quests = parseQuestLines(text);
    session.awaiting_today = false;
    session.last_storyboard = null;
    await saveSession(supabase, session);
    await sendMessage(chatId, `✅ ${session.quests.length} quests.\n/storyboard`);
  }
}
