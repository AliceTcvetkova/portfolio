import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL =
  Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash-lite";
const KNOWLEDGE_URL =
  Deno.env.get("RESUME_KNOWLEDGE_URL") ??
  "https://alicetcvetkova.github.io/portfolio/data/resume-knowledge.json";

type Knowledge = {
  profile: string;
  cv_ru: string;
  cv_en: string;
  ats_rules: string;
  recruiter_rules: string;
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

async function chat(system: string, user: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured on Supabase (see docs/resume-agent-setup.md)");
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

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(trimmed) as T;
}

/** One LLM call for analyze — saves free-tier quota */
const ANALYZE_SYSTEM = `You analyze a job vacancy and match it to a candidate using ONLY the provided knowledge base.
Never invent experience. case_study projects (locus_chamber, eco_clean_map) are educational — skills demo only, not employment years.
Return JSON only:
{
  "title": string,
  "company": string,
  "language": "ru" | "en",
  "match_percent": number,
  "highlights": string[],
  "expected_concerns": string[],
  "cv_sections_to_boost": string[],
  "matched_projects": string[]
}`;

const CV_SYSTEM = `You tailor a CV in markdown for the vacancy using ONLY facts from the knowledge base.
ATS-safe single-column markdown. No invented metrics. Return JSON only:
{
  "cv_markdown": string,
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
    const vacancy = (body.vacancy as string)?.trim();
    const variant = (body.variant as string) || "international";

    if (!vacancy || vacancy.length < 30) {
      return json({ error: "Vacancy text too short (min 30 chars)" }, 400);
    }
    if (!["analyze", "get_cv"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const knowledge = await loadKnowledge();
    const projectsText = knowledge.projects.map((p) => p.content).join("\n\n---\n\n");
    const vacancySlice = vacancy.slice(0, 10000);

    if (action === "analyze") {
      const result = parseJson<{
        match_percent: number;
        highlights: string[];
        expected_concerns: string[];
        cv_sections_to_boost?: string[];
        title?: string;
        company?: string;
      }>(
        await chat(
          ANALYZE_SYSTEM,
          `## Vacancy\n${vacancySlice}\n\n## Profile\n${knowledge.profile.slice(0, 5000)}\n\n## Projects\n${projectsText.slice(0, 10000)}`,
        ),
      );

      return json({
        match_percent: result.match_percent,
        highlights: result.highlights,
        expected_concerns: result.expected_concerns,
        cv_sections_to_boost: result.cv_sections_to_boost ?? [],
        vacancy_title: result.title,
        vacancy_company: result.company,
      });
    }

    const baseCv = variant === "russia" ? knowledge.cv_ru : knowledge.cv_en;
    const cvResult = parseJson<{ cv_markdown: string; ats_score: number; notes: string }>(
      await chat(
        CV_SYSTEM,
        `## Vacancy\n${vacancySlice}\n\n## Base CV\n${baseCv}\n\n## Profile\n${knowledge.profile.slice(0, 4000)}\n\n## Projects\n${projectsText.slice(0, 8000)}\n\n## ATS rules\n${knowledge.ats_rules.slice(0, 2000)}`,
      ),
    );

    return json({
      cv_markdown: cvResult.cv_markdown,
      ats_score: cvResult.ats_score,
      notes: cvResult.notes,
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
