"use strict";

const fs = require("fs");
const path = require("path");

const enStrings = JSON.parse(
  fs.readFileSync(path.join(__dirname, "i18n-strings-en.json"), "utf8")
);

/** Normalize HTML-entity keys to DOM text-node form. */
function domKey(s) {
  return s.replace(/&amp;/g, "&");
}

const extraJsStrings = [
  "Folders",
  "Lists",
  "Search",
  "Why do we store our memories in folders?",
  "Human memory doesn't work like that.",
  "Human memory doesn\u2019t work like that.",
  "Summer",
  "Summer house",
  "Grandmother",
  "Dog",
  "Children's bicycle",
  "Children\u2019s bicycle",
  "Photo frame 1",
  "Photo frame 2",
  "Photo frame 3",
  "Photo frame 4",
  "Photo frame 5",
  "Cat photos",
  "Living room",
  "Room",
  "Your room 1",
  "Photos",
  "Documents",
  "Books",
  "Memory",
  "A digital space for memory. Choose how to begin.",
  "Walk through the prototype",
  "Read the product outline",
  "Prototype in progress",
  "Slides and interaction paths will appear here as they are added.",
  "Product outline",
  "Problem · Hypothesis · Research · JTBD · MVP · Monetization · Roadmap — content coming next.",
  "A note can't be empty.",
  "Add a note or a photo.",
  "Add a photo",
  "Cancel",
  "Click an area to open its folder.",
  "Click the room to place corners. Click the first corner to close the area. Backspace removes the last point.",
  "Close",
  "Close area",
  "Could not export the vault.",
  "Could not open the vault in this browser.",
  "Could not read that file.",
  "Could not save. Storage may be unavailable in this browser.",
  "Delete",
  "Delete folder",
  "Delete this folder and everything inside it?",
  "Delete this note?",
  "Delete this photo?",
  "Edit",
  "Export",
  "Folder",
  "Folder name",
  "For example, Desk",
  "Give the folder a name.",
  "Import",
  "My room. Outline an area, name the folder, and keep notes and photos inside it.",
  "My vault",
  "Name the folder, then save it.",
  "No folders yet. Outline an area of the room to create the first one.",
  "Nothing saved here yet.",
  "Outline an area",
  "Photo",
  "Preparing the export…",
  "Replace the vault with this file? Notes and photos already saved in this browser will be replaced.",
  "Save",
  "Save folder",
  "Save note",
  "Saved in this browser, on this device. Nothing is sent to a server.",
  "That file is not a vault export.",
  "The room image could not be loaded.",
  "This browser ran out of space for the vault.",
  "This file is not a supported image. Use JPEG, PNG, WEBP, or GIF.",
  "This photo is too large. Maximum size is 12 MB.",
  "Undo point",
  "Vault imported.",
  "Write a note…",
];

const ru = require("./dict-ru-translations.js");

function jsQuote(s) {
  return JSON.stringify(s);
}

function buildTextDict() {
  const allKeys = new Set();
  const map = {};

  enStrings.forEach(function (en) {
    const key = domKey(en);
    allKeys.add(key);
    if (ru[key] === undefined && ru[en] === undefined) {
      throw new Error("Missing translation for JSON string: " + en);
    }
    map[key] = ru[key] !== undefined ? ru[key] : ru[en];
  });

  extraJsStrings.forEach(function (en) {
    allKeys.add(en);
    if (ru[en] === undefined) {
      throw new Error("Missing translation for JS string: " + en);
    }
    map[en] = ru[en];
  });

  if (enStrings.length !== 499) {
    throw new Error("Expected 499 JSON strings, got " + enStrings.length);
  }

  return map;
}

