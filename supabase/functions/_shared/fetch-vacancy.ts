const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
};

export function isVacancyUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) && trimmed.length < 2000 &&
    !trimmed.includes("\n");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryDirectFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html).slice(0, 6000);
    return text.length >= 80 ? text : null;
  } catch {
    return null;
  }
}

async function tryJinaReader(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", ...FETCH_HEADERS },
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim().slice(0, 12000);
    return text.length >= 80 ? text : null;
  } catch {
    return null;
  }
}

async function tryAllOrigins(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      { headers: { Accept: "text/html,text/plain,*/*" } },
    );
    if (!res.ok) return null;
    const body = await res.text();
    const text = stripHtml(body).slice(0, 12000);
    return text.length >= 80 ? text : null;
  } catch {
    return null;
  }
}

/** Fetch and extract vacancy text from a job posting URL (server-side, no browser CORS). */
export async function fetchVacancyFromUrl(url: string): Promise<string> {
  const normalized = url.trim();
  const attempts = [
    tryDirectFetch(normalized),
    tryJinaReader(normalized),
    tryAllOrigins(normalized),
  ];

  for (const attempt of attempts) {
    const text = await attempt;
    if (text) return text;
  }

  throw new Error(
    "Could not fetch vacancy from URL (site may block bots or require login). Paste the full job description text instead.",
  );
}

export async function resolveVacancyInput(input: string): Promise<{
  text: string;
  fetchedFromUrl: boolean;
  sourceUrl?: string;
}> {
  const trimmed = input.trim();
  if (!isVacancyUrl(trimmed)) {
    return { text: trimmed, fetchedFromUrl: false };
  }
  const text = await fetchVacancyFromUrl(trimmed);
  return { text, fetchedFromUrl: true, sourceUrl: trimmed };
}
