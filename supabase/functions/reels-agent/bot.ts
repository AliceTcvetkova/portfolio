import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? Deno.env.get("LLM_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";
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
};

type Knowledge = {
  system_prompt: string;
  knowledge_text: string;
};

let knowledgeCache: { data: Knowledge; at: number } | null = null;

const OUTPUT_LANGUAGE = Deno.env.get("OUTPUT_LANGUAGE") ?? "en";

const WELCOME = `Hi! I'm <b>Reels Agent</b> for @sashaiamdrawing 🎬

Level 33 · life as an open-world game.

<b>Commands:</b>
/today — today's quests
/storyboard — storyboard + shoot/edit skill
/add — add tasks and regenerate
/rewrite — revise the storyboard
/status — current quests`;

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

function pickVideoLearning(quests: string[], session: Session, advance = true) {
  let shoot_i = session.skill_shoot_index % SHOOT_SKILLS.length;
  let edit_i = session.skill_edit_index % EDIT_SKILLS.length;
  const bonus = questBonus(quests);
  if (bonus.shoot) shoot_i = bonus.shoot;
  if (bonus.edit) edit_i = bonus.edit;
  const shoot = SHOOT_SKILLS[shoot_i];
  const edit = EDIT_SKILLS[edit_i];
  if (advance) {
    session.skill_shoot_index = shoot_i + 1;
    session.skill_edit_index = edit_i + 1;
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
    after_reel: `Did «${shoot.title}» + «${edit.title}» work? yes / retry`,
    next_shoot: SHOOT_SKILLS[(shoot_i + 1) % SHOOT_SKILLS.length].title,
    next_edit: EDIT_SKILLS[(edit_i + 1) % EDIT_SKILLS.length].title,
  };
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

  const video_learning = pickVideoLearning(quests, session, true);
  if (scenes[0]) scenes[0].learn_note = `📚 Shoot: ${video_learning.focus_shoot_tip}`;
  if (scenes[1]) scenes[1].learn_note = `📚 Edit: ${video_learning.focus_edit_tip}`;

  return {
    total_seconds: 35, player_level: 33, daily_goal_xp: xp_goal,
    projected_xp: resources_gained.length * 15,
    resources_gained, fog_tease: "Mug 🔒 — unlocks after I land a job",
    agent_notes: "Song cover: needs 150 Inspiration + 200 Experience + 200 Energy → +50 Reputation.",
    video_learning, publish: buildPublishPack(quests, "Mug 🔒 — unlocks after I land a job"),
    scenes, _mode: "template",
  };
}

