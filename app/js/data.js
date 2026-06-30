export const TASKS = [
  {
    id: "riverside",
    title: "Riverside plastic waste",
    distance: "0.8 km",
    severity: "medium",
    severityLabel: "Medium pollution",
    reward: 240,
    badge: "Riverside badge",
    location: "Northern Park, riverside path",
    reported: "18 min ago",
    category: "Plastic",
    pinColor: "amber",
    pinLabel: "Med",
    x: 72,
    y: 28
  },
  {
    id: "park-trash",
    title: "Park bench litter",
    distance: "1.1 km",
    severity: "high",
    severityLabel: "High pollution",
    reward: 320,
    badge: "Park Hero badge",
    location: "Northern Park, playground",
    reported: "42 min ago",
    category: "Mixed",
    pinColor: "red",
    pinLabel: "High",
    x: 28,
    y: 22
  },
  {
    id: "beach-glass",
    title: "Beach glass cleanup",
    distance: "1.2 km",
    severity: "low",
    severityLabel: "Low pollution",
    reward: 180,
    badge: "Coastal badge",
    location: "East beach access",
    reported: "2 hr ago",
    category: "Glass",
    pinColor: "green",
    pinLabel: "Done",
    x: 72,
    y: 56
  }
];

export const PROFILE = {
  name: "Alice",
  level: "Level 4 - Local Cleaner",
  cleanups: 12,
  area: "3.8km",
  points: 2840,
  badges: ["Riverside", "Park Hero", "First Report", "Team Sprint"]
};

export const CAMPAIGN = {
  title: "Clean Northern Park",
  description: "Fund 14 open cleanup tasks around the riverside path and playground.",
  funded: 420,
  goal: 650
};

export const REPORT_CATEGORIES = ["Plastic", "Glass", "Mixed"];
