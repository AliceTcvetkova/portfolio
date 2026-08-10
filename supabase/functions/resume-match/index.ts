import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { applyLanguageAdjustments, type AnalyzeResult } from "../_shared/language-match.ts";
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
    throw new Error(`Groq error: ${res.status} ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function chatGroqAnalyze(system: string, user: string): Promise<string> {
  return chatGroq(system, user, { maxTokens: 2048, model: GROQ_MODEL });
}

async function chatGroqCv(system: string, user: string): Promise<string> {
  return chatGroq(system, user, { maxTokens: 8192, model: GROQ_CV_MODEL });
}

async function chat(
  system: string,
  user: string,
  action: "analyze" | "get_cv" = "analyze",
): Promise<string> {
  if (LLM_PROVIDER === "groq") {
    return action === "get_cv"
      ? chatGroqCv(system, user)
      : chatGroqAnalyze(system, user);
  }
  if (GEMINI_API_KEY) {
    return chatGemini(system, user);
  }
  if (GROQ_API_KEY) {
    return action === "get_cv"
      ? chatGroqCv(system, user)
      : chatGroqAnalyze(system, user);
  }
  throw new Error(
    "No LLM key configured. Set GROQ_API_KEY (recommended for RU) or GEMINI_API_KEY in Supabase Secrets.",
  );
}

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(trimmed) as T;
}

/** One LLM call for analyze — saves free-tier quota */
const ANALYZE_SYSTEM = `You analyze a job vacancy and match it to a candidate using ONLY the provided knowledge base and language rules.
Never invent experience or language levels. case_study projects (locus_chamber, eco_clean_map) are educational — skills demo only, not employment years.

LANGUAGE RULES (critical):
- Candidate: Russian native; English C1 (NOT C2/native); German B1; French B1; Finnish & Afrikaans elementary only.
- ONLY flag language_gaps / hard_blockers if the VACANCY TEXT explicitly requires that language (requirements section, fluent/native/B level, "must speak X").
- Do NOT flag German, French, or English if the vacancy does not mention them as requirements.
- Do NOT treat site navigation ("Deutsch | Français") or "job description in English" as language requirements.
- Candidate's optional B1 DE/FR are NOT gaps unless the job asks for DE/FR.
- Missing languages (Chinese, Japanese, etc.) → poor_fit only when explicitly required in vacancy.

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
    const projectsText = knowledge.projects.map((p) => p.content).join("\n\n---\n\n");
    const vacancySlice = resolved.text.slice(0, 10000);

    if (action === "analyze") {
      const raw = parseJson<AnalyzeResult>(
        await chat(
          ANALYZE_SYSTEM,
          `## Vacancy\n${vacancySlice}\n\n## Language rules\n${(knowledge.languages || "").slice(0, 2000)}\n\n## Profile\n${knowledge.profile.slice(0, 3500)}\n\n## Projects\n${projectsText.slice(0, 6000)}`,
          "analyze",
        ),
      );
      const result = applyLanguageAdjustments(vacancySlice, raw);

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
      `## Variant\n${langNote}\n\n## Vacancy\n${vacancySlice.slice(0, 4000)}\n\n## Base CV (adapt — do not add roles not listed here)\n${baseCv}\n\n## Tailoring hints\n${(knowledge.portfolio_sync || "").slice(0, 800)}`;

    type CvPayload = {
      full_name?: string;
      headline?: string;
      contact_line?: string;
      summary?: string;
      experience?: Array<{ role?: string; company?: string; dates?: string; bullets?: string[] }>;
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
