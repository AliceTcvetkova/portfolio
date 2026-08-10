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

/** Languages that are blockers when mentioned anywhere in job requirements context */
const STRICT_BLOCKER_LANGS = new Set([
  "chinese",
  "japanese",
  "korean",
  "arabic",
  "spanish",
]);

/** DE/FR/EN — only flag when explicit requirement phrasing (avoid nav/footer noise) */
const CONTEXT_SENSITIVE_LANGS = new Set([
  "german",
  "french",
  "english",
  "finnish",
  "afrikaans",
]);

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
    patterns: [/\bfinnish\b/i, /финск/i, /\bsuomi\b/i],
  },
  {
    key: "afrikaans",
    displayName: "Afrikaans",
    patterns: [/\bafrikaans\b/i, /африкаанс/i],
  },
];

const UI_NOISE =
  /cookie|privacy policy|select language|choose language|lang=|hreflang|all rights reserved|©/i;

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

function getContextWindow(text: string, index: number, size = 100): string {
  return text.slice(Math.max(0, index - size), index + size).toLowerCase();
}

/** Skip language switcher / footer noise from fetched HTML */
function isUiNoise(context: string): boolean {
  if (UI_NOISE.test(context)) return true;
  // "English | Deutsch | Français" style menus
  if (/(english|deutsch|français|russian)\s*[|/·•]\s*(english|deutsch|français|russian)/i.test(context)) {
    return true;
  }
  return false;
}

/** "Job description in English" — not a language requirement */
function isPostingLanguageNote(context: string): boolean {
  return /(?:job|vacancy|position|role|description|posting|описание|вакансия|должност)[\s\S]{0,40}(?:in|на)\s+(?:english|английск)|(?:english|английск)[\s\S]{0,25}(?:job|vacancy|description|posting|описание|вакансия)/i
    .test(context);
}

/** Explicit requirement phrasing near the language mention */
function hasExplicitRequirementContext(context: string, langKey: string): boolean {
  if (isUiNoise(context) || isPostingLanguageNote(context)) return false;

  const signals = [
    /languages?\s*[:\-–]/,
    /language requirements?/,
    /язык(и)?\s*[:\-–]/,
    /языковые требования/,
    /must speak/,
    /fluent in/,
    /native speaker/,
    /носитель/,
    /обязательн/,
    /необходим/,
    /требуется/,
    /владение/,
    /знание\s+языка/,
    /proficiency/,
    /required/,
    /\bb[12]\b/,
    /\bc[12]\b/,
    /upper[- ]intermediate/,
    /advanced/,
    /свободн(?:ое|ый|о)?\s+(?:владение|знание)/,
  ];

  if (signals.some((r) => r.test(context))) return true;

  const langWord = langKey === "german"
    ? "german|deutsch|немецк"
    : langKey === "french"
    ? "french|français|французск"
    : langKey === "english"
    ? "english|английск"
    : langKey;

  const paired = new RegExp(
    `(?:${langWord})[\\s\\S]{0,45}(?:b[12]|c[12]|fluent|native|required|proficiency|обязательн|свободн|владение)|` +
      `(?:b[12]|c[12]|fluent|native|required|proficiency|обязательн|свободн|владение)[\\s\\S]{0,45}(?:${langWord})`,
    "i",
  );
  return paired.test(context);
}

function parseMinCefr(snippet: string, langKey: string): number {
  const s = snippet.toLowerCase();
  if (/native|родной|носитель|bilingual|двуязыч/i.test(s)) return 6;
  if (/\bc2\b|proficiency.*c2/i.test(s)) return 6;
  if (/\bc1\b|advanced|upper[- ]intermediate/i.test(s)) return 5;
  if (/\bb2\b|fluent|business|рабоч/i.test(s)) return 4;
  if (/\bb1\b|intermediate|средн/i.test(s)) return 3;
  if (/\ba2\b/i.test(s)) return 2;
  if (/\ba1\b|basic|beginner|базов|начальн/i.test(s)) return 1;
  if (langKey === "english") return 4;
  if (STRICT_BLOCKER_LANGS.has(langKey)) return 4;
  return 0; // no level inferred — do not create gap without explicit level
}

