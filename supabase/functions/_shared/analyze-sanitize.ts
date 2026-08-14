/** Remove LLM false positives: JD requirements echoed as highlights or false gaps. */

import type { AnalyzeResult } from "./language-match.ts";

const EVIDENCE_MARKERS: RegExp[] = [
  /\bozon\b/i,
  /\birpo\b/i,
  /\bvk\b/i,
  /\berich\b/i,
  /\bkrause\b/i,
  /\bconsulting\b/i,
  /\bvtb\b/i,
  /\bparadise\b/i,
  /\bmaison\b/i,
  /\bvictor sport\b/i,
  /\b20\+?\s*teams?\b/i,
  /\b100\+?\s*(user|interview|custdev)/i,
  /\b9[\-\s]?months?\b/i,
  /\b~?\s*20\s*m(?:illion|rub|ln)/i,
  /\bcross[\-\s]?functional/i,
  /\bfintech\b/i,
  /\bedtech\b/i,
  /\bgovtech\b/i,
  /\bcase study\b/i,
  /\bpersonal (project|learning)\b/i,
  /\bportfolio\b/i,
  /\btransferable\b/i,
  /\btransition(ing)?\s+(into|to)\b/i,
  /\bgame development projects\b/i,
  /\bearly payments\b/i,
  /\bplatform\b/i,
  /\blaunch\b/i,
  /\bjira\b/i,
  /\bconfluence\b/i,
  /\bb2b\b/i,
  /\bzero to (one|production)\b/i,
  /\b0→1\b/i,
  /\bconcept.*pilot\b/i,
  /\bdelivery governance\b/i,
  /\bprocess audit\b/i,
  /\bdata-driven\b/i,
  /\bmeasurable\b/i,
  /\btransformation\b/i,
  /\bscaling\b/i,
  /\b10\+?\s*years?\b/i,
  /\bprogram management\b/i,
  /\bproject management\b/i,
  /\bdigital product\b/i,
  /\btechnology\b/i,
  /\bfintech\b/i,
  /\bit ecosystem\b/i,
];

/** Only block highlights that claim commercial game outcomes not in profile */
const FALSE_HIGHLIGHT_PATTERNS: RegExp[] = [
  /proven track record.*(live|game|casual|mobile game)/i,
  /strong game design/i,
  /deep understanding of player motivation/i,
  /\bgame economy\b/i,
  /\blive (casual|ops|game|service)\b/i,
  /owning and growing successful/i,
  /successful live casual/i,
  /player motivation.*progression.*economy/i,
  /monetization.*(expert|proven|track record|ownership)/i,
  /shipped (commercial|live|mobile|successful) game/i,
  /years (of |in )?(the )?game (industry|studio)/i,
];

const VACANCY_GAMEDEV_GAPS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /live casual|live ops|live game|games as a service|live service/i,
    message: "No commercial live casual / live ops ownership in profile",
  },
  {
    pattern: /game economy|monetization design|in-app purchase|\biap\b|f2p economy/i,
    message: "No proven game economy / monetization ownership in profile",
  },
  {
    pattern: /player motivation.*(economy|monetization)|game economy.*player/i,
    message:
      "Advanced live game economy / motivation design — personal learning only, not commercial live titles",
  },
  {
    pattern: /proven track record.*(game|gaming|mobile game|live)/i,
    message: "No proven track record of shipping or growing commercial live games",
  },
  {
    pattern: /strong game design skills|deep game design/i,
    message:
      "Strong commercial game design track record not in profile — production PM + personal projects only",
  },
  {
    pattern: /owning and growing successful/i,
    message: "No evidence of owning and growing successful live games in profile",
  },
];

