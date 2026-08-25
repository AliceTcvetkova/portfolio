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
  Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-20b";
const GROQ_CV_MODEL =
  Deno.env.get("GROQ_CV_MODEL") ?? "openai/gpt-oss-120b";
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
  const model = opts.model ?? GROQ_MODEL;
  const useJsonMode = !model.includes("gpt-oss");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 2048,
      ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (
      res.status === 404 ||
      /model.*(not found|does not exist|decommissioned|deprecated)/i.test(err)
    ) {
      throw new Error(
        `Groq model unavailable (${model}). Update GROQ_MODEL/GROQ_CV_MODEL secrets to openai/gpt-oss-20b and openai/gpt-oss-120b, then redeploy.`,
      );
    }
    if (err.includes("max completion tokens") || err.includes("json_validate_failed")) {
      throw new Error(`Groq request rejected (${model}): ${err.slice(0, 220)}`);
    }
    if (isGroqTokenLimitError(err)) {
      throw new Error(
        "Groq token limit — vacancy or profile context is too large. Paste a shorter job description or retry in a minute.",
      );
    }
    throw new Error(`Groq error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    const reason = json.choices?.[0]?.finish_reason ?? "unknown";
    throw new Error(`Groq returned empty content (${model}, finish=${reason})`);
  }
  return content;
}

function isGroqTokenLimitError(err: string): boolean {
  return (
    err.includes("rate_limit_exceeded") ||
    err.includes("Request too large") ||
    err.includes("tokens per minute") ||
    err.includes("context_length") ||
    err.includes("too many tokens") ||
    err.includes("payload too large") ||
    err.includes("reduce the length") ||
    err.includes("\"code\":\"rate_limit_exceeded\"")
  );
}

function isRetryableGroqLimit(msg: string): boolean {
  return msg.includes("Groq token limit") || isGroqTokenLimitError(msg);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PromptScale = "compact" | "minimal";

async function chatGroqAnalyze(
  system: string,
  buildUser: (scale: PromptScale) => string,
): Promise<string> {
  const attempts: { scale: PromptScale; maxTokens: number; delayMs: number }[] = [
    { scale: "compact", maxTokens: 1024, delayMs: 0 },
    { scale: "minimal", maxTokens: 768, delayMs: 1500 },
  ];

  let lastErr: unknown;
  for (const { scale, maxTokens, delayMs } of attempts) {
    if (delayMs > 0) await sleep(delayMs);
    try {
      return await chatGroq(system, buildUser(scale), { maxTokens, model: GROQ_MODEL });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isRetryableGroqLimit(msg)) throw e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Groq token limit — wait a minute and retry with a shorter job description.");
}

async function chatGroqCv(system: string, user: string, compactUser: string): Promise<string> {
  try {
    return await chatGroq(system, user, { maxTokens: 2048, model: GROQ_CV_MODEL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isRetryableGroqLimit(msg)) throw e;
    await sleep(1500);
    return chatGroq(system, compactUser, { maxTokens: 1536, model: GROQ_CV_MODEL });
  }
}

async function chat(
  system: string,
  user: string | ((scale: PromptScale) => string) | { normal: string; compact: string },
  action: "analyze" | "get_cv" = "analyze",
): Promise<string> {
  if (LLM_PROVIDER === "groq") {
    if (action === "get_cv") {
      const prompts = user as { normal: string; compact: string };
      return chatGroqCv(system, prompts.normal, prompts.compact);
    }
    return chatGroqAnalyze(system, user as (scale: PromptScale) => string);
  }
  if (GEMINI_API_KEY) {
    const userText = typeof user === "function"
      ? user("compact")
      : (user as { normal: string }).normal;
    return chatGemini(system, userText);
  }
  if (GROQ_API_KEY) {
    if (action === "get_cv") {
      const prompts = user as { normal: string; compact: string };
      return chatGroqCv(system, prompts.normal, prompts.compact);
    }
    return chatGroqAnalyze(system, user as (scale: PromptScale) => string);
  }
  throw new Error(
    "No LLM key configured. Set GROQ_API_KEY (recommended for RU) or GEMINI_API_KEY in Supabase Secrets.",
  );
}

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```json?\n?/i, "").replace(/\n?```$/, "");
  if (!trimmed) throw new Error("LLM returned empty response — retry in a moment.");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("LLM returned invalid JSON — retry or paste a shorter vacancy.");
  }
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

const CORE_PROJECT_IDS = ["ozon", "irpo", "vk", "erich_krause"];

function selectProjectsForAnalyze(
  projects: { id: string; content: string }[],
  vacancyText: string,
  maxCount: number,
): { id: string; content: string }[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const picked = new Map<string, { id: string; content: string }>();

  for (const id of CORE_PROJECT_IDS) {
    const project = byId.get(id);
    if (project) picked.set(id, project);
  }

  const vLower = vacancyText.toLowerCase();
  const extras = projects
    .filter((p) => !picked.has(p.id))
    .map((p) => {
      const text = stripFrontmatter(p.content).toLowerCase();
      const words = text.split(/\W+/).filter((w) => w.length > 4);
      const score = words.filter((w) => vLower.includes(w)).length;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { p } of extras) {
    if (picked.size >= maxCount) break;
    picked.set(p.id, p);
  }

  if (isGamedevVacancy(vacancyText)) {
    for (const id of ["locus_chamber", "eco_clean_map"]) {
      const project = byId.get(id);
      if (project && !picked.has(id) && picked.size < maxCount) picked.set(id, project);
    }
  }

  return [...picked.values()];
}

/** Groq free tier: input + max_tokens must stay under ~8k TPM per request. */
function buildAnalyzeUserPrompt(
  knowledge: Knowledge,
  vacancyText: string,
  scale: PromptScale = "compact",
): string {
  const limits = scale === "minimal"
    ? { vacancy: 1200, profile: 450, projects: 900, projectEach: 110, gamedev: 280, projectCount: 4 }
    : { vacancy: 1800, profile: 650, projects: 1300, projectEach: 150, gamedev: 450, projectCount: 6 };

  const vacancy = compactText(vacancyText, limits.vacancy);
  const profile = compactText(stripFrontmatter(knowledge.profile), limits.profile);
  const projects = selectProjectsForAnalyze(knowledge.projects, vacancyText, limits.projectCount)
    .map((p) => `${p.id}: ${compactProjectSummary(p.content, limits.projectEach)}`)
    .join("\n")
    .slice(0, limits.projects);

  let prompt =
    `Vacancy:\n${vacancy}\n\nProfile:\n${profile}\n\nProjects:\n${projects}`;

  if (isGamedevVacancy(vacancyText) && knowledge.gamedev_positioning) {
    prompt += `\n\nGamedev:\n${compactText(knowledge.gamedev_positioning, limits.gamedev)}`;
  }

  return prompt;
}

function buildCvUserPrompt(
  knowledge: Knowledge,
  vacancyText: string,
  variant: string,
  scale: "normal" | "compact",
): string {
  const limits = scale === "compact"
    ? { vacancy: 1600, cv: 2600, hints: 400, gamedev: 900, gameProjects: 500 }
    : { vacancy: 2400, cv: 3400, hints: 600, gamedev: 1400, gameProjects: 700 };

  const baseCv = variant === "russia" ? knowledge.cv_ru : knowledge.cv_en;
  const langNote = variant === "russia"
    ? "Write CV content in Russian (section content and bullets)."
    : "Write CV content in English.";

  let prompt =
    `Variant: ${langNote}\n\nVacancy:\n${compactText(vacancyText, limits.vacancy)}\n\nBase CV:\n${compactText(baseCv, limits.cv)}\n\nHints:\n${compactText(knowledge.portfolio_sync || "", limits.hints)}`;

  if (isGamedevVacancy(vacancyText)) {
    prompt +=
      `\n\nGamedev:\n${compactText(knowledge.gamedev_positioning || "", limits.gamedev)}\n\nGame projects:\n${compactText(knowledge.game_development_projects || "", limits.gameProjects)}`;
  }

  return prompt;
}

const ANALYZE_SYSTEM = `Match vacancy to candidate using ONLY profile/projects. Never invent facts. locus_chamber/eco_clean_map = educational demos, not employment.

highlights = strengths WITH evidence (company, metric, transferable). Never copy JD requirements into highlights.
expected_concerns = REAL gaps only. Do NOT flag if profile covers: Jira, 0→1, platform PM, B2B, 10+ yrs PM, data-driven, transformation, tech (VK/Ozon/IRPO), security OR technology.
Game dev: production PM transfer only — no commercial studio/live game claims.
Languages: RU native; EN C1; DE/FR B1. language_gaps only if JD explicitly requires a language.
Return JSON only:
{"title":"","company":"","language":"ru|en","match_percent":0,"fit_verdict":"strong_fit|conditional_fit|poor_fit","highlights":[],"expected_concerns":[],"language_gaps":[],"hard_blockers":[],"cv_sections_to_boost":[],"matched_projects":[]}`;

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
    const vacancySlice = resolved.text.slice(0, 6000);

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

    const cvUserPrompt = {
      normal: buildCvUserPrompt(knowledge, vacancySlice, variant, "normal"),
      compact: buildCvUserPrompt(knowledge, vacancySlice, variant, "compact"),
    };

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
