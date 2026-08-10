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

const WELCOME = `Привет! Я <b>Reels Agent</b> для @sashaiamdrawing 🎬

Level 33 · жизнь как open-world игра.

<b>Команды:</b>
/today — квесты на сегодня
/storyboard — сценарий + обучение съёмке/монтажу
/add — добавить дела и переписать
/rewrite — переписать сценарий
/status — текущие квесты`;

const RESOURCE_RULES: [string[], string, string, string, "gain" | "spend"][] = [
  [["кино", "фильм", "семей", "movie"], "Вдохновение", "+15", "gem-shimmer.gif", "gain"],
  [["отклик", "вакан", "поиск работ", "резюме"], "Опыт", "+15", "sticker_work.png", "gain"],
  [["собес", "interview"], "Опыт", "+30", "sticker_work.png", "gain"],
  [["игр", "прототип", "gamedev"], "Опыт", "−25", "sticker_new_experience_gained.png", "spend"],
  [["рис", "draw", "sketch", "paint"], "Вдохновение", "−20", "sticker_materials.png", "spend"],
  [["рукод", "craft", "handmade"], "Вдохновение", "−15", "sticker_materials.png", "spend"],
  [["убор", "быт", "дом", "clean"], "Энергия", "−10", "sticker_energy.png", "spend"],
  [["полить", "растен", "цвет", "plant"], "Энергия", "−8", "sticker_plants.png", "spend"],
  [["живот", "кот", "собак", "pet"], "Энергия", "−10", "sticker_dog.png", "spend"],
  [["облож", "песн"], "Вдохновение", "−20", "sticker_reputation.png", "spend"],
  [["публик", "reels", "post"], "Репутация", "+25", "sticker_reputation.png", "gain"],
];

const SHOOT_SKILLS = [
  { title: "Телефон + штатив", tip: "iPhone 15 Pro на штатив, блокируй ориентацию.", course: "Sundance · LearnWorlds" },
  { title: "Кадрирование", tip: "Правило третей — объект на линии трети.", course: "LearnWorlds" },
  { title: "Общий / средний / крупный", tip: "Wide → medium → close на один квест.", course: "LearnWorlds" },
  { title: "Съёмка человека", tip: "Средний план, свет из окна.", course: "LearnWorlds" },
  { title: "Съёмка себя одной", tip: "Штатив + запас для crop 9:16.", course: "Sundance" },
  { title: "B-roll", tip: "5–10 сек деталей: руки, текстура.", course: "Sundance" },
  { title: "Движение камеры", tip: "Slow pan на штативе.", course: "Sundance" },
  { title: "Свет из окна", tip: "Объект под 45° к окну.", course: "LearnWorlds" },
  { title: "Искусственный свет", tip: "Fill-свет противоположно окну.", course: "LearnWorlds" },
  { title: "Звук + гарнитура", tip: "10 сек VO в тихой комнате.", course: "LearnWorlds" },
  { title: "Экспозиция / WB", tip: "Lock exposure на лист/лицо.", course: "LearnWorlds" },
  { title: "Стабильность", tip: "30fps + штатив, медленные движения.", course: "Sundance" },
];

