import { getSupabase } from "./supabase-client.js";
import { appLocale } from "./mvp-settings.js";

const AUTH_DOMAIN = "users.eco-clean-map.app";

export function usernameToEmail(username) {
  const slug = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (slug.length < 2) {
    throw new Error(appLocale() === "ru" ? "Имя: минимум 2 символа (a-z, 0-9, _)" : "Name: min 2 chars (a-z, 0-9, _)");
  }
  return `${slug}@${AUTH_DOMAIN}`;
}

export async function getSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function loadProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, points, cleanups")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signUp(username, password) {
  const supabase = getSupabase();
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: username.trim() } }
  });
  if (error) throw error;
  if (!data.session) {
    const msg = appLocale() === "ru"
      ? "Аккаунт создан. Отключите подтверждение email в Supabase Auth или войдите."
      : "Account created. Disable email confirm in Supabase Auth, or sign in.";
    throw new Error(msg);
  }
  return data;
}

export async function signIn(username, password) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