/** If concern matches left side and profile matches right — not a real gap */
const CAPABILITY_RULES: { concern: RegExp; profile: RegExp }[] = [
  { concern: /\bjira\b/i, profile: /\bjira\b/i },
  { concern: /\bconfluence\b/i, profile: /\bconfluence\b/i },
  {
    concern: /zero to one|0 to 1|0→1|from zero|from scratch|launching products or platforms/i,
    profile: /zero to production|concept.*pilot|from (zero|concept)|9 month|launch|0→1/i,
  },
  {
    concern: /platform-as-a-service|platform as a service|\bpaas\b|platform environments/i,
    profile: /\bplatform\b|irpo|vk|professionalitet/i,
  },
  {
    concern: /digital commerce|e-?commerce|marketplace/i,
    profile: /ozon|fintech|marketplace|e-?commerce|fmcg|seller/i,
  },
  {
    concern: /\bb2b\b.*saas|b2b saas|saas/i,
    profile: /\bb2b\b|saas|consulting|stakeholder|enterprise/i,
  },
  {
    concern: /customer success|partner-facing|partner programs/i,
    profile: /stakeholder|custdev|user interview|consulting|partner|b2b|vtb/i,
  },
  {
    concern: /documentation|tracking.*reporting/i,
    profile: /jira|confluence|documentation|reporting|backlog|roadmap/i,
  },
  {
    concern: /program or project management|project management experience|program management experience/i,
    profile: /product manager|project manager|delivery manager|program|10\+?\s*years?|10\+ лет/i,
  },
  {
    concern: /program transformation|scaling|redesign|transform initiatives/i,
    profile: /unified|scal|120\+|20\+ team|methodology|process|transformation|redesign|audit|workflow/i,
  },
  {
    concern: /data-driven|measurable results|measurable impact|measurable outcome/i,
    profile: /data-driven|measurable|metrics|измерим|kpi|okr|turnover|результат|\+\d+%/i,
  },
  {
    concern: /technology|tech company|tech environment|digital product|software|IT ecosystem/i,
    profile: /technology|tech |fintech|edtech|platform|digital product|IT ecosystem|it-?экосистем|vk|ozon|irpo|python|sql/i,
  },
  {
    concern: /security|infosec|cybersecurity|cyber security/i,
    profile: /fintech|risk|infosec|compliance|governance|regulatory|44-fz|legal|security|контрол|риск/i,
  },
  {
    concern: /security or technology|technology or security/i,
    profile: /fintech|edtech|platform|digital|technology|tech |IT ecosystem|vk|ozon|irpo|risk|governance/i,
  },
];

const OR_SEGMENT_PROFILE: { segment: RegExp; profile: RegExp }[] = [
  { segment: /gaming|game dev|game industry/i, profile: /gamedev|game development|locus|eco_clean|personal.*game/i },
  { segment: /digital commerce|e-?commerce|commerce/i, profile: /ozon|fintech|marketplace|commerce|fmcg/i },
  { segment: /platform/i, profile: /platform|irpo|vk|govtech|edtech platform/i },
  { segment: /saas/i, profile: /b2b|saas|consulting|stakeholder/i },
  { segment: /customer success/i, profile: /stakeholder|custdev|user interview|consulting/i },
  { segment: /jira/i, profile: /jira/i },
  { segment: /confluence/i, profile: /confluence/i },
  {
    segment: /technology|tech\b|digital product|software|IT/i,
    profile: /technology|tech |fintech|edtech|platform|digital|IT ecosystem|it-?экосистем|vk|ozon|irpo|python|sql/i,
  },
  {
    segment: /security|infosec|cyber/i,
    profile: /fintech|risk|infosec|compliance|governance|regulatory|44-fz|legal|security|риск/i,
  },
];

const DEFAULT_HIGHLIGHTS = [
  "Cross-functional delivery with 20+ teams (Ozon Bank)",
  "100+ user interviews & platform 0→1 launch (IRPO)",
  "Production PM: scope, dependencies, risks — transferable across product teams",
];

export function isGamedevVacancy(text: string): boolean {
  return /game|gaming|gamedev|game dev|gameplay|game producer|game project|unity|unreal|mobile game|game studio/i.test(
    text,
  );
}

export function hasCandidateEvidence(text: string): boolean {
  return EVIDENCE_MARKERS.some((p) => p.test(text));
}

export function isFalseCapabilityHighlight(text: string): boolean {
  return FALSE_HIGHLIGHT_PATTERNS.some((p) => p.test(text));
}

function tokenizeForOverlap(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
}

export function mirrorsVacancyRequirement(vacancy: string, highlight: string): boolean {
  if (hasCandidateEvidence(highlight)) return false;
  const words = tokenizeForOverlap(highlight);
  if (words.length < 4) return false;
  const vLower = vacancy.toLowerCase();
  const matched = words.filter((w) => vLower.includes(w));
  return matched.length / words.length >= 0.65;
}

export function detectGamedevVacancyGaps(vacancy: string): string[] {
  if (!isGamedevVacancy(vacancy)) return [];
  const gaps: string[] = [];
  for (const { pattern, message } of VACANCY_GAMEDEV_GAPS) {
    if (pattern.test(vacancy) && !gaps.includes(message)) gaps.push(message);
  }
  return gaps;
}

function stripGapPrefix(text: string): string {
  return text.replace(/^Gap\s*[—-]\s*not in profile:\s*/i, "").trim();
}

/** JD asks for N years PM; profile has 10+ */
function yearsRequirementMet(concern: string, profile: string): boolean {
  const m = concern.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  if (!m) return false;
  const required = parseInt(m[1], 10);
  if (Number.isNaN(required)) return false;
  if (/10\+?\s*(?:years?|yrs?)|10\+ лет|experience_years:\s*10|10\+ years/i.test(profile)) {
    return required <= 10;
  }
  const have = profile.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  if (have) return parseInt(have[1], 10) >= required;
  return false;
}

