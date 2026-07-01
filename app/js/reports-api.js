import { getSupabase } from "./supabase-client.js";
import { MVP } from "./mvp-settings.js";
import { uploadPhoto } from "./photos.js";

function locationLabel(lat, lng, locale) {
  if (locale === "ru") {
    return `${MVP.pilotCityRu} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return `${MVP.pilotCity} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export async function createReport({ userId, category, lat, lng, photoFile, locale }) {
  const photoPath = await uploadPhoto(userId, "reports", photoFile);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      title: "Pollution report",
      location_name: locationLabel(lat, lng, locale),
      lat,
      lng,
      category,
      severity: "medium",
      reward_points: MVP.rewardPoints,
      photo_path: photoPath,
      status: "pending"
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function createSubmission({ userId, taskId, beforeFile, afterFile }) {
  const beforePath = await uploadPhoto(userId, "submissions/before", beforeFile);
  const afterPath = await uploadPhoto(userId, "submissions/after", afterFile);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      user_id: userId,
      task_id: taskId,
      before_photo_path: beforePath,
      after_photo_path: afterPath,
      status: "pending"
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