const EDIT_SKILLS = [
  { title: "Организация материала", tip: "iMovie: разложи по сценам до cut.", course: "LearnWorlds" },
  { title: "Выбор дублей", tip: "2–3 дубля на сцену.", course: "LearnWorlds" },
  { title: "Склейка + темп", tip: "Cut каждые 2–3 сек.", course: "LearnWorlds" },
  { title: "Темп и ритм", tip: "Hook быстрый → recap медленнее.", course: "LearnWorlds" },
  { title: "J-cut / L-cut", tip: "Звук следующей сцены раньше cut.", course: "LearnWorlds" },
  { title: "B-roll поверх A-roll", tip: "Pop ресурса overlay.", course: "LearnWorlds · Sundance" },
  { title: "Музыка + SFX", tip: "SFX в iMovie, музыка в Instagram.", course: "LearnWorlds" },
  { title: "Текст на экране", tip: "Max 6 слов, ≥1.5 сек.", course: "LearnWorlds" },
  { title: "Color correction", tip: "Warmth + contrast в iMovie.", course: "LearnWorlds" },
  { title: "Color grading", tip: "Один cozy preset на весь ролик.", course: "LearnWorlds" },
  { title: "Работа с голосом", tip: "VO дорожка, обрежь паузы.", course: "LearnWorlds" },
  { title: "Export 9:16", tip: "1080×1920, safe zone для текста.", course: "LearnWorlds" },
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
  return { resource: "Энергия", amount: "−5", sticker: "sticker_energy.png", flow: "spend" as const };
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
    course_note: `${shoot.course} · ${edit.course}`,
    practice: [
      `Съёмка: ${shoot.tip}`,
      `Монтаж: ${edit.tip}`,
      quests[0] ? `Примени в сценах с: «${quests[0].slice(0, 40)}»` : "",
    ].filter(Boolean),
    after_reel: `Получилось «${shoot.title}» + «${edit.title}»? да / повторить`,
    next_shoot: SHOOT_SKILLS[(shoot_i + 1) % SHOOT_SKILLS.length].title,
    next_edit: EDIT_SKILLS[(edit_i + 1) % EDIT_SKILLS.length].title,
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
      timecode: "0–2 sec", label: "Hook", on_screen_text: "Level 33 · сессия",
      my_thought: "Level 33 — сегодня снова играю в свою жизнь.",
      shot_description: "Sketchbook или список квестов",
      edit_note: "iMovie: резкий cut · 1.5 сек VO", resource_awarded: "", sticker_suggestion: "quest-shimmer.gif",
      learn_note: "",
    },
    {
      timecode: "2–6 sec", label: "Quest list", on_screen_text: `${quests.length} квестов`,
      my_thought: "Это не todo-list, а квесты на одну сессию.",
      shot_description: "Scroll по списку дел", edit_note: "Max 6 слов · 2 сек VO", resource_awarded: "",
      sticker_suggestion: "", learn_note: "",
    },
  ];

  const blocks = [[6, 11], [11, 16], [16, 21], [21, 26]];
  quests.slice(0, 4).forEach((quest, i) => {
    const [start, end] = blocks[i] ?? [26, 30];
    const { resource, amount, sticker, flow } = guessResource(quest);
    const verb = flow === "gain" ? "получено" : "потрачено";
    const thought = `Квест «${quest.slice(0, 25)}» — ${verb} ${resource}.`;
    scenes.push({
      timecode: `${start}–${end} sec`, label: quest.slice(0, 30), on_screen_text: quest.slice(0, 40),
      my_thought: thought,
      shot_description: `B-roll: ${quest}`, edit_note: "Cut 2–3 сек · 1.5 сек VO",
      resource_awarded: `${amount} ${resource} (${verb})`, sticker_suggestion: sticker, learn_note: "",
    });
  });

  scenes.push({
    timecode: "28–35 sec", label: "Recap + fog", on_screen_text: "Кружка 🔒 до работы",
    my_thought: "За туманом — кружка, когда найду работу.",
    shot_description: "Баланс ресурсов + fog tease", edit_note: "SFX + музыка · 2 сек VO финал",
    resource_awarded: "", sticker_suggestion: "sticker_new_quest_open.png", learn_note: "",
  });

  const video_learning = pickVideoLearning(quests, session, true);
  if (scenes[0]) scenes[0].learn_note = `📚 Съёмка: ${video_learning.focus_shoot_tip}`;
  if (scenes[1]) scenes[1].learn_note = `📚 Монтаж: ${video_learning.focus_edit_tip}`;

  return {
    total_seconds: 35, player_level: 33, daily_goal_xp: xp_goal,
    projected_xp: resources_gained.length * 15,
    resources_gained, fog_tease: "Кружка 🔒 — только после работы",
    agent_notes: "Обложка песни: 150 Вдохновения + 200 Опыта + 200 Энергии → +50 Репутации.",
    video_learning, scenes, _mode: "template",
  };
}