/** LLM pasted JD requirement bullets into concerns (not real gaps) */
function isJdRequirementBullet(text: string): boolean {
  const t = stripGapPrefix(text);
  return (
    /^\d+\+?\s*years?.*(experience|program|project|management)/i.test(t) ||
    /^experience (leading|with|in|launching|driving)/i.test(t) ||
    /^proven experience|^background in|^familiarity with|^strong experience/i.test(t) ||
    /^track record of/i.test(t)
  );
}

function profileSupportsConcern(concern: string, profile: string): boolean {
  const inner = stripGapPrefix(concern.toLowerCase());
  const p = profile.toLowerCase();

  if (yearsRequirementMet(inner, profile)) return true;

  for (const { concern: cp, profile: pp } of CAPABILITY_RULES) {
    if (cp.test(inner) && pp.test(p)) return true;
  }

  if (/\bor\b|,/.test(inner)) {
    const parts = inner.split(/\bor\b|,/);
    if (parts.some((part) => {
      const seg = part.trim();
      if (!seg) return false;
      return OR_SEGMENT_PROFILE.some(({ segment, profile: sp }) =>
        segment.test(seg) && sp.test(p)
      );
    })) {
      return true;
    }
  }

  // Generic PM phrases echoed from JD without "missing" language
  if (isJdRequirementBullet(concern)) {
    const keywords = tokenizeForOverlap(inner).filter((w) =>
      !["experience", "leading", "proven", "years", "program", "project", "management", "initiatives"].includes(w)
    );
    if (keywords.length >= 2) {
      const matched = keywords.filter((w) => p.includes(w));
      if (matched.length / keywords.length >= 0.45) return true;
    }
    if (/program|project|management|transformation|scaling|data-driven|measurable/.test(inner) &&
      /product manager|project manager|delivery|10\+|ozon|irpo|data-driven|measurable/.test(p)) {
      return true;
    }
  }

  return false;
}

/** LLM sometimes lists JD bullets as concerns — drop if profile already covers them */
export function filterFalseConcerns(
  concerns: string[],
  profileContext: string,
): string[] {
  return concerns.filter((raw) => {
    const text = String(raw).trim();
    if (!text) return false;
    if (profileSupportsConcern(text, profileContext)) return false;
    return true;
  });
}

export function sanitizeAnalyzeHighlights(
  vacancy: string,
  highlights: string[],
  expected_concerns: string[],
  profileContext = "",
): { highlights: string[]; expected_concerns: string[]; matchPenalty: number } {
  const clean: string[] = [];
  const concerns = new Set(expected_concerns ?? []);
  let matchPenalty = 0;

  for (const h of highlights ?? []) {
    const text = String(h).trim();
    if (!text) continue;

    const falseGameClaim = isFalseCapabilityHighlight(text) && !hasCandidateEvidence(text);
    const jdEcho =
      mirrorsVacancyRequirement(vacancy, text) &&
      !hasCandidateEvidence(text) &&
      !profileSupportsConcern(text, profileContext);

    if (falseGameClaim || jdEcho) {
      if (!profileSupportsConcern(text, profileContext)) {
        concerns.add(`Gap — not in profile: ${text}`);
        matchPenalty += 4;
      }
      continue;
    }
    clean.push(text);
  }

  for (const gap of detectGamedevVacancyGaps(vacancy)) {
    if (!profileSupportsConcern(gap, profileContext)) concerns.add(gap);
  }

  const filteredConcerns = filterFalseConcerns([...concerns], profileContext);

  const finalHighlights = clean.length > 0 ? clean.slice(0, 5) : DEFAULT_HIGHLIGHTS;

  return {
    highlights: finalHighlights,
    expected_concerns: filteredConcerns,
    matchPenalty,
  };
}

export function applyAnalyzeSanitization(
  vacancy: string,
  result: AnalyzeResult,
  profileContext = "",
): AnalyzeResult {
  const sanitized = sanitizeAnalyzeHighlights(
    vacancy,
    result.highlights ?? [],
    result.expected_concerns ?? [],
    profileContext,
  );

  let match = result.match_percent;
  if (sanitized.matchPenalty > 0) {
    match = Math.max(5, match - sanitized.matchPenalty);
  }

  let fit_verdict = result.fit_verdict ?? "strong_fit";
  const gamedevGaps = detectGamedevVacancyGaps(vacancy).filter(
    (g) => !profileSupportsConcern(g, profileContext),
  );
  const removedManyHighlights =
    (result.highlights?.length ?? 0) > 0 &&
    sanitized.highlights.length < (result.highlights?.length ?? 0);

  if (gamedevGaps.length > 0 && removedManyHighlights && fit_verdict === "strong_fit") {
    fit_verdict = "conditional_fit";
  }

  return {
    ...result,
    match_percent: match,
    highlights: sanitized.highlights,
    expected_concerns: sanitized.expected_concerns,
    fit_verdict,
  };
}
