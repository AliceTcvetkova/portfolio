/**
 * Locus Chamber — interactive scene config
 *
 * Add slides to assets/locus-chamber/ and extend scenes below.
 *
 * Scene fields:
 * - id: unique string
 * - type: "slide" | "choice" | "auto"
 * - title, caption: on-screen copy
 * - image: path under assets/locus-chamber/ (optional)
 * - autoNext: { delayMs, next } — plays automatically
 * - choices: [{ label, next }] — user picks a path
 * - next: string — default forward link (Next button)
 * - hotspots: [{ x, y, w, h, label, next }] — click areas in % (optional)
 * - effects: [{ type: "pulse", x, y, size, click, label }] — animated overlays in % (optional)
 * - immersive: true — hide title/caption block under the slide
 * - castleDoor: true — dolly + door animation on image slide
 * - enter: "from-dark" — fade in from black (castle corridor)
 */

window.LOCUS_CHAMBER = {
  start: "opening",

  scenes: {
    opening: {
      type: "slide",
      title: "",
      caption: "",
      image: "assets/locus-chamber/slide-01-opening.png",
      immersive: true,
      effects: [
        { type: "pulse", x: 23.4, y: 24.4, size: 2.0, click: "folder-question", label: "Memory" }
      ]
    },

    "folder-question": {
      type: "slide",
      compose: "folder-question",
      title: "",
      caption: "",
      immersive: true,
      autoNext: { delayMs: 3000, next: "memory-truth", exit: "dissolve", exitMs: 1500 }
    },

    "memory-truth": {
      type: "slide",
      compose: "memory-truth",
      title: "",
      caption: "",
      immersive: true,
      autoNext: { delayMs: 3200, next: "memory-scene", exit: "arrow-exit", exitMs: 1500 }
    },

    "memory-scene": {
      type: "slide",
      title: "",
      caption: "",
      image: "assets/locus-chamber/slide-04-memory-scene.png",
      reveal: "arrow-path",
      immersive: true,
      autoNext: { delayMs: 6000, next: "memory-chain", exit: "slide-left", exitMs: 1500 }
    },

    "memory-chain": {
      type: "slide",
      compose: "memory-chain",
      title: "",
      caption: "",
      enter: "from-right",
      immersive: true,
      autoNext: { delayMs: 4500, next: "castle-corridor", exit: "slide-left", exitMs: 1500 }
    },

    "castle-corridor": {
      type: "slide",
      title: "",
      caption: "",
      image: "assets/locus-chamber/slide-06-castle-corridor.png",
      castleDoor: true,
      enter: "from-dark",
      immersive: true,
      autoNext: { delayMs: 3000, next: "app-living-room", exit: "door-open", crossfadeAt: 1680, exitMs: 2040 }
    },

    "app-living-room": {
      type: "slide",
      compose: "app-living-room",
      title: "",
      caption: "",
      enter: "through-door",
      immersive: true
    },

    intro: {
      type: "choice",
      title: "Locus Chamber",
      caption: "A digital space for memory. Choose how to begin.",
      image: null,
      choices: [
        { label: "Walk through the prototype", next: "placeholder-walk" },
        { label: "Read the product outline", next: "outline" }
      ]
    },

    "placeholder-walk": {
      type: "slide",
      title: "Prototype in progress",
      caption: "Slides and interaction paths will appear here as they are added.",
      image: null,
      next: "intro"
    },

    outline: {
      type: "slide",
      title: "Product outline",
      caption: "Problem · Hypothesis · Research · JTBD · MVP · Monetization · Roadmap — content coming next.",
      image: null,
      next: "intro"
    }
  }
};
