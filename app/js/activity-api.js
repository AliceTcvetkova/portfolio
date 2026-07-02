import { getSupabase } from "./supabase-client.js";

export async function loadUserActivity(userId) {
  const supabase = getSupabase();
  const [reportsRes, subsRes] = await Promise.all([
    supabase
      .from("reports")
      .select("id, location_name, category, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("submissions")
      .select("id, status, created_at, task_id, tasks(title, location_name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  if (reportsRes.error) throw reportsRes.error;
  if (subsRes.error) throw subsRes.error;

  return {
    reports: reportsRes.data || [],
    submissions: subsRes.data || []
  };
}
