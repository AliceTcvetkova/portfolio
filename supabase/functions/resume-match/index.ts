import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { applyLanguageAdjustments, type AnalyzeResult } from "../_shared/language-match.ts";
import { applyAnalyzeSanitization } from "../_shared/analyze-sanitize.ts";
import { isVacancyUrl, resolveVacancyInput } from "../_shared/fetch-vacancy.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") ?? (GEMINI_API_KEY ? "gemini" : "groq");
const GEMINI_MODEL =
  Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash-lite";
const GROQ_MODEL =
  Deno.env.get("GROQ_MODEL") ?? "llama-3.1-8b-instant";
const GROQ_CV_MODEL =
  Deno.env.get("GROQ_CV_MODEL") ?? "llama-3.3-70b-versatile";
const KNOWLEDGE_URL =
  Deno.env.get("RESUME_KNOWLEDGE_URL") ??
  "https://alicetcvetkova.github.io/portfolio/data/resume-knowledge.json";

type Knowledge = {
  profile: string;
  cv_ru: string;
  cv_en: string;
  ats_rules: string;
  recruiter_rules: string;
  portfolio_sync?: string;
  market_positioning?: string;
  gamedev_positioning?: string;
  game_development_projects?: string;
  languages?: string;
  projects: { id: string; content: string }[];
};

let knowledgeCache: { data: Knowledge; at: number } | null = null;

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