function shouldCountRequirement(
  langKey: string,
  context: string,
  minCefr: number,
): boolean {
  if (STRICT_BLOCKER_LANGS.has(langKey)) {
    return hasExplicitRequirementContext(context, langKey) ||
      /китайsk|mandarin|chinese|японsk|japanese|корейsk|korean|арабsk|arabic|испанsk|spanish/i.test(context);
  }
  if (CONTEXT_SENSITIVE_LANGS.has(langKey)) {
    if (!hasExplicitRequirementContext(context, langKey)) return false;
    // English mentioned only as posting language — OK for C1 candidate
    if (langKey === "english" && isPostingLanguageNote(context) && minCefr < 6) {
      return false;
    }
    return minCefr > 0;
  }
  return false;
}

export function detectLanguageRequirements(vacancy: string): LangRequirement[] {
  const found: LangRequirement[] = [];

  for (const def of LANG_DEFS) {
    for (const pattern of def.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      let match: RegExpExecArray | null;
      while ((match = re.exec(vacancy)) !== null) {
        const idx = match.index ?? 0;
        const context = getContextWindow(vacancy, idx, 120);
        const minCefr = parseMinCefr(context, def.key);
        if (!shouldCountRequirement(def.key, context, minCefr)) continue;

        const required = /must|required|обязательн|essential|необходим|fluent|native|nositel|требуется/i
          .test(context) || minCefr >= 4;

        if (!found.some((f) => f.lang === def.key)) {
          found.push({
            lang: def.key,
            displayName: def.displayName,
            minCefr: minCefr || (def.key === "english" ? 4 : 4),
            required,
          });
        }
        break;
      }
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
        `${req.displayName} required (${needLabel}+) - not in candidate profile`;
      language_gaps.push(msg);
      if (req.required || req.minCefr >= 4) {
        hard_blockers.push(msg);
        matchPenalty += 30;
        fitHint = "poor_fit";
      } else {
        matchPenalty += 10;
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
        fitHint = fitHint ?? "conditional_fit";
      } else if (["german", "french"].includes(req.lang) && req.minCefr >= 4) {
        language_gaps.push(`${req.displayName}: B1 now; can study toward B2 if needed`);
        matchPenalty += req.required ? 12 : 6;
        fitHint = fitHint ?? "conditional_fit";
      } else if (req.required) {
        matchPenalty += 8;
        fitHint = fitHint ?? "conditional_fit";
      }
    }
  }

  return { language_gaps, hard_blockers, matchPenalty, fitHint };
}

const LANGUAGE_CONCERN =
  /\b(chinese|mandarin|japanese|korean|arabic|spanish|german|french|english|finnish|afrikaans|китайск|немецк|французск|английск|японsk|корейsk)\b|language gap|blocker:/i;

/** Remove LLM-invented language concerns when vacancy has no explicit requirement */
export function filterLlmLanguageNoise(
  concerns: string[],
  deterministicGaps: string[],
): string[] {
  if (deterministicGaps.length > 0) return concerns;
  return concerns.filter((c) => !LANGUAGE_CONCERN.test(c));
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
  const deterministicGaps = adj.language_gaps;

  const filteredConcerns = filterLlmLanguageNoise(
    result.expected_concerns ?? [],
    deterministicGaps,
  );
  const concerns = new Set(filteredConcerns);
  for (const g of deterministicGaps) concerns.add(g);
  for (const b of adj.hard_blockers) concerns.add(`Blocker: ${b}`);

  let match = result.match_percent;
  if (adj.matchPenalty > 0) {
    match = Math.max(5, match - adj.matchPenalty);
  }

  let fit_verdict = result.fit_verdict ?? "strong_fit";
  if (adj.hard_blockers.length) {
    fit_verdict = "poor_fit";
  } else if (deterministicGaps.length) {
    fit_verdict = adj.fitHint ?? "conditional_fit";
  } else if (fit_verdict === "poor_fit" || fit_verdict === "conditional_fit") {
    // LLM over-flagged languages — reset unless other concerns justify it
    const nonLangConcerns = filteredConcerns.filter((c) => !LANGUAGE_CONCERN.test(c));
    fit_verdict = nonLangConcerns.length ? "conditional_fit" : "strong_fit";
  }

  return {
    ...result,
    match_percent: match,
    expected_concerns: [...concerns],
    language_gaps: deterministicGaps,
    hard_blockers: adj.hard_blockers,
    fit_verdict,
  };
}
