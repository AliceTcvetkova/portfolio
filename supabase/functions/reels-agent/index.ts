import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleUpdate, type TelegramUpdate } from "./bot.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "reels-agent",
        llm: Deno.env.get("LLM_PROVIDER") ?? "groq",
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return new Response("TELEGRAM_BOT_TOKEN not configured", { status: 500 });
  }

  if (WEBHOOK_SECRET) {
    const header = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (header !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    await handleUpdate(update, supabase);
  } catch (err) {
    console.error("handleUpdate error:", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
