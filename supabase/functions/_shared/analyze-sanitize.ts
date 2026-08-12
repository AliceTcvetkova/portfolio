/** Remove LLM false positives: JD requirements echoed as candidate highlights. */

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
  /\bnot (commercial|studio)\b/i,
  /\bearly payments\b/i,
  /\bplatform (launch|pilot)\b/i,
  /\bdelivery governance\b/i,
  /\bprocess audit\b/i,
];

/** Claims that need explicit evidence or personal-learning qualifier */
const FALSE_HIGHLIGHT_PATTERNS: RegExp[] = [
  /proven track record/i,
  /strong game design/i,
  /deep understanding of player motivation/i,
  /\bgame economy\b/i,
  /\blive (casual|ops|game|service)\b/i,
  /owning and growing successful/i,
  /successful live casual/i,
  /player motivation.*progression/i,
  /progression.*game economy/i,
  /monetization.*(expert|proven|track record|ownership)/i,
  /shipped (commercial|live|mobile|successful) game/i,
  /years (of |in )?(the )?game (industry|studio)/i,
  /owning and growing/i,
  /growing successful/i,
  /feature design.*(player|game)/i,
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
    pattern: /player motivation|progression.*economy|meta.?progression|feature design/i,
    message:
      "Advanced game design (motivation/economy/feature design) — personal learning only, not shipped live titles",
  },
  {
    pattern: /proven track record.*(game|gaming|mobile game|live)/i,
    message: "No proven track record of shipping or growing commercial live games",
  },
  {
    pattern: /strong game design|game design skills/i,
    message:
      "Strong commercial game design track record not in profile — production PM + personal projects only",
  },
  {
    pattern: /owning and growing successful/i,
    message: "No evidence of owning and growing successful live games in profile",
  },
];

const DEFAULT_HIGHLIGHTS = [
  "Cross-functional delivery with 20+ teams (Ozon Bank)",
  "100+ user interviews & platform launch (IRPO)",
  "Production PM: scope, dependencies, risks — transferable to game production teams",
];

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

/** Highlight likely copied from JD if most content words appear in vacancy without candidate evidence */
export function mirrorsVacancyRequirement(vacancy: string, highlight: string): boolean {
  if (hasCandidateEvidence(highlight)) return false;
  const words = tokenizeForOverlap(highlight);
  if (words.length < 3) return false;
  const vLower = vacancy.toLowerCase();
  const matched = words.filter((w) => vLower.includes(w));
  return matched.length / words.length >= 0.55;
}

export function detectGamedevVacancyGaps(vacancy: string): string[] {
  const gaps: string[] = [];
  for (const { pattern, message } of VACANCY_GAMEDEV_GAPS) {
    if (pattern.test(vacancy) && !gaps.includes(message)) gaps.push(message);
  }
  return gaps;
}

export function sanitizeAnalyzeHighlights(
  vacancy: string,
  highlights: string[],
  expected_concerns: string[],
): { highlights: string[]; expected_concerns: string[]; matchPenalty: number } {
  const clean: string[] = [];
  const concerns = new Set(expected_concerns ?? []);
  let matchPenalty = 0;

  for (const h of highlights ?? []) {
    const text = String(h).trim();
    if (!text) continue;

    if (
      (isFalseCapabilityHighlight(text) || mirrorsVacancyRequirement(vacancy, text)) &&
      !hasCandidateEvidence(text)
    ) {
      concerns.add(`Gap — not in profile: ${text}`);
      matchPenalty += 4;
      continue;
    }
    clean.push(text);
  }

  for (const gap of detectGamedevVacancyGaps(vacancy)) {
    if (!concerns.has(gap)) concerns.add(gap);
  }

  const finalHighlights = clean.length > 0 ? clean.slice(0, 5) : DEFAULT_HIGHLIGHTS;

  return {
    highlights: finalHighlights,
    expected_concerns: [...concerns],
    matchPenalty,
  };
}

export function applyAnalyzeSanitization(
  vacancy: string,
  result: AnalyzeResult,
): AnalyzeResult {
  const sanitized = sanitizeAnalyzeHighlights(
    vacancy,
    result.highlights ?? [],
    result.expected_concerns ?? [],
  );

  let match = result.match_percent;
  if (sanitized.matchPenalty > 0) {
    match = Math.max(5, match - sanitized.matchPenalty);
  }

  let fit_verdict = result.fit_verdict ?? "strong_fit";
  const hasGamedevGaps = detectGamedevVacancyGaps(vacancy).length > 0;
  const removedManyHighlights =
    (result.highlights?.length ?? 0) > 0 &&
    sanitized.highlights.length < (result.highlights?.length ?? 0);

  if (hasGamedevGaps && removedManyHighlights && fit_verdict === "strong_fit") {
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
