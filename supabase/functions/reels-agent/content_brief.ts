export type ContentBrief = {
  content_type: string;
  input_text: string;
  mood: string;
  goal: string;
  format_pref: string;
  duration: number;
};

const TYPE_ALIASES: Record<string, string> = {
  diary: "diary", gamification: "diary", game: "diary",
  talking: "talking", talk: "talking", head: "talking",
  detail: "detail", details: "detail", object: "detail", thing: "detail",
  hybrid: "hybrid",
  surprise: "surprise", auto: "surprise",
};

const MOODS = new Set(["cozy", "thoughtful", "funny", "vulnerable", "energetic", "cinematic"]);
const DURATIONS = new Set([15, 30, 35, 60]);

export function parseReelCommand(text: string): ContentBrief {
  const raw = text.trim();
  if (!raw.toLowerCase().startsWith("/reel")) {
    return { content_type: "surprise", input_text: raw, mood: "cozy", goal: "tell a story", format_pref: "mixed", duration: 30 };
  }
  const rest = raw.slice(5).trim();
  const nl = rest.indexOf("\n");
  const paramLine = nl >= 0 ? rest.slice(0, nl).trim() : rest;
  const bodyAfterNewline = nl >= 0 ? rest.slice(nl + 1).trim() : "";

  const tokens = paramLine.split(/\s+/).filter(Boolean);
  let content_type = "surprise";
  let mood = "cozy";
  let duration = 30;
  let i = 0;
  if (tokens[i] && TYPE_ALIASES[tokens[i].toLowerCase()]) {
    content_type = TYPE_ALIASES[tokens[i].toLowerCase()];
    i++;
  }
  if (tokens[i] && /^\d+$/.test(tokens[i]) && DURATIONS.has(parseInt(tokens[i], 10))) {
    duration = parseInt(tokens[i], 10);
    i++;
  }
  if (tokens[i] && MOODS.has(tokens[i].toLowerCase())) {
    mood = tokens[i].toLowerCase();
    i++;
  }
  let input_text = tokens.slice(i).join(" ").trim();
  if (bodyAfterNewline) {
    input_text = input_text ? `${input_text}\n${bodyAfterNewline}` : bodyAfterNewline;
  }
  return { content_type, input_text, mood, goal: "tell a story", format_pref: "mixed", duration };
}

export type PendingReelBrief = ContentBrief & { _awaiting?: boolean };

export function isAwaitingReelInput(data: unknown): data is PendingReelBrief {
  return !!data && typeof data === "object" && (data as PendingReelBrief)._awaiting === true;
}

export function briefFromQuests(quests: string[], xp_goal = 100): ContentBrief {
  return {
    content_type: "diary",
    input_text: quests.map((q) => `- ${q}`).join("\n"),
    mood: "cozy",
    goal: "tell a story",
    format_pref: "mixed",
    duration: 35,
  };
}

export function formatBriefSummary(b: ContentBrief): string {
  const preview = b.input_text.length > 200 ? b.input_text.slice(0, 200) + "…" : b.input_text;
  return `<b>Type:</b> ${b.content_type}\n<b>Mood:</b> ${b.mood} · <b>Duration:</b> ${b.duration}s\n<b>Input:</b> ${preview}`;
}
