/** Level 33 resource balances + active goal investment (mirrors Reelsagent/bot/player_progress.py). */

export type ResourceKey =
  | "Inspiration"
  | "Experience"
  | "Energy"
  | "Reputation"
  | "Coins";

export const RESOURCE_KEYS: ResourceKey[] = [
  "Inspiration",
  "Experience",
  "Energy",
  "Reputation",
  "Coins",
];

const RESOURCE_ALIASES: Record<string, ResourceKey> = {
  inspiration: "Inspiration",
  insp: "Inspiration",
  вдохновение: "Inspiration",
  вдохнов: "Inspiration",
  experience: "Experience",
  exp: "Experience",
  опыт: "Experience",
  energy: "Energy",
  энергия: "Energy",
  энерг: "Energy",
  reputation: "Reputation",
  rep: "Reputation",
  репутация: "Reputation",
  реп: "Reputation",
  coins: "Coins",
  coin: "Coins",
  монеты: "Coins",
  монет: "Coins",
};

const GOAL_ALIASES: Record<string, string> = {
  cover: "song_cover",
  song: "song_cover",
  song_cover: "song_cover",
  обложка: "song_cover",
  облож: "song_cover",
  песн: "song_cover",
};

export type PlayerProgress = {
  updated: string;
  level: number;
  resources: Record<ResourceKey, number>;
  goals: Record<
    string,
    {
      label: string;
      label_ru: string;
      invested: Partial<Record<ResourceKey, number>>;
      targets: Partial<Record<ResourceKey, number>>;
      reward: string;
      status: string;
    }
  >;
  unlocks: Record<string, { locked: boolean; reason: string; reason_ru?: string }>;
  log: { at: string; note: string; changes: Record<string, unknown>[] }[];
};

export function defaultProgress(): PlayerProgress {
  const today = new Date().toISOString().slice(0, 10);
  return {
    updated: today,
    level: 33,
    resources: {
      Inspiration: 0,
      Experience: 0,
      Energy: 0,
      Reputation: 0,
      Coins: 0,
    },
    goals: {
      song_cover: {
        label: "Friend song cover",
        label_ru: "Обложка песни друга",
        invested: { Inspiration: 0, Experience: 0, Energy: 0 },
        targets: { Inspiration: 150, Experience: 200, Energy: 200 },
        reward: "+50 Reputation",
        status: "active",
      },
    },
    unlocks: {
      mug: { locked: true, reason: "until job found", reason_ru: "пока нет работы" },
    },
    log: [],
  };
}

export function mergeProgress(raw: unknown): PlayerProgress {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<PlayerProgress>;
  return {
    ...base,
    ...data,
    resources: { ...base.resources, ...(data.resources ?? {}) },
    goals: {
      song_cover: {
        ...base.goals.song_cover,
        ...(data.goals?.song_cover ?? {}),
        invested: {
          ...base.goals.song_cover.invested,
          ...(data.goals?.song_cover?.invested ?? {}),
        },
        targets: {
          ...base.goals.song_cover.targets,
          ...(data.goals?.song_cover?.targets ?? {}),
        },
      },
    },
    unlocks: { ...base.unlocks, ...(data.unlocks ?? {}) },
    log: data.log ?? [],
  };
}

function normalizeResource(token: string): ResourceKey | null {
  const key = token.trim().toLowerCase().replace("ё", "е");
  if (RESOURCE_ALIASES[key]) return RESOURCE_ALIASES[key];
  for (const [alias, canonical] of Object.entries(RESOURCE_ALIASES)) {
    if (key.startsWith(alias) || alias.startsWith(key)) return canonical;
  }
  const title = token.trim();
  if (RESOURCE_KEYS.includes(title as ResourceKey)) return title as ResourceKey;
  return null;
}