async function generateStoryboard(session: Session) {
  const { quests, xp_goal, revision_notes, last_storyboard } = session;
  if (!quests.length) throw new Error("Empty quests");

  if (!GROQ_API_KEY) return buildTemplateStoryboard(quests, xp_goal, session);

  try {
    const kb = await loadKnowledge();
    let userMsg = `Knowledge base:\n${kb.knowledge_text}\n\n---\nToday's quests:\n${quests.map((q) => `- ${q}`).join("\n")}\nSession focus: ${xp_goal}\nOutput language: ru\n`;
    if (revision_notes) userMsg += `\nUser revision:\n${revision_notes}\n`;
    if (last_storyboard?.scenes) {
      userMsg += `\nPrevious scenes: ${JSON.stringify((last_storyboard.scenes as unknown[]).slice(0, 4))}\n`;
    }
    userMsg += `\nReturn JSON: total_seconds, player_level, resources_gained[], fog_tease, scenes[] (each scene MUST include my_thought — one first-person VO sentence + VO time in edit_note), agent_notes, video_learning{}.`;

    const raw = await chatGroq(kb.system_prompt, userMsg);
    const data = extractJson(raw) as Record<string, unknown>;
    data._mode = "llm";
    data.video_learning = pickVideoLearning(quests, session, true);
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
      "📚 <b>Учимся на этом Reels</b>",
      `<b>Съёмка:</b> ${vl.focus_shoot}`,
      `   ${vl.focus_shoot_tip}`,
      `<b>Монтаж:</b> ${vl.focus_edit}`,
      `   ${vl.focus_edit_tip}`,
    );
    if (vl.course_note) lines.push(`<i>Курсы: ${vl.course_note}</i>`);
    for (const p of (vl.practice as string[]) ?? []) lines.push(`• ${p}`);
    if (vl.after_reel) lines.push(`✅ ${vl.after_reel}`);
    lines.push("");
  }

  const gained = (data.resources_gained as Record<string, string>[]) ?? [];
  if (gained.length) {
    lines.push("<b>Ресурсы за сессию:</b>");
    for (const r of gained) {
      lines.push(`• ${r.amount} ${r.resource} ← ${r.from_quest}`);
    }
    lines.push("");
  }
  if (data.fog_tease) lines.push(`🌫 <b>Туман войны:</b> ${data.fog_tease}`, "");

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
    lines.push("", "<i>⚠️ AI недоступен — упрощённый сценарий. /storyboard через минуту.</i>");
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
  await sendMessage(chatId, "⏳ Генерирую storyboard…");
  const data = await generateStoryboard(session);
  session.last_storyboard = data;
  session.revision_notes = "";
  await saveSession(supabase, session);
  await sendMessage(chatId, formatStoryboard(data));
  await sendMessage(chatId, "✏️ /add — добавить · /rewrite — переписать");
}

export async function handleUpdate(update: TelegramUpdate, supabase: SupabaseClient) {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  if (ALLOWED.length && !ALLOWED.includes(String(chatId))) {
    console.warn("Unauthorized chat:", chatId);
    await sendMessage(
      chatId,
      `⛔ Доступ только для владельца.\n\nТвой chat_id: <code>${chatId}</code>\nДобавь его в Supabase → Secrets → <code>TELEGRAM_ALLOWED_CHAT_IDS</code> и напиши /start снова.`,
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
      await sendMessage(chatId, `✅ ${session.quests.length} квестов.\n/storyboard — сценарий.`);
      return;
    }
    session.awaiting_today = true;
    await saveSession(supabase, session);
    await sendMessage(chatId, "Отправь список дел построчно ✔");
    return;
  }

  if (text.startsWith("/goal")) {
    const n = parseInt(text.split(/\s+/)[1] ?? "", 10);
    if (!n) {
      await sendMessage(chatId, `Фокус: ${session.xp_goal}. /goal 100`);
      return;
    }
    session.xp_goal = n;
    await saveSession(supabase, session);
    await sendMessage(chatId, `🎯 Фокус: <b>${n}</b>`);
    return;
  }

  if (text.startsWith("/status")) {
    const list = session.quests.map((q) => `• ${q}`).join("\n") || "(пусто)";
    await sendMessage(chatId, `<b>Квесты:</b>\n${list}\n\nФокус: ${session.xp_goal}`);
    return;
  }

  if (text.startsWith("/storyboard")) {
    if (!session.quests.length) {
      await sendMessage(chatId, "Сначала /today");
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
      await sendMessage(chatId, "Отправь дела для добавления.");
      return;
    }
    session.quests.push(...parseQuestLines(rest));
    await saveSession(supabase, session);
    await sendMessage(chatId, `➕ Добавила. Всего ${session.quests.length}. Переписываю…`);
    await runStoryboard(chatId, session, supabase);
    return;
  }

  if (text.startsWith("/rewrite")) {
    if (!session.quests.length) {
      await sendMessage(chatId, "Сначала /today");
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
    await sendMessage(chatId, `✅ ${session.quests.length} квестов.\n/storyboard`);
  }
}
