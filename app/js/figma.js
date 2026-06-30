const TOKEN_VARS = {
  bg: "--bg",
  surface: "--surface",
  surface2: "--surface-2",
  card: "--card",
  cardMuted: "--card-muted",
  text: "--text",
  muted: "--muted",
  white: "--white",
  green: "--green",
  greenDark: "--green-dark",
  lime: "--lime",
  amber: "--amber",
  red: "--red",
  blue: "--blue",
  border: "--border",
  paper: "--paper",
  peach: "--peach",
  moss: "--moss",
  mist: "--mist"
};

let tokens = null;

export async function loadFigmaTokens() {
  if (tokens) return tokens;
  const res = await fetch("./js/figma-tokens.json");
  if (!res.ok) throw new Error("figma-tokens.json not found");
  tokens = await res.json();
  return tokens;
}

export function applyFigmaTokens(data) {
  const root = document.documentElement;
  Object.entries(data.colors || {}).forEach(([key, value]) => {
    const cssVar = TOKEN_VARS[key];
    if (cssVar) root.style.setProperty(cssVar, value);
  });
  if (data.layout && data.layout.phoneWidth) {
    root.style.setProperty("--phone-width", data.layout.phoneWidth + "px");
  }
}

export function figmaScreenAsset(data, slug) {
  const screen = (data.screens || []).find((item) => item.slug === slug);
  if (!screen) return null;
  return (data.assetBase || "../assets/clean-map/figma-export/") + screen.file;
}

export function figmaScreenBySlug(data, slug) {
  return (data.screens || []).find((item) => item.slug === slug) || null;
}
