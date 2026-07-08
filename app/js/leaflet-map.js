import * as L from "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js";
import { MVP } from "./mvp-settings.js";

const PIN_COLORS = {
  red: "#c96d5a",
  amber: "#d9955f",
  green: "#6fa36f"
};

let maps = [];

export function destroyMaps() {
  maps.forEach((map) => map.remove());
  maps = [];
}

function taskIcon(task) {
  const color = PIN_COLORS[task.pinColor] || PIN_COLORS.green;
  return L.divIcon({
    className: "leaflet-task-icon",
    html: `<span class="leaflet-task-icon__dot" style="background:${color}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function userIcon() {
  return L.divIcon({
    className: "leaflet-user-icon",
    html: `<span class="leaflet-user-icon__dot"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

export function mountLeafletMap(container, options) {
  if (!container) return null;

  const center = options.userLocation || MVP.mapCenter;
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: true
  }).setView([center.lat, center.lng], options.zoom || MVP.mapZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  (options.tasks || []).forEach((task) => {
    const marker = L.marker([task.lat, task.lng], { icon: taskIcon(task) }).addTo(map);
    marker.on("click", () => {
      if (typeof options.onTaskSelect === "function") {
        options.onTaskSelect(task.id);
      }
    });
  });

  if (options.userLocation) {
    L.marker([options.userLocation.lat, options.userLocation.lng], { icon: userIcon() })
      .addTo(map)
      .bindTooltip("You", { permanent: false, direction: "top" });
  }

  if (options.fitTasks && options.tasks && options.tasks.length) {
    const bounds = L.latLngBounds(options.tasks.map((t) => [t.lat, t.lng]));
    if (options.userLocation) bounds.extend([options.userLocation.lat, options.userLocation.lng]);
    map.fitBounds(bounds.pad(0.2));
  }

  maps.push(map);
  setTimeout(() => map.invalidateSize(), 0);
  return map;
}
