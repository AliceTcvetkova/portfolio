/** Script learning workflow — /learn (×10 transcript exercise). Mirrors bot/script_learning.py */

export type ScriptLearningEntry = {
  at: string;
  author: string;
  title: string;
  file: string;
};

export type ScriptLearningState = {
  target: number;
  completed: number;
  current_author: string;
  entries: ScriptLearningEntry[];
};

export const SCRIPT_LEARNING_TARGET = 10;

const STEPS = [
  "Instagram → Reels with strong **script** → Share → Copy link",
  "Telegram **Save As Bot** → paste link → download **video file**",
  "Telegram **Vox** → send file → get **transcript text**",
  "Notes: punctuation, read aloud → Hook / Body / Close blocks",
  "Save to `knowledge/script_learning/transcripts/` (template `_template.md`)",
  "Bot: `/learn log @author short-title` — +1 toward 10",
];

const HOOKS_SHORT =
  "<b>Hook types (Alice):</b>\n" +
  "calm_strange · noticed_pattern · simple_plan_derailed · experiment_tease · " +
  "forest_metaphor · object_portal · manager_maker · cold_then_fire · " +
  "haunting_question · game_session · understood_late · small_world\n\n" +
  "Arc: Earth calm → Fire flash. Full: hook_types.md";

export function defaultScriptLearning(): ScriptLearningState {
  return { target: SCRIPT_LEARNING_TARGET, completed: 0, current_author: "", entries: [] };
}

export function mergeScriptLearning(raw: unknown): ScriptLearningState {
  const base = defaultScriptLearning();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Partial<ScriptLearningState>;
  return {
    target: d.target ?? base.target,
    completed: d.completed ?? base.completed,
    current_author: d.current_author ?? base.current_author,
    entries: Array.isArray(d.entries) ? d.entries : [],
  };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .slice(0, 48) || "untitled";
}

export function formatScriptLearningStatus(state: ScriptLearningState): string {
  const done = state.completed;
  const target = state.target;
  const bar = "▓".repeat(done) + "░".repeat(Math.max(0, target - done));
  const lines = [
    "<b>📚 Script learning</b> — ×10 exercise",
    `Progress: <b>${done}/${target}</b> ${bar}`,
    `Current author: ${state.current_author || "—"}`,
    "",
    "<b>Steps:</b>",
    ...STEPS.map((s, i) => `${i + 1}. ${s}`),
    "",
    "<b>Commands:</b>",
    "/learn step [1-6] · /learn start @handle",
    "/learn log @author title · /learn hooks · /learn prompt · /learn list",
  ];
  if (done >= target) lines.push(`\n✅ ${target} done — /learn prompt for Claude`);
  return lines.join("\n");
}

function formatStep(n: number): string {
  if (n < 1 || n > STEPS.length) return `Step 1–${STEPS.length}. Example: /learn step 3`;
  const extra: Record<number, string> = {
    2: "\n\n<i>Save As Bot</i> — Telegram bot: paste Reels link → get mp4.",
    3: "\n\n<i>Vox</i> — Telegram bot: send video → text. Find current @ in Telegram.",
  };
  return `<b>Step ${n}/${STEPS.length}</b>\n${STEPS[n - 1]}${extra[n] ?? ""}`;
}

function formatPrompt(state: ScriptLearningState): string {
  if (state.completed < SCRIPT_LEARNING_TARGET) {
    return `Need ${SCRIPT_LEARNING_TARGET} transcripts (now ${state.completed}). /learn log after each.`;
  }
  return (
    "<b>Claude prompt</b> (after 10+ transcripts saved locally):\n\n" +
    "<pre>" +
    "Here are N Reels transcript breakdowns from creators I study.\n" +
    "Analyze patterns and write a script instruction for @sashaiamdrawing:\n" +
    "- hook types and how they open\n" +
    "- scene turns, sentence length, chunk rhythm\n" +
    "- hold attention without infobiz/tutorial tone\n" +
    "- structure: hook → chunks → conclusion\n" +
    "Draft in MY voice: cozy, honest, Level 33, bond not tutorial.\n" +
    "</pre>\n" +
    "Attach files from knowledge/script_learning/transcripts/"
  );
}

function formatList(state: ScriptLearningState): string {
  if (!state.entries.length) return "Empty. /learn log @author title after first transcript.";
  const lines = ["<b>Logged transcripts:</b>"];
  for (const e of state.entries.slice(-15)) {
    lines.push(`• ${e.at} — ${e.author} — ${e.title}`);
  }
  return lines.join("\n");
}

export function parseLearnCommand(text: string): { action: string; arg: string } | null {
  const raw = text.trim();
  if (!raw.toLowerCase().startsWith("/learn")) return null;
  const rest = raw.slice("/learn".length).trim();
  if (!rest) return { action: "status", arg: "" };
  const space = rest.indexOf(" ");
  if (space === -1) return { action: rest.toLowerCase(), arg: "" };
  return { action: rest.slice(0, space).toLowerCase(), arg: rest.slice(space + 1).trim() };
}

export function executeLearn(
  state: ScriptLearningState,
  action: string,
  arg: string,
): { message: string; state: ScriptLearningState } {
  const s = { ...state, entries: [...state.entries] };

  switch (action) {
    case "":
    case "status":
    case "help":
      return { message: formatScriptLearningStatus(s), state: s };
    case "step": {
      const n = parseInt(arg, 10) || 1;
      return { message: formatStep(n), state: s };
    }
    case "hooks":
      return { message: HOOKS_SHORT, state: s };
    case "prompt":
      return { message: formatPrompt(s), state: s };
    case "list":
      return { message: formatList(s), state: s };
    case "start": {
      const handle = arg.startsWith("@") ? arg : arg ? `@${arg}` : "";
      if (!handle || handle === "@") return { message: "Usage: /learn start @nilukka", state: s };
      s.current_author = handle;
      return { message: `📌 Author: <b>${handle}</b>\n\n${formatStep(1)}`, state: s };
    }
    case "log": {
      const sp = arg.indexOf(" ");
      if (sp === -1) return { message: "Usage: /learn log @author short-title", state: s };
      const authorRaw = arg.slice(0, sp);
      const title = arg.slice(sp + 1).trim();
      const author = authorRaw.startsWith("@") ? authorRaw : `@${authorRaw}`;
      const today = new Date().toISOString().slice(0, 10);
      const filename = `${today}_${slug(`${author}-${title}`)}.md`;
      s.current_author = author;
      s.completed += 1;
      s.entries.push({ at: today, author, title, file: filename });
      let msg =
        `✅ Logged <b>${s.completed}/${s.target}</b>: ${author} — ${title}\n` +
        `Save transcript locally: knowledge/script_learning/transcripts/${filename}`;
      if (s.completed >= s.target) msg += "\n\n🎉 Target reached — /learn prompt";
      return { message: msg, state: s };
    }
    case "reset":
      return { message: "Counter reset.", state: defaultScriptLearning() };
    default:
      return {
        message: "Try: /learn · /learn step 2 · /learn start @handle · /learn log @handle title",
        state: s,
      };
  }
}

/** Nest under player_progress.script_learning in session JSON */
export function getScriptLearningFromProgress(pp: { script_learning?: unknown }): ScriptLearningState {
  return mergeScriptLearning(pp.script_learning);
}

export function setScriptLearningOnProgress(
  pp: Record<string, unknown>,
  sl: ScriptLearningState,
): Record<string, unknown> {
  return { ...pp, script_learning: sl };
}
