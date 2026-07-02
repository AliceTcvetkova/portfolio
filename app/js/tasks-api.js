import { appLocale } from "./mvp-settings.js";
import { photoPublicUrl } from "./photos.js";

const SEVERITY = {
  high: { pinColor: "red", pinLabel: "High", en: "High pollution", ru: "Сильное загрязнение" },
  medium: { pinColor: "amber", pinLabel: "Med", en: "Medium pollution", ru: "Среднее загрязнение" },
  low: { pinColor: "green", pinLabel: "Low", en: "Low pollution", ru: "Слабое загрязнение" }
};

export function haversineKm(a, b) {
  if (!a || !b) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km) {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatReported(iso) {
  if (!iso) return "—";
  const locale = appLocale();
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) {
    return locale === "ru" ? `${mins} мин назад` : `${mins} min ago`;
  }
  const hrs = Math.round(mins / 60);
  return locale === "ru" ? `${hrs} ч назад` : `${hrs} hr ago`;
}

export function filterPlayableTasks(tasks) {
  return tasks.filter((task) => task.beforePhotoPath);
}

export function normalizeTask(row, userLocation) {
  const meta = SEVERITY[row.severity] || SEVERITY.medium;
  const locale = appLocale();
  const km = userLocation ? haversineKm(userLocation, { lat: row.lat, lng: row.lng }) : null;
  return {
    id: row.id,
    title: row.title,
    location: row.location_name,
    lat: row.lat,
    lng: row.lng,
    severity: row.severity,
    severityLabel: locale === "ru" ? meta.ru : meta.en,
    reward: row.reward_points,
    badge: row.category + " badge",
    category: row.category,
    reported: formatReported(row.created_at),
    pinColor: meta.pinColor,
    pinLabel: meta.pinLabel,
    distance: formatDistance(km),
    distanceKm: km,
    beforePhotoPath: row.before_photo_path || null,
    beforePhotoUrl: row.before_photo_path ? photoPublicUrl(row.before_photo_path) : null,
    reporterId: row.reporter_id || null
  };
}

export function sortByDistance(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

export async function loadTasksFromSupabase(supabase, userLocation) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, location_name, lat, lng, severity, reward_points, category, created_at, status, before_photo_path, reporter_id")
    .eq("status", "open")
    .not("before_photo_path", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return sortByDistance(filterPlayableTasks((data || []).map((row) => normalizeTask(row, userLocation))));
}

export function requestUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
