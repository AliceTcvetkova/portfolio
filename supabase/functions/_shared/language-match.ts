/** Candidate language levels — keep in sync with knowledge/rules/languages.md */

export type LangEntry = {
  name: string;
  cefr: number; // A1=1 … C2=6, native=6
  label: string;
};

export const CANDIDATE_LANGUAGES: LangEntry[] = [
  { name: "russian", cefr: 6, label: "Russian (native)" },
  { name: "english", cefr: 5, label: "English C1" },
  { name: "german", cefr: 3, label: "German B1" },
  { name: "french", cefr: 3, label: "French B1" },
  { name: "finnish", cefr: 2, label: "Finnish elementary" },
  { name: "afrikaans", cefr: 2, label: "Afrikaans elementary" },
];

type LangRequirement = {
  lang: string;
  displayName: string;
  minCefr: number;
  required: boolean;
};

const LANG_DEFS: {
  key: string;
  displayName: string;
  patterns: RegExp[];
}[] = [
  {
    key: "chinese",
    displayName: "Chinese",
    patterns: [
      /\bchinese\b/i,
      /\bmandarin\b/i,
      /\bcantonese\b/i,
      /китайск/i,
      /мандарин/i,
      /中文/,
    ],
  },
  {
    key: "japanese",
    displayName: "Japanese",
    patterns: [/\bjapanese\b/i, /японск/i, /日本語/],
  },
  {
    key: "korean",
    displayName: "Korean",
    patterns: [/\bkorean\b/i, /корейск/i],
  },
  {
    key: "arabic",
    displayName: "Arabic",
    patterns: [/\barabic\b/i, /арабск/i],
  },
  {
    key: "spanish",
    displayName: "Spanish",
    patterns: [/\bspanish\b/i, /испанск/i],
  },
  {
    key: "german",
    displayName: "German",
    patterns: [/\bgerman\b/i, /немецк/i, /\bdeutsch\b/i],
  },
  {
    key: "french",
    displayName: "French",
    patterns: [/\bfrench\b/i, /французск/i, /\bfrançais\b/i],
  },
  {
    key: "english",
    displayName: "English",
    patterns: [/\benglish\b/i, /английск/i],
  },
  {
    key: "finnish",
    displayName: "Finnish",
    patterns: [/\bfinnish\b/i, /финск/i, /suomi/i],
  },
  {
    key: "afrikaans",
    displayName: "Afrikaans",
    patterns: [/\bafrikaans\b/i, /африкаанс/i],
  },
];

function cefrLabel(n: number): string {
  const map: Record<number, string> = {
    1: "A1",
    2: "A2",
    3: "B1",
    4: "B2",
    5: "C1",
    6: "C2/native",
  };
  return map[n] ?? "?";
}

function parseMinCefr(snippet: string, langKey: string): number {
  const s = snippet.toLowerCase();
  if (/native|родной|носитель|bilingual|двуязыч/i.test(s)) return 6;
  if (/\bc2\b|proficiency.*c2/i.test(s)) return 6;
  if (/\bc1\b|advanced|upper[- ]intermediate|свободн/i.test(s)) return 5;
  if (/\bb2\b|fluent|flowing|business|delov|рабоч/i.test(s)) return 4;
  if (/\bb1\b|intermediate|средн/i.test(s)) return 3;
  if (/\ba2\b/i.test(s)) return 2;
  if (/\ba1\b|basic|beginner|базов|начальн/i.test(s)) return 1;
  // Default if language mentioned without level — assume working B2 for "required" languages
  if (langKey === "english") return 4;
  if (["chinese", "japanese", "korean", "arabic"].includes(langKey)) return 4;
  return 3;
}

function isMustHaveContext(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 120), index + 120).toLowerCase();
  return /must|required|обязательн|must-have|essential|необходим|fluent|native|nositel|nositel/i
    .test(window);
}

