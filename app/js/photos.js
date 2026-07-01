import { getSupabase } from "./supabase-client.js";

const BUCKET = "photos";

export async function uploadPhoto(userId, folder, file) {
  const supabase = getSupabase();
  const ext = (file.name && file.name.split(".").pop()) || "jpg";
  const path = `${userId}/${folder}/${Date.now()}.${ext.replace(/[^a-z0-9]/gi, "")}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg"
  });
  if (error) throw error;
  return path;
}

export function photoPublicUrl(path) {
  const supabase = getSupabase();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