function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/[−–—]/g, "-").replace(/\+/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function appendLog(data: PlayerProgress, note: string, changes: Record<string, unknown>[]) {
  data.log.unshift({ at: new Date().toISOString(), note, changes });
  data.log = data.log.slice(0, 12);
}

export function applyResourceDelta(
  data: PlayerProgress,
  resource: ResourceKey,
  delta: number,
  note = "",
) {
  const before = data.resources[resource] ?? 0;
  const after = before + delta;
  data.resources[resource] = after;
  const change = { type: "resource", resource, delta, before, after };
  appendLog(data, note || `${delta >= 0 ? "+" : ""}${delta} ${resource}`, [change]);
  return change;
}

export function applyGoalInvestment(
  data: PlayerProgress,
  goalId: string,
  resource: ResourceKey,
  amount: number,
  note = "",
) {
  const goal = data.goals[goalId];
  if (!goal) throw new Error(`Unknown goal: ${goalId}`);
  const before = goal.invested[resource] ?? 0;
  const after = before + amount;
  goal.invested[resource] = after;
  appendLog(data, note || `${goalId} +${amount} ${resource}`, [
    { type: "goal", goal: goalId, resource, delta: amount, before, after },
  ]);
}

export function setResource(data: PlayerProgress, resource: ResourceKey, value: number, note = "") {
  const before = data.resources[resource] ?? 0;
  data.resources[resource] = value;
  appendLog(data, note || `set ${resource} = ${value}`, [
    { type: "set", resource, before, after: value },
  ]);
}

export function applyStoryboardResources(
  data: PlayerProgress,
  resourcesGained: Record<string, unknown>[],
  note = "from storyboard",
) {
  const applied: { resource: string; delta: number; from_quest: string }[] = [];
  for (const row of resourcesGained) {
    const resource = String(row.resource ?? "") as ResourceKey;
    if (!RESOURCE_KEYS.includes(resource)) continue;
    let delta = parseAmount(String(row.amount ?? "0").replace(/\+/g, "")) ?? 0;
    const flow = row.flow;
    if (flow === "spend" && delta > 0) delta = -delta;
    if (flow === "gain" && delta < 0) delta = Math.abs(delta);

    const quest = String(row.from_quest ?? "").toLowerCase();
    const goalId = ["облож", "cover", "песн", "song"].some((k) => quest.includes(k))
      ? "song_cover"
      : null;

    if (goalId && data.goals[goalId].targets[resource] && delta < 0) {
      applyGoalInvestment(data, goalId, resource, Math.abs(delta), quest || note);
      applyResourceDelta(data, resource, delta, quest || note);
    } else {
      applyResourceDelta(data, resource, delta, quest || note);
    }
    applied.push({ resource, delta, from_quest: String(row.from_quest ?? "") });
  }
  data.updated = new Date().toISOString().slice(0, 10);
  return applied;
}

function detectGoalFromNote(note: string): string | null {
  const n = note.toLowerCase();
  for (const [alias, gid] of Object.entries(GOAL_ALIASES)) {
    if (n.includes(alias)) return gid;
  }
  return null;
}

function parseLogBody(body: string): { action: string; payload: Record<string, unknown> } | null {
  const parts = body.split(/\s+/).filter(Boolean);
  if (!parts.length) return { action: "help", payload: {} };

  const goalId = GOAL_ALIASES[parts[0].toLowerCase()];
  if (goalId) {
    const res = normalizeResource(parts[1] ?? "");
    const amt = parseAmount(parts[2] ?? "");
    if (res && amt !== null) {
      return {
        action: "goal",
        payload: { goal: goalId, resource: res, amount: amt, note: parts.slice(3).join(" ") },
      };
    }
    return { action: "error", payload: { message: "Usage: /log cover inspiration 20" } };
  }

  const amountFirst = parseAmount(parts[0]);
  if (amountFirst !== null && parts.length >= 2) {
    const res = normalizeResource(parts[1]);
    if (res) {
      const note = parts.slice(2).join(" ");
      return {
        action: "delta",
        payload: { resource: res, delta: amountFirst, note, goal: detectGoalFromNote(note) },
      };
    }
  }

  const res = normalizeResource(parts[0]);
  if (res && parts.length >= 2) {
    const amt = parseAmount(parts[1]);
    if (amt !== null) {
      const note = parts.slice(2).join(" ");
      return {
        action: "delta",
        payload: { resource: res, delta: amt, note, goal: detectGoalFromNote(note) },
      };
    }
  }

  return { action: "error", payload: { message: "Try: /log +15 experience job search" } };
}

export function parseLogCommand(text: string): { action: string; payload: Record<string, unknown> } | null {
  const raw = text.trim();
  const lower = raw.toLowerCase();
  let body: string | null = null;

  if (lower.startsWith("/log")) body = raw.slice(4).trim();
  else if (lower.startsWith("log ")) body = raw.slice(4).trim();
  else {
    const triggers = ["добавь", "добавить", "спиши", "начисли"];
    if (triggers.some((t) => lower.startsWith(t))) {
      body = raw.replace(/^(добавь|добавить|спиши|начисли)\s+/i, "").trim();
    }
  }

  if (body === null) return null;
  if (!body) return { action: "help", payload: {} };

  if (["apply", "storyboard", "session", "today"].includes(body.toLowerCase())) {
    return { action: "apply", payload: {} };
  }

  if (body.toLowerCase().startsWith("set ")) {
    const p = body.split(/\s+/);
    const res = normalizeResource(p[1] ?? "");
    const val = parseAmount(p[2] ?? "");
    if (res && val !== null) {
      return { action: "set", payload: { resource: res, value: val, note: p.slice(3).join(" ") } };
    }
    return { action: "error", payload: { message: "Usage: /log set inspiration 45" } };
  }

  return parseLogBody(body);
}

export function executeLog(
  data: PlayerProgress,
  action: string,
  payload: Record<string, unknown>,
  storyboardResources?: Record<string, unknown>[],
): string {
  if (action === "help") return logHelp();
  if (action === "error") return String(payload.message ?? "Parse error");

  if (action === "apply") {
    if (!storyboardResources?.length) {
      return "No storyboard resources to apply. Run /storyboard first.";
    }
    const applied = applyStoryboardResources(data, storyboardResources);
    if (!applied.length) return "Nothing applied — empty resources_gained.";
    const lines = [`✅ Applied ${applied.length} from last storyboard:`];
    for (const a of applied) {
      lines.push(`• ${a.delta >= 0 ? "+" : ""}${a.delta} ${a.resource} ← ${a.from_quest}`);
    }
    lines.push("", formatProgressSummary(data));
    return lines.join("\n");
  }

  if (action === "set") {
    setResource(data, payload.resource as ResourceKey, payload.value as number, String(payload.note ?? ""));
    data.updated = new Date().toISOString().slice(0, 10);
    return `✅ Set ${payload.resource} = ${payload.value}\n\n${formatProgressSummary(data)}`;
  }

  if (action === "goal") {
    applyGoalInvestment(
      data,
      String(payload.goal),
      payload.resource as ResourceKey,
      payload.amount as number,
      String(payload.note ?? ""),
    );
    data.updated = new Date().toISOString().slice(0, 10);
    return `✅ Goal +${payload.amount} ${payload.resource}\n\n${formatProgressSummary(data)}`;
  }

  if (action === "delta") {
    const delta = payload.delta as number;
    const resource = payload.resource as ResourceKey;
    const goalId = payload.goal as string | null;
    if (goalId && delta > 0) {
      applyGoalInvestment(data, goalId, resource, delta, String(payload.note ?? ""));
    } else if (goalId && delta < 0) {
      applyGoalInvestment(data, goalId, resource, Math.abs(delta), String(payload.note ?? ""));
      applyResourceDelta(data, resource, delta, String(payload.note ?? ""));
    } else {
      applyResourceDelta(data, resource, delta, String(payload.note ?? ""));
    }
    data.updated = new Date().toISOString().slice(0, 10);
    return `✅ ${delta >= 0 ? "+" : ""}${delta} ${resource}\n\n${formatProgressSummary(data)}`;
  }

  return "Unknown action";
}

export function logHelp(): string {
  return (
    "<b>/log</b> — track resources & goals\n\n" +
    "<b>Examples:</b>\n" +
    "/log +15 experience job search\n" +
    "/log inspiration -20 draw\n" +
    "/log cover inspiration 20\n" +
    "/log set energy 80\n" +
    "/log apply — from last storyboard\n\n" +
    "RU: «добавь 15 опыта», «−20 вдохновения»"
  );
}

function bar(current: number, target: number, width = 10): string {
  if (target <= 0) return "░".repeat(width);
  const filled = Math.min(width, Math.max(0, Math.round((current / target) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function goalPercent(goal: PlayerProgress["goals"][string]): number {
  const invested = goal.invested ?? {};
  const targets = goal.targets ?? {};
  const keys = Object.keys(targets);
  if (!keys.length) return 0;
  const ratios = keys.map((res) => {
    const t = targets[res as ResourceKey] ?? 0;
    return t ? Math.min(1, (invested[res as ResourceKey] ?? 0) / t) : 0;
  });
  return Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100);
}

export function formatProgressSummary(data: PlayerProgress): string {
  const lines = ["<b>Level 33 · resources</b>"];
  for (const res of RESOURCE_KEYS) {
    lines.push(`• ${res}: <b>${data.resources[res] ?? 0}</b>`);
  }
  const song = data.goals.song_cover;
  lines.push("", `<b>${song.label_ru}</b> (${goalPercent(song)}%)`);
  for (const res of ["Inspiration", "Experience", "Energy"] as ResourceKey[]) {
    const cur = song.invested[res] ?? 0;
    const tgt = song.targets[res] ?? 0;
    lines.push(`  ${bar(cur, tgt)} ${cur}/${tgt} ${res}`);
  }
  const mug = data.unlocks.mug;
  lines.push("", `☕ Mug ${mug.locked ? "🔒" : "✅"} — ${mug.reason_ru ?? mug.reason}`);
  lines.push(`<i>Updated ${data.updated}</i>`);
  return lines.join("\n");
}

export function buildPublicPayload(data: PlayerProgress) {
  const song = data.goals.song_cover;
  return {
    updated: data.updated,
    level: data.level,
    resources: data.resources,
    goals: [
      {
        id: "song_cover",
        label: song.label,
        labelRu: song.label_ru,
        percent: goalPercent(song),
        bars: (["Inspiration", "Experience", "Energy"] as ResourceKey[]).map((res) => ({
          resource: res,
          current: song.invested[res] ?? 0,
          target: song.targets[res] ?? 0,
        })),
        reward: song.reward,
        status: song.status,
      },
    ],
    unlocks: [
      {
        id: "mug",
        label: "New mug",
        labelRu: "Новая кружка",
        locked: data.unlocks.mug.locked,
        reason: data.unlocks.mug.reason,
        reasonRu: data.unlocks.mug.reason_ru,
      },
    ],
    recentLog: data.log.slice(0, 5),
  };
}

export function progressContextForLlm(data: PlayerProgress): string {
  const song = data.goals.song_cover;
  return [
    "CURRENT PLAYER PROGRESS (canonical — use in diary/fog tease):",
    `Resources: ${RESOURCE_KEYS.map((k) => `${k}=${data.resources[k] ?? 0}`).join(", ")}`,
    "Song cover invested: " +
      (["Inspiration", "Experience", "Energy"] as ResourceKey[])
        .map((r) => `${r} ${song.invested[r] ?? 0}/${song.targets[r] ?? 0}`)
        .join(", "),
    `Mug locked: ${data.unlocks.mug.locked}`,
  ].join("\n");
}

export async function syncPublicProgress(
  supabase: import("jsr:@supabase/supabase-js@2").SupabaseClient,
  data: PlayerProgress,
) {
  const payload = buildPublicPayload(data);
  await supabase.from("reels_agent_public_progress").upsert({
    id: 1,
    payload,
    updated_at: new Date().toISOString(),
  });
}
