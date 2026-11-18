/**
 * My vault — personal folders drawn on the room.
 *
 * A region is a polygon in percentages of the room image, so it stays
 * aligned when the page resizes. Notes and photos are stored in IndexedDB
 * on this browser only. Export / import moves the vault to another browser.
 */
(function () {
  var DB_NAME = "locus-my-vault";
  var DB_VERSION = 1;
  var MAX_BYTES = 12 * 1024 * 1024;
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ACCEPTED = {
    "image/jpeg": true,
    "image/png": true,
    "image/webp": true,
    "image/gif": true
  };

  var root = document.querySelector("[data-locus-vault]");
  if (!root) return;

  var section = root.closest("[data-locus-section-panel]");
  var stage = root.querySelector("[data-vault-stage]");
  var image = root.querySelector("[data-vault-image]");
  var svg = root.querySelector("[data-vault-svg]");
  var labels = root.querySelector("[data-vault-labels]");
  var statusEl = root.querySelector("[data-vault-status]");
  var drawer = root.querySelector("[data-vault-drawer]");
  var nameInput = root.querySelector("[data-vault-folder-name]");
  var itemsEl = root.querySelector("[data-vault-items]");
  var noteForm = root.querySelector("[data-vault-note-form]");
  var noteField = root.querySelector("[data-vault-note]");
  var namingForm = root.querySelector("[data-vault-naming]");
  var namingInput = root.querySelector("[data-vault-name-input]");
  var fileInput = root.querySelector("[data-vault-file]");
  var importInput = root.querySelector("[data-vault-import]");
  var lightbox = root.querySelector("[data-vault-lightbox]");
  var lightboxImg = root.querySelector("[data-vault-lightbox-img]");

  var dbPromise = null;
  var urls = {};
  var statusKey = "";
  var lastFocus = null;
  var savingFolder = false;

  var state = {
    regions: [],
    items: [],
    mode: "idle",
    draft: [],
    cursor: null,
    openId: null,
    editingNoteId: null,
    ready: false
  };

  function t(text) {
    if (window.SiteI18n && typeof SiteI18n.t === "function") return SiteI18n.t(text);
    return text;
  }

  function setStatus(key) {
    statusKey = key || "";
    if (statusEl) statusEl.textContent = statusKey ? t(statusKey) : "";
  }

  function uid() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function findRegion(id) {
    for (var i = 0; i < state.regions.length; i++) {
      if (state.regions[i].id === id) return state.regions[i];
    }
    return null;
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  function itemsFor(regionId) {
    return state.items
      .filter(function (item) { return item.regionId === regionId; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function roundPoint(point) {
    return {
      x: Math.round(point.x * 100) / 100,
      y: Math.round(point.y * 100) / 100
    };
  }

  function pointFromEvent(event) {
    var rect = image.getBoundingClientRect();
    var width = rect.width || 1;
    var height = rect.height || 1;
    var x = ((event.clientX - rect.left) / width) * 100;
    var y = ((event.clientY - rect.top) / height) * 100;
    return {
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y))
    };
  }

  function distPx(a, b) {
    var rect = image.getBoundingClientRect();
    var dx = ((a.x - b.x) / 100) * rect.width;
    var dy = ((a.y - b.y) / 100) * rect.height;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function centroid(points) {
    var x = 0;
    var y = 0;
    points.forEach(function (point) {
      x += point.x;
      y += point.y;
    });
    return { x: x / points.length, y: y / points.length };
  }

  function toPoints(points) {
    return points.map(function (point) {
      return point.x + "," + point.y;
    }).join(" ");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatTime(ts) {
    try {
      var lang = window.SiteI18n && SiteI18n.getLang() === "ru" ? "ru-RU" : "en-GB";
      return new Date(ts).toLocaleString(lang, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "";
    }
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains("regions")) {
          db.createObjectStore("regions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("items")) {
          var items = db.createObjectStore("items", { keyPath: "id" });
          items.createIndex("regionId", "regionId", { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function getAll(storeName) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readonly");
        var request = tx.objectStore(storeName).getAll();
        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function put(storeName, record) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("aborted")); };
      });
    });
  }

  function replaceAll(regions, items) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(["regions", "items"], "readwrite");
        tx.objectStore("regions").clear();
        tx.objectStore("items").clear();
        regions.forEach(function (region) { tx.objectStore("regions").put(region); });
        items.forEach(function (item) { tx.objectStore("items").put(item); });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("aborted")); };
      });
    });
  }

  function guard(promise) {
    return Promise.resolve(promise).catch(function (err) {
      if (err && err.name === "QuotaExceededError") {
        setStatus("This browser ran out of space for the vault.");
        return;
      }
      setStatus("Could not save. Storage may be unavailable in this browser.");
    });
  }

  function urlFor(item) {
    if (!item.blob) return "";
    if (!urls[item.id]) urls[item.id] = URL.createObjectURL(item.blob);
    return urls[item.id];
  }

  function revokeUrl(id) {
    if (!urls[id]) return;
    URL.revokeObjectURL(urls[id]);
    delete urls[id];
  }

  function revokeAllUrls() {
    Object.keys(urls).forEach(revokeUrl);
  }

  function applyPlaceholders() {
    if (namingInput) namingInput.placeholder = t("For example, Desk");
    if (noteField) noteField.placeholder = t("Write a note…");
  }

  function setMode(mode) {
    state.mode = mode;
    root.classList.toggle("locus-vault--drawing", mode === "drawing");
    root.querySelectorAll("[data-vault-tools]").forEach(function (group) {
      group.hidden = group.getAttribute("data-vault-tools") !== mode;
    });
  }

  function refreshHint() {
    if (!state.ready) return;
    if (state.mode === "drawing") {
      setStatus("Click the room to place corners. Click the first corner to close the area. Backspace removes the last point.");
      return;
    }
    if (state.mode === "naming") {
      setStatus("Name the folder, then save it.");
      return;
    }
    if (!state.regions.length) {
      setStatus("No folders yet. Outline an area of the room to create the first one.");
      return;
    }
    setStatus("Click an area to open its folder.");
  }

  function syncChrome() {
    var exportBtn = root.querySelector("[data-vault-export]");
    if (exportBtn) exportBtn.disabled = !state.regions.length && !state.items.length;
    refreshHint();
    renderOverlay();
  }

  function renderOverlay() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    while (labels.firstChild) labels.removeChild(labels.firstChild);

    state.regions.forEach(function (region) {
      var poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute("points", toPoints(region.points));
      poly.setAttribute("data-region-id", region.id);
      poly.setAttribute("role", "button");
      poly.setAttribute("tabindex", state.mode === "idle" ? "0" : "-1");
      poly.setAttribute("aria-label", region.name);
      poly.setAttribute("class", "locus-vault__region" + (region.id === state.openId ? " is-open" : ""));
      svg.appendChild(poly);

      var label = el("span", "locus-vault__label", region.name);
      var center = centroid(region.points);
      label.style.left = center.x + "%";
      label.style.top = center.y + "%";
      labels.appendChild(label);
    });

    if (state.mode === "drawing" || state.mode === "naming") {
      var preview = state.draft.slice();
      if (state.mode === "drawing" && state.cursor) preview.push(state.cursor);
      if (preview.length) {
        var line = document.createElementNS(SVG_NS, "polyline");
        line.setAttribute("points", toPoints(preview));
        line.setAttribute("class", "locus-vault__draft");
        svg.appendChild(line);
      }
      state.draft.forEach(function (point, index) {
        var handle = el("span", "locus-vault__handle" + (index === 0 ? " is-first" : ""));
        handle.style.left = point.x + "%";
        handle.style.top = point.y + "%";
        labels.appendChild(handle);
      });
    }

    var closeBtn = root.querySelector("[data-vault-close-shape]");
    if (closeBtn) closeBtn.disabled = state.draft.length < 3;
  }

  function renderItems() {
    if (!itemsEl) return;
    while (itemsEl.firstChild) itemsEl.removeChild(itemsEl.firstChild);
    var region = findRegion(state.openId);
    if (!region) return;

    var list = itemsFor(region.id);
    if (!list.length) {
      var empty = el("div", "locus-vault__empty");
      empty.appendChild(el("p", "locus-vault__empty-title", t("Nothing saved here yet.")));
      empty.appendChild(el("p", null, t("Add a note or a photo.")));
      itemsEl.appendChild(empty);
      return;
    }

    list.forEach(function (item) {
      itemsEl.appendChild(item.kind === "photo" ? photoCard(item) : noteCard(item));
    });
  }

  function noteCard(item) {
    var card = el("article", "locus-vault__card");
    if (state.editingNoteId === item.id) {
      var field = el("textarea", "locus-vault__note-edit");
      field.value = item.text;
      field.setAttribute("data-vault-note-edit", item.id);
      field.maxLength = 20000;
      card.appendChild(field);
    } else {
      card.appendChild(el("p", "locus-vault__note-text", item.text));
    }

    var meta = el("div", "locus-vault__card-meta");
    var time = el("time", "locus-vault__time", formatTime(item.createdAt));
    time.dateTime = new Date(item.createdAt).toISOString();
    meta.appendChild(time);

    if (state.editingNoteId === item.id) {
      var saveBtn = el("button", "locus-vault__text-btn", t("Save"));
      saveBtn.type = "button";
      saveBtn.setAttribute("data-vault-save-note", item.id);
      meta.appendChild(saveBtn);
      var cancelBtn = el("button", "locus-vault__text-btn", t("Cancel"));
      cancelBtn.type = "button";
      cancelBtn.setAttribute("data-vault-cancel-edit", "");
      meta.appendChild(cancelBtn);
    } else {
      var editBtn = el("button", "locus-vault__text-btn", t("Edit"));
      editBtn.type = "button";
      editBtn.setAttribute("data-vault-edit-note", item.id);
      meta.appendChild(editBtn);
      meta.appendChild(deleteButton(item.id));
    }

    card.appendChild(meta);
    return card;
  }

  function photoCard(item) {
    var card = el("article", "locus-vault__card");
    var thumb = el("button", "locus-vault__thumb");
    thumb.type = "button";
    thumb.setAttribute("data-vault-open-photo", item.id);
    var img = el("img");
    img.src = urlFor(item);
    img.alt = item.filename || t("Photo");
    thumb.appendChild(img);
    card.appendChild(thumb);

    var meta = el("div", "locus-vault__card-meta");
    if (item.filename) meta.appendChild(el("span", "locus-vault__filename", item.filename));
    var time = el("time", "locus-vault__time", formatTime(item.createdAt));
    time.dateTime = new Date(item.createdAt).toISOString();
    meta.appendChild(time);
    meta.appendChild(deleteButton(item.id));
    card.appendChild(meta);
    return card;
  }

  function deleteButton(id) {
    var button = el("button", "locus-vault__text-btn", t("Delete"));
    button.type = "button";
    button.setAttribute("data-vault-delete-item", id);
    return button;
  }

  function openRegion(id) {
    var region = findRegion(id);
    if (!region || state.mode !== "idle") return;
    lastFocus = document.activeElement;
    state.openId = id;
    state.editingNoteId = null;
    if (nameInput) nameInput.value = region.name;
    if (noteField) noteField.value = "";
    drawer.hidden = false;
    renderItems();
    renderOverlay();
    if (nameInput) nameInput.focus();
  }

  function closeDrawer() {
    if (!state.openId && drawer.hidden) return;
    state.openId = null;
    state.editingNoteId = null;
    drawer.hidden = true;
    renderOverlay();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function closeLightbox() {
    if (lightbox && lightbox.open) lightbox.close();
  }

  function cancelDraft() {
    state.draft = [];
    state.cursor = null;
    setMode("idle");
    syncChrome();
  }

  function startDrawing() {
    closeDrawer();
    closeLightbox();
    state.draft = [];
    state.cursor = null;
    setMode("drawing");
    syncChrome();
  }

  function startNaming() {
    if (state.draft.length < 3) return;
    state.cursor = null;
    setMode("naming");
    if (namingInput) {
      namingInput.value = "";
      namingInput.focus();
    }
    syncChrome();
  }

  function saveFolder(name) {
    var region = {
      id: uid(),
      name: name,
      points: state.draft.map(roundPoint),
      createdAt: Date.now()
    };
    return put("regions", region).then(function () {
      state.regions.push(region);
      state.draft = [];
      state.cursor = null;
      setMode("idle");
      syncChrome();
      openRegion(region.id);
    });
  }

  function renameOpenFolder() {
    var region = findRegion(state.openId);
    if (!region || !nameInput) return;
    var name = nameInput.value.trim().slice(0, 80);
    if (!name) {
      nameInput.value = region.name;
      setStatus("Give the folder a name.");
      return;
    }
    nameInput.value = name;
    if (name === region.name) return;
    region.name = name;
    guard(put("regions", region).then(function () {
      renderOverlay();
      refreshHint();
    }));
  }

  function deleteOpenFolder() {
    var region = findRegion(state.openId);
    if (!region) return;
    if (!window.confirm(t("Delete this folder and everything inside it?"))) return;
    var doomed = state.items.filter(function (item) { return item.regionId === region.id; });
    guard(openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(["regions", "items"], "readwrite");
        tx.objectStore("regions").delete(region.id);
        doomed.forEach(function (item) { tx.objectStore("items").delete(item.id); });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error("aborted")); };
      });
    }).then(function () {
      doomed.forEach(function (item) { revokeUrl(item.id); });
      state.regions = state.regions.filter(function (item) { return item.id !== region.id; });
      state.items = state.items.filter(function (item) { return item.regionId !== region.id; });
      state.openId = null;
      state.editingNoteId = null;
      drawer.hidden = true;
      syncChrome();
    }));
  }

  function addNote(text) {
    if (!state.openId) return;
    var item = {
      id: uid(),
      regionId: state.openId,
      kind: "note",
      text: text.slice(0, 20000),
      createdAt: Date.now()
    };
    guard(put("items", item).then(function () {
      state.items.push(item);
      if (noteField) noteField.value = "";
      renderItems();
      refreshHint();
    }));
  }

  function saveNoteEdit(id) {
    var item = findItem(id);
    var field = itemsEl.querySelector("[data-vault-note-edit]");
    if (!item || !field) return;
    var text = field.value.trim();
    if (!text) {
      setStatus("A note can't be empty.");
      return;
    }
    item.text = text.slice(0, 20000);
    guard(put("items", item).then(function () {
      state.editingNoteId = null;
      renderItems();
      refreshHint();
    }));
  }

  function deleteItem(item) {
    var question = item.kind === "photo" ? "Delete this photo?" : "Delete this note?";
    if (!window.confirm(t(question))) return;
    guard(openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("items", "readwrite");
        tx.objectStore("items").delete(item.id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).then(function () {
      revokeUrl(item.id);
      state.items = state.items.filter(function (entry) { return entry.id !== item.id; });
      if (state.editingNoteId === item.id) state.editingNoteId = null;
      renderItems();
    }));
  }

  function addPhotos(fileList) {
    if (!state.openId) return;
    var files = Array.prototype.slice.call(fileList || []);
    var errorKey = "";
    var accepted = [];
    files.forEach(function (file) {
      if (!ACCEPTED[file.type]) {
        errorKey = "This file is not a supported image. Use JPEG, PNG, WEBP, or GIF.";
        return;
      }
      if (file.size > MAX_BYTES) {
        errorKey = "This photo is too large. Maximum size is 12 MB.";
        return;
      }
      accepted.push(file);
    });

    var chain = Promise.resolve();
    accepted.forEach(function (file) {
      chain = chain.then(function () {
        var item = {
          id: uid(),
          regionId: state.openId,
          kind: "photo",
          blob: file,
          mime: file.type,
          filename: file.name || "",
          createdAt: Date.now()
        };
        return put("items", item).then(function () {
          state.items.push(item);
        });
      });
    });

    guard(chain.then(function () {
      renderItems();
      if (errorKey) setStatus(errorKey);
      else refreshHint();
    }));
  }

  function openPhoto(item) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = urlFor(item);
    lightboxImg.alt = item.filename || t("Photo");
    if (typeof lightbox.showModal === "function") lightbox.showModal();
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    var comma = dataUrl.indexOf(",");
    if (comma < 0) throw new Error("bad data url");
    var header = dataUrl.slice(0, comma);
    var body = dataUrl.slice(comma + 1);
    var mimeMatch = header.match(/^data:([^;,]+)/);
    var mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    var binary = atob(body);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function exportVault() {
    setStatus("Preparing the export…");
    var jobs = state.items.map(function (item) {
      var copy = {
        id: item.id,
        regionId: item.regionId,
        kind: item.kind,
        text: item.text || "",
        filename: item.filename || "",
        mime: item.mime || "",
        createdAt: item.createdAt
      };
      if (item.kind === "photo" && item.blob) {
        return blobToDataUrl(item.blob).then(function (dataUrl) {
          copy.dataUrl = dataUrl;
          return copy;
        });
      }
      return Promise.resolve(copy);
    });

    Promise.all(jobs).then(function (items) {
      var payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        regions: state.regions.map(function (region) {
          return {
            id: region.id,
            name: region.name,
            points: region.points,
            createdAt: region.createdAt
          };
        }),
        items: items
      };
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      var link = document.createElement("a");
      var href = URL.createObjectURL(blob);
      link.href = href;
      link.download = "locus-vault.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
      refreshHint();
    }).catch(function () {
      setStatus("Could not export the vault.");
    });
  }

  function normalizeImport(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.regions) || !Array.isArray(data.items)) {
      return null;
    }
    var regions = [];
    var regionIds = {};
    data.regions.forEach(function (raw) {
      if (!raw || typeof raw.name !== "string" || !Array.isArray(raw.points) || raw.points.length < 3) return;
      var points = [];
      for (var i = 0; i < raw.points.length; i++) {
        var point = raw.points[i];
        if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
        if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return;
        points.push({ x: point.x, y: point.y });
      }
      if (points.length < 3) return;
      var id = typeof raw.id === "string" && raw.id ? raw.id : uid();
      if (regionIds[id]) return;
      regionIds[id] = true;
      var name = raw.name.trim().slice(0, 80) || t("Folder");
      regions.push({
        id: id,
        name: name,
        points: points,
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now()
      });
    });

    var items = [];
    var seenItems = {};
    data.items.forEach(function (raw) {
      if (!raw || (raw.kind !== "note" && raw.kind !== "photo")) return;
      if (typeof raw.regionId !== "string" || !regionIds[raw.regionId]) return;
      var id = typeof raw.id === "string" && raw.id && !seenItems[raw.id] ? raw.id : uid();
      seenItems[id] = true;
      var createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Date.now();
      if (raw.kind === "note") {
        if (typeof raw.text !== "string" || !raw.text.trim()) return;
        items.push({
          id: id,
          regionId: raw.regionId,
          kind: "note",
          text: raw.text.slice(0, 20000),
          createdAt: createdAt
        });
        return;
      }
      if (typeof raw.dataUrl !== "string" || raw.dataUrl.indexOf("data:image/") !== 0) return;
      var mime = (raw.dataUrl.split(";")[0] || "").replace("data:", "");
      if (!ACCEPTED[mime]) return;
      var blob;
      try {
        blob = dataUrlToBlob(raw.dataUrl);
      } catch (e) {
        return;
      }
      if (!blob || blob.size > MAX_BYTES) return;
      items.push({
        id: id,
        regionId: raw.regionId,
        kind: "photo",
        blob: blob,
        mime: mime,
        filename: typeof raw.filename === "string" ? raw.filename.slice(0, 180) : "",
        createdAt: createdAt
      });
    });

    if (!regions.length) return null;
    return { regions: regions, items: items };
  }

  function importVault(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(String(reader.result || ""));
      } catch (e) {
        setStatus("That file is not a vault export.");
        return;
      }
      var next = normalizeImport(data);
      if (!next) {
        setStatus("That file is not a vault export.");
        return;
      }
      if ((state.regions.length || state.items.length) &&
          !window.confirm(t("Replace the vault with this file? Notes and photos already saved in this browser will be replaced."))) {
        refreshHint();
        return;
      }
      guard(replaceAll(next.regions, next.items).then(function () {
        revokeAllUrls();
        state.regions = next.regions.sort(function (a, b) { return a.createdAt - b.createdAt; });
        state.items = next.items;
        state.openId = null;
        state.editingNoteId = null;
        state.draft = [];
        setMode("idle");
        drawer.hidden = true;
        closeLightbox();
        renderOverlay();
        setStatus("Vault imported.");
        var exportBtn = root.querySelector("[data-vault-export]");
        if (exportBtn) exportBtn.disabled = false;
      }));
    };
    reader.onerror = function () {
      setStatus("Could not read that file.");
    };
    reader.readAsText(file);
  }

  function onStageClick(event) {
    if (state.mode !== "drawing") return;
    if (event.target.closest("button, a, input, textarea, label")) return;
    var point = pointFromEvent(event);
    if (state.draft.length >= 3 && distPx(point, state.draft[0]) <= 18) {
      startNaming();
      return;
    }
    if (state.draft.length && distPx(point, state.draft[state.draft.length - 1]) < 8) return;
    state.draft.push(roundPoint(point));
    renderOverlay();
  }

  root.querySelector("[data-vault-draw]").addEventListener("click", startDrawing);

  root.querySelector("[data-vault-undo]").addEventListener("click", function () {
    if (state.mode !== "drawing" || !state.draft.length) return;
    state.draft.pop();
    renderOverlay();
  });

  root.querySelector("[data-vault-close-shape]").addEventListener("click", startNaming);

  root.querySelectorAll("[data-vault-cancel]").forEach(function (button) {
    button.addEventListener("click", cancelDraft);
  });

  namingForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (savingFolder) return;
    var name = namingInput.value.trim().slice(0, 80);
    if (!name) {
      setStatus("Give the folder a name.");
      namingInput.focus();
      return;
    }
    savingFolder = true;
    guard(saveFolder(name)).then(function () {
      savingFolder = false;
    });
  });

  root.querySelector("[data-vault-export]").addEventListener("click", exportVault);
  root.querySelector("[data-vault-import]").addEventListener("click", function () {
    importInput.click();
  });

  stage.addEventListener("click", onStageClick);
  stage.addEventListener("pointermove", function (event) {
    if (state.mode !== "drawing") return;
    state.cursor = pointFromEvent(event);
    renderOverlay();
  });
  stage.addEventListener("pointerleave", function () {
    if (state.mode !== "drawing" || !state.cursor) return;
    state.cursor = null;
    renderOverlay();
  });

  svg.addEventListener("click", function (event) {
    var poly = event.target.closest("[data-region-id]");
    if (!poly || state.mode !== "idle") return;
    openRegion(poly.getAttribute("data-region-id"));
  });
  svg.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var poly = event.target.closest("[data-region-id]");
    if (!poly || state.mode !== "idle") return;
    event.preventDefault();
    openRegion(poly.getAttribute("data-region-id"));
  });

  drawer.querySelector("[data-vault-scrim]").addEventListener("click", closeDrawer);
  drawer.querySelector("[data-vault-drawer-close]").addEventListener("click", closeDrawer);

  nameInput.addEventListener("change", renameOpenFolder);
  nameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      nameInput.blur();
    }
  });

  noteForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = noteField.value.trim();
    if (!text) return;
    addNote(text);
  });

  root.querySelector("[data-vault-photo]").addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    addPhotos(fileInput.files);
    fileInput.value = "";
  });

  importInput.addEventListener("change", function () {
    var file = importInput.files && importInput.files[0];
    importInput.value = "";
    if (file) importVault(file);
  });

  itemsEl.addEventListener("click", function (event) {
    var edit = event.target.closest("[data-vault-edit-note]");
    if (edit) {
      state.editingNoteId = edit.getAttribute("data-vault-edit-note");
      renderItems();
      var field = itemsEl.querySelector("[data-vault-note-edit]");
      if (field) field.focus();
      return;
    }
    var save = event.target.closest("[data-vault-save-note]");
    if (save) {
      saveNoteEdit(save.getAttribute("data-vault-save-note"));
      return;
    }
    if (event.target.closest("[data-vault-cancel-edit]")) {
      state.editingNoteId = null;
      renderItems();
      return;
    }
    var remove = event.target.closest("[data-vault-delete-item]");
    if (remove) {
      var item = findItem(remove.getAttribute("data-vault-delete-item"));
      if (item) deleteItem(item);
      return;
    }
    var photo = event.target.closest("[data-vault-open-photo]");
    if (photo) {
      var picture = findItem(photo.getAttribute("data-vault-open-photo"));
      if (picture) openPhoto(picture);
    }
  });

  root.querySelector("[data-vault-delete-region]").addEventListener("click", deleteOpenFolder);

  if (lightbox) {
    lightbox.addEventListener("click", function (event) {
      if (event.target === lightbox) lightbox.close();
    });
    var lightboxClose = root.querySelector("[data-vault-lightbox-close]");
    if (lightboxClose) {
      lightboxClose.addEventListener("click", function () { lightbox.close(); });
    }
    lightbox.addEventListener("close", function () {
      if (lightboxImg) {
        lightboxImg.removeAttribute("src");
        lightboxImg.alt = "";
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (!section || section.hidden) return;
    if (event.key === "Escape") {
      if (lightbox && lightbox.open) {
        lightbox.close();
        return;
      }
      if (state.openId) {
        closeDrawer();
        return;
      }
      if (state.mode !== "idle") cancelDraft();
      return;
    }
    if (event.key === "Backspace" && state.mode === "drawing") {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      if (!state.draft.length) return;
      state.draft.pop();
      renderOverlay();
    }
  });

  document.addEventListener("locus:section", function (event) {
    if (!event.detail || event.detail.id === "vault") return;
    closeLightbox();
    if (state.mode !== "idle") cancelDraft();
    else closeDrawer();
  });

  document.addEventListener("site:langchange", function () {
    applyPlaceholders();
    if (statusKey) setStatus(statusKey);
    renderItems();
  });

  if (image) {
    image.addEventListener("error", function () {
      setStatus("The room image could not be loaded.");
    });
  }

  applyPlaceholders();
  setMode("idle");

  getAll("regions").then(function (regions) {
    state.regions = regions.sort(function (a, b) { return a.createdAt - b.createdAt; });
    return getAll("items");
  }).then(function (items) {
    state.items = items;
    state.ready = true;
    syncChrome();
  }).catch(function () {
    state.ready = false;
    var drawBtn = root.querySelector("[data-vault-draw]");
    if (drawBtn) drawBtn.disabled = true;
    setStatus("Could not open the vault in this browser.");
  });
})();