export function detectLanguageRequirements(vacancy: string): LangRequirement[] {
  const found: LangRequirement[] = [];
  const lower = vacancy.toLowerCase();

  for (const def of LANG_DEFS) {
    for (const pattern of def.patterns) {
      const match = pattern.exec(vacancy);
      if (!match) continue;
      const idx = match.index ?? 0;
      const context = lower.slice(Math.max(0, idx - 80), idx + 80);
      const minCefr = parseMinCefr(context, def.key);
      const required = isMustHaveContext(vacancy, idx) ||
        /required|must|fluent|native|обязательн|свободн/i.test(context);
      if (!found.some((f) => f.lang === def.key)) {
        found.push({
          lang: def.key,
          displayName: def.displayName,
          minCefr,
          required: required || minCefr >= 4,
        });
      }
      break;
    }
  }
  return found;
}

export function candidateCefr(langKey: string): number {
  const entry = CANDIDATE_LANGUAGES.find((l) => l.name === langKey);
  return entry?.cefr ?? 0;
}

export type LanguageAdjustResult = {
  language_gaps: string[];
  hard_blockers: string[];
  matchPenalty: number;
  fitHint: "strong_fit" | "conditional_fit" | "poor_fit" | null;
};

export function computeLanguageGaps(vacancy: string): LanguageAdjustResult {
  const reqs = detectLanguageRequirements(vacancy);
  const language_gaps: string[] = [];
  const hard_blockers: string[] = [];
  let matchPenalty = 0;
  let fitHint: LanguageAdjustResult["fitHint"] = null;

  for (const req of reqs) {
    const have = candidateCefr(req.lang);
    const needLabel = cefrLabel(req.minCefr);
    const haveEntry = CANDIDATE_LANGUAGES.find((l) => l.name === req.lang);

    if (have === 0) {
      const msg =
        `${req.displayName} required (${needLabel}+) - not in candidate profile (only: EN C1, DE/FR B1, FI/AF elementary)`;
      language_gaps.push(msg);
      if (req.required || req.minCefr >= 4) {
        hard_blockers.push(msg);
        matchPenalty += 30;
        fitHint = "poor_fit";
      } else {
        matchPenalty += 15;
        if (!fitHint) fitHint = "conditional_fit";
      }
      continue;
    }

    if (have < req.minCefr) {
      const gap =
        `${req.displayName}: vacancy asks ${needLabel}+, candidate has ${haveEntry?.label ?? "?"}`;
      language_gaps.push(gap);
      if (req.lang === "english" && req.minCefr >= 6) {
        hard_blockers.push(`${gap} - candidate has English C1, not C2/native`);
        matchPenalty += 12;
        if (!fitHint || fitHint === "conditional_fit") fitHint = "conditional_fit";
      } else if (["german", "french"].includes(req.lang) && req.minCefr >= 4) {
        language_gaps.push(`${req.displayName}: B1 now; can study toward B2`);
        matchPenalty += req.required ? 15 : 8;
        if (!fitHint) fitHint = "conditional_fit";
      } else if (req.required) {
        matchPenalty += 10;
        if (!fitHint) fitHint = "conditional_fit";
      }
    }
  }

  return { language_gaps, hard_blockers, matchPenalty, fitHint };
}

export type AnalyzeResult = {
  match_percent: number;
  highlights: string[];
  expected_concerns: string[];
  cv_sections_to_boost?: string[];
  matched_projects?: string[];
  fit_verdict?: string;
  language_gaps?: string[];
  hard_blockers?: string[];
};

export function applyLanguageAdjustments(
  vacancy: string,
  result: AnalyzeResult,
): AnalyzeResult {
  const adj = computeLanguageGaps(vacancy);
  if (!adj.language_gaps.length) return result;

  const concerns = new Set(result.expected_concerns ?? []);
  for (const g of adj.language_gaps) concerns.add(g);
  for (const b of adj.hard_blockers) concerns.add(`Blocker: ${b}`);

  let match = result.match_percent;
  if (adj.matchPenalty > 0) {
    match = Math.max(5, match - adj.matchPenalty);
  }

  let fit_verdict = result.fit_verdict ?? "strong_fit";
  if (adj.hard_blockers.length) fit_verdict = "poor_fit";
  else if (adj.language_gaps.length && fit_verdict === "strong_fit") {
    fit_verdict = adj.fitHint ?? "conditional_fit";
  }

  return {
    ...result,
    match_percent: match,
    expected_concerns: [...concerns],
    language_gaps: adj.language_gaps,
    hard_blockers: adj.hard_blockers,
    fit_verdict,
  };
}