async function chatGemini(system: string, user: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not set");
  }
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      throw new Error("Gemini free quota exceeded — try again in a minute");
    }
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function chatGroq(
  system: string,
  user: string,
  opts: { maxTokens?: number; model?: string } = {},
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set");
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? GROQ_MODEL,
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (err.includes("max completion tokens") || err.includes("json_validate_failed")) {
      throw new Error(
        "CV generation hit token limit — retry in a moment or paste a shorter vacancy excerpt.",
      );
    }
    if (isGroqTokenLimitError(err)) {
      throw new Error(
        "Groq token limit — vacancy or profile context is too large. Paste a shorter job description or retry in a minute.",
      );
    }
    throw new Error(`Groq error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

function isGroqTokenLimitError(err: string): boolean {
  return (
    err.includes("rate_limit_exceeded") ||
    err.includes("Request too large") ||
    err.includes("tokens per minute") ||
    err.includes("\"code\":\"rate_limit_exceeded\"")
  );
}

async function chatGroqAnalyze(
  system: string,
  buildUser: (scale: "normal" | "compact") => string,
): Promise<string> {
  try {
    return await chatGroq(system, buildUser("normal"), { maxTokens: 1024, model: GROQ_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("Groq token limit") && !isGroqTokenLimitError(msg)) throw e;
    return chatGroq(system, buildUser("compact"), { maxTokens: 768, model: GROQ_MODEL });
  }
}

async function chatGroqCv(system: string, user: string): Promise<string> {
  return chatGroq(system, user, { maxTokens: 8192, model: GROQ_CV_MODEL });
}

async function chat(
  system: string,
  user: string | ((scale: "normal" | "compact") => string),
  action: "analyze" | "get_cv" = "analyze",
): Promise<string> {
  if (LLM_PROVIDER === "groq") {
    return action === "get_cv"
      ? chatGroqCv(system, user as string)
      : chatGroqAnalyze(system, user as (scale: "normal" | "compact") => string);
  }
  if (GEMINI_API_KEY) {
    const userText = typeof user === "function" ? user("normal") : user;
    return chatGemini(system, userText);
  }
  if (GROQ_API_KEY) {
    return action === "get_cv"
      ? chatGroqCv(system, user as string)
      : chatGroqAnalyze(system, user as (scale: "normal" | "compact") => string);
  }
  throw new Error(
    "No LLM key configured. Set GROQ_API_KEY (recommended for RU) or GEMINI_API_KEY in Supabase Secrets.",
  );
}

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(trimmed) as T;
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---[\s\S]*?---\n?/, "").trim();
}

function compactText(text: string, maxLen: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= maxLen ? flat : flat.slice(0, maxLen - 1) + "…";
}

function compactProjectSummary(content: string, maxLen = 280): string {
  return compactText(stripFrontmatter(content), maxLen);
}

function isGamedevVacancy(text: string): boolean {
  return /game|gaming|gamedev|game dev|gameplay|game producer|game project|unity|unreal|studio|level design|liveops/i.test(
    text,
  );
}

/** Keep analyze prompt under Groq free-tier TPM (~6k tokens incl. completion). */
function buildAnalyzeUserPrompt(
  knowledge: Knowledge,
  vacancyText: string,
  scale: "normal" | "compact" = "normal",
): string {
  const limits =
    scale === "compact"
      ? { vacancy: 2200, profile: 800, projects: 1800, projectEach: 180, gamedev: 600 }
      : { vacancy: 3500, profile: 1200, projects: 2800, projectEach: 280, gamedev: 900 };

  const vacancy = compactText(vacancyText, limits.vacancy);
  const profile = compactText(stripFrontmatter(knowledge.profile), limits.profile);
  const projects = knowledge.projects
    .map((p) => `### ${p.id}\n${compactProjectSummary(p.content, limits.projectEach)}`)
    .join("\n\n")
    .slice(0, limits.projects);

  let prompt =
    `## Vacancy\n${vacancy}\n\n## Profile\n${profile}\n\n## Projects (summaries)\n${projects}`;

  if (isGamedevVacancy(vacancyText) && knowledge.gamedev_positioning) {
    prompt += `\n\n## Gamedev positioning\n${compactText(knowledge.gamedev_positioning, limits.gamedev)}`;
  }

  return prompt;
}

/** One LLM call for analyze — keep prompt small for Groq free TPM (6k). */
const ANALYZE_SYSTEM = `Match a job vacancy to the candidate using ONLY the provided profile and project summaries.
Never invent experience. case_study projects (locus_chamber, eco_clean_map) are educational demos, not employment years.

CRITICAL — highlights vs concerns:
- highlights = ONLY candidate strengths WITH evidence (company name, metric, or "personal project/case study/transferable").
- NEVER copy, paraphrase, or flip vacancy requirements into highlights (e.g. "proven live casual games", "strong game design", "game economy" are NOT highlights unless explicitly in profile as commercial work).
- If JD requires live ops, game economy, shipped live casual games, deep game design — put in expected_concerns, NOT highlights.
- expected_concerns = REAL gaps only (missing skills/experience). Do NOT list JD requirement bullets as concerns if candidate profile already covers them (e.g. Jira, 0→1 launches, platform PM, B2B).

For game dev vacancies: emphasize production PM transfer (pipeline, dependencies, risk, scope, cross-functional delivery). Do NOT claim commercial game-studio employment or live game ownership.

Candidate languages: RU native; EN C1 (not C2); DE/FR B1; FI/AF elementary. Flag language_gaps only when vacancy explicitly requires a language.
Return JSON only:
{
  "title": string,
  "company": string,
  "language": "ru" | "en",
  "match_percent": number,
  "fit_verdict": "strong_fit" | "conditional_fit" | "poor_fit",
  "highlights": string[],
  "expected_concerns": string[],
  "language_gaps": string[],
  "hard_blockers": string[],
  "cv_sections_to_boost": string[],
  "matched_projects": string[]
}`;

const CV_SYSTEM = `You tailor a CV using ONLY facts from the provided base CV. Reframe summary and bullets for vacancy keywords. Do not invent facts.
Keep EN CV ~1 page (4-5 roles max, 3-5 bullets on recent role). RU CV ~2 pages max.
ATS-safe single column content.

For game development / Game Producer / production PM in games vacancies:
- Headline: "Game Producer / Project Manager" OR "Product & Delivery Manager transitioning into game development"
- Summary: 10+ years complex digital products + cross-functional teams + recent game dev/design/production focus; optional game dev focus line (desktop games, core loops, retention, player progression)
- Reframe Ozon/IRPO/VK bullets with production language (pipeline, dependencies, risk, scope, concept→release) using gamedev_positioning hints
- Erich Krause: max ~2 bullets — product ownership, international launch, analytics, portfolio, customer understanding
- Add game_development_projects section at bottom (personal, NOT employment) when gamedev positioning is provided
- NEVER invent game studio employment or shipped commercial titles

Include in contact_line or summary footer:
Portfolio: https://alicetcvetkova.github.io/portfolio/
LinkedIn: https://www.linkedin.com/in/alice-tsvetkova

Return JSON only (no markdown):
{
  "full_name": string,
  "headline": string,
  "contact_line": string,
  "summary": string,
  "experience": [{"role": string, "company": string, "dates": string, "bullets": string[]}],
  "game_development_projects": string[],
  "skills": string,
  "education": string[],
  "certifications": string[],
  "languages": string,
  "portfolio_url": "https://alicetcvetkova.github.io/portfolio/",
  "linkedin_url": "https://www.linkedin.com/in/alice-tsvetkova",
  "ats_score": number,
  "notes": string
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action as string;
    const vacancyInput = (body.vacancy as string)?.trim();
    const variant = (body.variant as string) || "international";

    if (!vacancyInput) {
      return json({ error: "Vacancy URL or text is required" }, 400);
    }
    if (!isVacancyUrl(vacancyInput) && vacancyInput.length < 30) {
      return json({ error: "Vacancy text too short (min 30 chars)" }, 400);
    }
    if (!["analyze", "get_cv"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const resolved = await resolveVacancyInput(vacancyInput);
    if (resolved.text.length < 30) {
      return json({
        error: resolved.fetchedFromUrl
          ? "Fetched page had too little text (login wall or empty page). Paste the full job description."
          : "Vacancy text too short (min 30 chars)",
      }, 400);
    }

    const knowledge = await loadKnowledge();
    const vacancySlice = resolved.text.slice(0, 10000);

    if (action === "analyze") {
      const raw = parseJson<AnalyzeResult>(
        await chat(
          ANALYZE_SYSTEM,
          (scale) => buildAnalyzeUserPrompt(knowledge, vacancySlice, scale),
          "analyze",
        ),
      );
      const profileContext = [
        knowledge.profile,
        knowledge.cv_en,
        knowledge.cv_ru,
        (knowledge.gamedev_positioning || "").slice(0, 1500),
      ].join("\n\n").slice(0, 8000);

      const result = applyAnalyzeSanitization(
        vacancySlice,
        applyLanguageAdjustments(vacancySlice, raw),
        profileContext,
      );

      return json({
        match_percent: result.match_percent,
        fit_verdict: result.fit_verdict ?? "strong_fit",
        highlights: result.highlights,
        expected_concerns: result.expected_concerns,
        language_gaps: result.language_gaps ?? [],
        hard_blockers: result.hard_blockers ?? [],
        cv_sections_to_boost: result.cv_sections_to_boost ?? [],
        vacancy_title: (raw as { title?: string }).title,
        vacancy_company: (raw as { company?: string }).company,
        fetched_from_url: resolved.fetchedFromUrl,
        source_url: resolved.sourceUrl ?? null,
      });
    }

    const baseCv = variant === "russia" ? knowledge.cv_ru : knowledge.cv_en;
    const langNote = variant === "russia"
      ? "Write CV content in Russian (section content and bullets)."
      : "Write CV content in English.";

    const cvUserPrompt =
      `## Variant\n${langNote}\n\n## Vacancy\n${vacancySlice.slice(0, 4000)}\n\n## Base CV (adapt — do not add roles not listed here)\n${baseCv}\n\n## Tailoring hints\n${(knowledge.portfolio_sync || "").slice(0, 800)}${
        isGamedevVacancy(vacancySlice)
          ? `\n\n## Gamedev positioning\n${(knowledge.gamedev_positioning || "").slice(0, 2200)}\n\n## Game development projects (personal section)\n${(knowledge.game_development_projects || "").slice(0, 1000)}`
          : ""
      }`;

    type CvPayload = {
      full_name?: string;
      headline?: string;
      contact_line?: string;
      summary?: string;
      experience?: Array<{ role?: string; company?: string; dates?: string; bullets?: string[] }>;
      game_development_projects?: string[];
      skills?: string;
      education?: string[];
      certifications?: string[];
      languages?: string;
      portfolio_url?: string;
      linkedin_url?: string;
      ats_score?: number;
      notes?: string;
      cv_markdown?: string;
    };

    const cvResult = parseJson<CvPayload>(
      await chat(CV_SYSTEM, cvUserPrompt, "get_cv"),
    );

    const { cv_markdown: _legacy, ats_score, notes, ...cvFields } = cvResult;

    return json({
      cv: cvFields,
      ats_score: ats_score ?? 0,
      notes: notes ?? "",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
