import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
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

async function chat(
  system: string,
  user: string,
  model = "gpt-4o-mini",
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured on Supabase");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(trimmed) as T;
}

const PARSE_SYSTEM = `You extract structured job vacancy data. Return JSON only:
{
  "title": string,
  "company": string,
  "language": "ru" | "en",
  "must_have": [{"skill": string, "evidence": string}],
  "nice_to_have": [{"skill": string}],
  "keywords": string[],
  "what_matters": string[]
}`;

const MATCH_SYSTEM = `You match a candidate to a vacancy using ONLY the provided knowledge base.
Never invent experience. case_study projects (locus_chamber, eco_clean_map) are educational — usable for skills demo, not as employment years.
Return JSON:
{
  "match_percent": number,
  "highlights": string[],
  "expected_concerns": string[],
  "cv_sections_to_boost": string[],
  "matched_projects": string[]
}`;

const CV_SYSTEM = `You tailor a CV markdown for the vacancy using ONLY facts from the knowledge base.
ATS-safe single-column markdown. No invented metrics. Return JSON:
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

    const vacancyJson = parseJson<Record<string, unknown>>(
      await chat(PARSE_SYSTEM, vacancy.slice(0, 12000)),
    );

    const matchJson = parseJson<{
      match_percent: number;
      highlights: string[];
      expected_concerns: string[];
      cv_sections_to_boost?: string[];
    }>(
      await chat(
        MATCH_SYSTEM,
        `## Vacancy\n${JSON.stringify(vacancyJson)}\n\n## Profile\n${knowledge.profile.slice(0, 6000)}\n\n## Projects\n${projectsText.slice(0, 12000)}`,
      ),
    );

    if (action === "analyze") {
      return json({
        match_percent: matchJson.match_percent,
        highlights: matchJson.highlights,
        expected_concerns: matchJson.expected_concerns,
        cv_sections_to_boost: matchJson.cv_sections_to_boost ?? [],
        vacancy_title: vacancyJson.title,
        vacancy_company: vacancyJson.company,
      });
    }

    const baseCv = variant === "russia" ? knowledge.cv_ru : knowledge.cv_en;
    const cvResult = parseJson<{ cv_markdown: string; ats_score: number; notes: string }>(
      await chat(
        CV_SYSTEM,
        `## Vacancy\n${JSON.stringify(vacancyJson)}\n\n## Match\n${JSON.stringify(matchJson)}\n\n## Base CV\n${baseCv}\n\n## ATS rules (summary)\n${knowledge.ats_rules.slice(0, 3000)}`,
        "gpt-4o",
      ),
    );

    return json({
      match_percent: matchJson.match_percent,
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