function buildAttrsDict() {
  const attrs = {
    "Alice Tsvetkova": "Alice Tsvetkova",
    "Alice Tsvetkova on LinkedIn (opens in new tab)":
      "Alice Tsvetkova в LinkedIn (откроется в новой вкладке)",
    "Locus Chamber sections": "Разделы Locus Chamber",
    "About the product": "О продукте",
    "Previous slide": "Предыдущий слайд",
    Discovery: "Discovery",
    Evolution: "Evolution",
    "Medieval illustration of competitor research":
      "Средневековая иллюстрация конкурентного анализа",
    "Medieval illustration representing user pain with current storage":
      "Средневековая иллюстрация пользовательских болей текущих решений для хранения",
    "Medieval marginalia illustration for jobs to be done":
      "Средневековая маргиналия для Jobs To Be Done",
    "The Bookworm — persona metaphor for deep information collectors":
      "Книжный червь — метафора персоны глубоких коллекционеров информации",
    "The Road of the Memory Keeper — Locus Chamber product roadmap from research to infinite archive":
      "Дорога хранителя памяти — дорожная карта Locus Chamber от исследования до бесконечного архива",
    "MVP room concept — classic library": "Концепция комнаты MVP — классическая библиотека",
    "MVP room concept — coastal study with fisheye view":
      "Концепция комнаты MVP — прибрежный кабинет с эффектом «рыбий глаз»",
    "MVP room concept — scrapbook workspace":
      "Концепция комнаты MVP — рабочее пространство в стиле scrapbook",
    "Medieval lion illustration representing product risks":
      "Средневековая иллюстрация льва — риски продукта",
    "Medieval figure struggling to organize — Suffering Middle Ages style":
      "Средневековая фигура, пытающаяся навести порядок — в стиле «страдающее Средневековье»",
    "Medieval marginalia illustration for validation next steps":
      "Средневековая маргиналия — следующие шаги валидации",
    "Hand-drawn Locus Chamber mobile app wireframes — onboarding, rooms, library, profile":
      "Ручные вайрфреймы мобильного приложения Locus Chamber — онбординг, комнаты, библиотека, профиль",
    "Building shared services to eliminate duplication across VK business units":
      "Построение общих сервисов для устранения дублирования между бизнес-юнитами VK",
    "Early Payments release delivery map across 20+ teams":
      "Карта релиза Early Payments для 20+ команд",
    "Illustrative workflow for creating an educational program across Developer, IRPO Moderator, FUMO, and Experts":
      "Иллюстративный процесс создания образовательной программы: разработчик, модератор IRPO, ФУМО и эксперты",
    "Digital educational content ecosystem — one methodology, one system, 130+ teams across Russia":
      "Экосистема цифрового образовательного контента — одна методология, одна система, 130+ команд по России",
    "Bear waving": "Медведь машет лапой",
    "Werewolf in the city": "Оборотень в городе",
    "French bulldog": "Французский бульдог",
    Beagle: "Beagle",
    "House and garden": "Дом и сад",
    "Lynx on a stump": "Рысь на пне",
    Pterosaur: "Pterosaur",
    "Baby hippo": "Детёныш бегемота",
    Alpaca: "Alpaca",
    "Living room": "Гостиная",
    Close: "Закрыть",
    "My room, seen from the doorway": "Моя комната, вид от входа",
    "My vault": "Моё хранилище",
    "Cat photos": "Фото кошек",
    "Photo frame 1": "Фоторамка 1",
    "Photo frame 2": "Фоторамка 2",
    "Photo frame 3": "Фоторамка 3",
    "Photo frame 4": "Фоторамка 4",
    "Photo frame 5": "Фоторамка 5",
    "Alice Tsvetkova · Product Manager": "Alice Tsvetkova · Продакт-менеджер",
    "Tsvetkova Alice — Product Manager. FinTech, EdTech, digital products and worlds.":
      "Tsvetkova Alice — продакт-менеджер. FinTech, EdTech, цифровые продукты и миры.",
    "Clean Map · Alice Tsvetkova": "Clean Map · Alice Tsvetkova",
    "Locus Chamber · Alice Tsvetkova": "Locus Chamber · Alice Tsvetkova",
    "Ozon Bank · Alice Tsvetkova": "Ozon Bank · Alice Tsvetkova",
    "IRPO · Alice Tsvetkova": "IRPO · Alice Tsvetkova",
    "VK · Alice Tsvetkova": "VK · Alice Tsvetkova",
    "Sketchbook · Alice Tsvetkova": "Sketchbook · Alice Tsvetkova",
    "Game Worlds · Alice Tsvetkova": "Game Worlds · Alice Tsvetkova",
  };

  return attrs;
}

function writeDictRu(map) {
  const keys = Object.keys(map).sort();
  const lines = keys.map(function (k) {
    return "    " + jsQuote(k) + ": " + jsQuote(map[k]);
  });
  const body =
    "window.SITE_I18N_RU_PARTS = [\n  {\n" +
    lines.join(",\n") +
    "\n  }\n];\n";
  fs.writeFileSync(path.join(__dirname, "../js/i18n/dict-ru.js"), body, "utf8");
}

function writeDictRuAttrs(attrs) {
  const keys = Object.keys(attrs).sort();
  const lines = keys.map(function (k) {
    return "  " + jsQuote(k) + ": " + jsQuote(attrs[k]);
  });
  const body =
    "window.SITE_I18N_RU_ATTRS = {\n" + lines.join(",\n") + "\n};\n";
  fs.writeFileSync(
    path.join(__dirname, "../js/i18n/dict-ru-attrs.js"),
    body,
    "utf8"
  );
}

const textMap = buildTextDict();
writeDictRu(textMap);
writeDictRuAttrs(buildAttrsDict());
console.log("Wrote dict-ru.js with", Object.keys(textMap).length, "entries");
console.log("Wrote dict-ru-attrs.js with", Object.keys(buildAttrsDict()).length, "entries");