async function generateStoryboard(session: Session) {
  const { quests, xp_goal, revision_notes, last_storyboard } = session;
  if (!quests.length) throw new Error("Empty quests");

  if (!GROQ_API_KEY) return buildTemplateStoryboard(quests, xp_goal, session);

  try {
    const kb = await loadKnowledge();
    let userMsg = `Knowledge base:\n${kb.knowledge_text}\n\n---\nToday's quests:\n${quests.map((q) => `- ${q}`).join("\n")}\nSession focus: ${xp_goal}\nOutput language for on_screen_text and my_thought: ${OUTPUT_LANGUAGE}\n`;
    if (revision_notes) userMsg += `\nUser revision:\n${revision_notes}\n`;
    if (last_storyboard?.scenes) {
      userMsg += `\nPrevious scenes: ${JSON.stringify((last_storyboard.scenes as unknown[]).slice(0, 4))}\n`;
    }
    userMsg += `\nReturn JSON: total_seconds, player_level, resources_gained[], fog_tease, scenes[] (each scene MUST include my_thought), agent_notes, video_learning{focus_shoot, focus_shoot_tip, focus_edit, focus_edit_tip, practice[], after_reel}, publish{hook_pick, hook_alternatives[], cover_suggestion, caption_first_line, caption, hashtags[], hashtag_note, bonus_tips[]} — video assignments only, NO course or platform names. publish required per publish_marketing.md.`;

    const raw = await chatGroq(kb.system_prompt, userMsg);
    const data = extractJson(raw) as Record<string, unknown>;
    data._mode = "llm";
    data.video_learning = pickVideoLearning(quests, session, true);
    if (!data.publish) {
      data.publish = buildPublishPack(quests, String(data.fog_tease ?? ""));
    }
    if (!data.scenes) throw new Error("No scenes");
    return data;
  } catch (e) {
    console.error("LLM fallback:", e);
    const fb = buildTemplateStoryboard(quests, xp_goal, session);
    fb._mode = "fallback";
    fb._llm_error = String(e).slice(0, 150);
    return fb;
  }
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

function formatStoryboard(data: Record<string, unknown>): string {
  const lines: string[] = [
    `🎬 <b>Reels · Level ${data.player_level ?? 33} · game session</b>`,
    `⏱ ${data.total_seconds ?? 35} sec`,
    "",
  ];
  if (data._mode === "llm") lines.push("🤖 <i>AI · Groq (Supabase)</i>", "");

  const vl = data.video_learning as Record<string, unknown> | undefined;
  if (vl) {
    lines.push(
      "📚 <b>Practice on this Reels</b>",
      `<b>Shoot:</b> ${vl.focus_shoot}`,
      `   ${vl.focus_shoot_tip}`,
      `<b>Edit:</b> ${vl.focus_edit}`,
      `   ${vl.focus_edit_tip}`,
    );
    for (const p of (vl.practice as string[]) ?? []) lines.push(`• ${p}`);
    if (vl.after_reel) lines.push(`✅ ${vl.after_reel}`);
    lines.push("");
  }

  const gained = (data.resources_gained as Record<string, string>[]) ?? [];
  if (gained.length) {
    lines.push("<b>Session resources:</b>");
    for (const r of gained) {
      lines.push(`• ${r.amount} ${r.resource} ← ${r.from_quest}`);
    }
    lines.push("");
  }
  if (data.fog_tease) lines.push(`🌫 <b>Fog of war:</b> ${data.fog_tease}`, "");

  const pub = data.publish as Record<string, unknown> | undefined;
  if (pub) {
    lines.push("📣 <b>Hook & publish</b>");
    if (pub.hook_pick) lines.push(`<b>Hook:</b> ${pub.hook_pick}`);
    for (const alt of (pub.hook_alternatives as string[]) ?? []) lines.push(`   ↳ ${alt}`);
    if (pub.cover_suggestion) lines.push(`<b>Cover:</b> ${pub.cover_suggestion}`);
    if (pub.caption_first_line) lines.push(`<b>Caption line 1:</b> «${pub.caption_first_line}»`);
    if (pub.caption) lines.push(`<b>Caption:</b>\n${pub.caption}`);
    const tags = (pub.hashtags as string[]) ?? [];
    if (tags.length) lines.push(`<b>Hashtags:</b> ${tags.join(" ")}`);
    if (pub.hashtag_note) lines.push(`   <i>${pub.hashtag_note}</i>`);
    for (const tip of (pub.bonus_tips as string[]) ?? []) lines.push(`💡 ${tip}`);
    lines.push("");
  }

  lines.push("<b>Storyboard</b>");
  for (const [i, scene] of ((data.scenes as Record<string, string>[]) ?? []).entries()) {
    lines.push(`<b>${i + 1}. ${scene.timecode}</b> — ${scene.label}`);
    if (scene.on_screen_text) lines.push(`   📱 «${scene.on_screen_text}»`);
    if (scene.my_thought) lines.push(`   🎙 «${scene.my_thought}»`);
    if (scene.shot_description) lines.push(`   🎥 ${scene.shot_description}`);
    if (scene.edit_note) lines.push(`   ✂️ ${scene.edit_note}`);
    if (scene.learn_note) lines.push(`   ${scene.learn_note}`);
    if (scene.resource_awarded) lines.push(`   ⭐ ${scene.resource_awarded}`);
    if (scene.sticker_suggestion) lines.push(`   🏷 ${scene.sticker_suggestion}`);
    lines.push("");
  }
  if (data.agent_notes) lines.push(`💡 ${data.agent_notes}`);
  if (data._mode === "fallback") {
    lines.push("", "<i>⚠️ AI unavailable — simplified storyboard. Try /storyboard in a minute.</i>");
  }
  return lines.join("\n").trim();
}

async function sendMessage(chatId: number, text: string) {
  for (const chunk of splitMessage(text)) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
    });
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
    };
  }
  return {
    chat_id: chatId, quests: [], xp_goal: 100, revision_notes: "",
    last_storyboard: null, skill_shoot_index: 0, skill_edit_index: 0,
    awaiting_today: false, awaiting_add: false,
  };
}

async function saveSession(supabase: SupabaseClient, session: Session) {
  await supabase.from("reels_agent_sessions").upsert({
    chat_id: session.chat_id,
    quests: session.quests,
    xp_goal: session.xp_goal,
    revision_notes: session.revision_notes,
    last_storyboard: session.last_storyboard,
    skill_shoot_index: session.skill_shoot_index,
    skill_edit_index: session.skill_edit_index,
    awaiting_today: session.awaiting_today,
    awaiting_add: session.awaiting_add,
    updated_at: new Date().toISOString(),
  });
}

async function runStoryboard(chatId: number, session: Session, supabase: SupabaseClient) {
  await sendMessage(chatId, "⏳ Generating storyboard…");
  const data = await generateStoryboard(session);
  session.last_storyboard = data;
  session.revision_notes = "";
  await saveSession(supabase, session);
  await sendMessage(chatId, formatStoryboard(data));
  await sendMessage(chatId, "✏️ /add — add tasks · /rewrite — revise");
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
    await sendMessage(chatId, `<b>Quests:</b>\n${list}\n\nFocus: ${session.xp_goal}`);
    return;
  }

  if (text.startsWith("/storyboard")) {
    if (!session.quests.length) {
      await sendMessage(chatId, "Send /today first");
      return;
    }
    await runStoryboard(chatId, session, supabase);
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

  if (session.awaiting_add) {
    session.quests.push(...parseQuestLines(text));
    session.awaiting_add = false;
    await saveSession(supabase, session);
    await runStoryboard(chatId, session, supabase);
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
