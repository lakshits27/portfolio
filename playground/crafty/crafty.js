(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const STORAGE_KEY = "crafty-discoveries-v1";
  const KEY_SESSION = "crafty-gemini-key";
  const MODEL_SESSION = "crafty-gemini-model";
  const starters = [
    { id: "water", name: "Water", emoji: "💧", description: "The beginning of life." },
    { id: "fire", name: "Fire", emoji: "🔥", description: "A spark of energy." },
    { id: "earth", name: "Earth", emoji: "🌍", description: "The ground beneath everything." },
    { id: "wind", name: "Wind", emoji: "🌬️", description: "Air in motion." }
  ];

  let discoveries = loadDiscoveries();
  let board = [];
  let selected = [];
  let busy = false;
  let lastResult = null;

  function loadDiscoveries() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) {
        const unique = new Map(starters.map(item => [item.id, item]));
        saved.forEach(item => {
          if (item && typeof item.name === "string" && typeof item.emoji === "string") {
            const id = String(item.id || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 80);
            if (!unique.has(id)) unique.set(id, { id, name: item.name.slice(0, 50), emoji: item.emoji.slice(0, 12), description: String(item.description || "").slice(0, 180) });
          }
        });
        return [...unique.values()];
      }
    } catch (_) {}
    return [...starters];
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(discoveries));
      $("#saveState").textContent = "Saved locally";
    } catch (_) {
      $("#saveState").textContent = "Save unavailable";
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function getElement(id) {
    return discoveries.find(item => item.id === id);
  }

  function makeElement(item, inBoard = false) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "element" + (selected.includes(item.id) && inBoard ? " selected" : "");
    node.dataset.id = item.id;
    node.draggable = true;
    node.setAttribute("aria-label", item.name + (inBoard ? ", on workbench" : ", add to workbench"));
    node.innerHTML = '<span class="emoji" aria-hidden="true">' + escapeHTML(item.emoji) + '</span><span class="element-name">' + escapeHTML(item.name) + '</span>';
    if (inBoard) {
      node.addEventListener("click", () => toggleSelection(item.id));
      node.addEventListener("dblclick", () => removeFromBoard(item.id));
      node.title = "Click to select · double-click to remove";
    } else {
      node.addEventListener("click", () => addToBoard(item.id));
      node.title = "Add to workbench";
    }
    node.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", item.id);
      event.dataTransfer.effectAllowed = "copy";
    });
    return node;
  }

  function render() {
    const boardNode = $("#board");
    boardNode.querySelectorAll(".element").forEach(node => node.remove());
    $("#boardHint").hidden = board.length > 0;
    board.forEach(id => {
      const item = getElement(id);
      if (item) boardNode.appendChild(makeElement(item, true));
    });
    $("#elements").replaceChildren();
    const query = $("#searchInput").value.trim().toLowerCase();
    const filtered = discoveries.filter(item => item.name.toLowerCase().includes(query));
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-search";
      empty.textContent = "No discoveries found.";
      $("#elements").appendChild(empty);
    } else {
      filtered.slice().reverse().forEach(item => $("#elements").appendChild(makeElement(item)));
    }
    $("#discoveryCount").textContent = discoveries.length;
    $("#collectionLabel").textContent = discoveries.length + (discoveries.length === 1 ? " discovery" : " discoveries");
    $("#combineButton").disabled = selected.length !== 2 || busy;
    $("#combineStatus").textContent = busy ? "Asking AI to imagine..." : selected.length === 2 ? "Ready to combine" : selected.length === 1 ? "Choose one more element" : "Select two elements to combine";
  }

  function addToBoard(id) {
    if (board.includes(id)) {
      toggleSelection(id);
      return;
    }
    if (board.length >= 12) {
      showMessage("Your workbench is full. Remove an element first.");
      return;
    }
    board.push(id);
    render();
  }

  function removeFromBoard(id) {
    board = board.filter(value => value !== id);
    selected = selected.filter(value => value !== id);
    render();
  }

  function toggleSelection(id) {
    if (!board.includes(id)) addToBoard(id);
    if (selected.includes(id)) selected = selected.filter(value => value !== id);
    else {
      if (selected.length === 2) selected.shift();
      selected.push(id);
    }
    render();
  }

  function showMessage(message) {
    $("#combineStatus").textContent = message;
  }

  function setBusy(value) {
    busy = value;
    $("#combineButton").disabled = value || selected.length !== 2;
    $("#combineButton").querySelector("span:first-child").textContent = value ? "Creating..." : "Combine";
    $("#combineStatus").textContent = value ? "Asking AI to imagine..." : selected.length === 2 ? "Ready to combine" : "Select two elements to combine";
  }

  function fallbackEmoji(name) {
    const text = name.toLowerCase();
    const rules = [
      [/water|rain|ocean|sea|river|lake|ice|snow|steam|cloud/, "💧"],
      [/fire|flame|lava|volcano|sun|star|heat/, "🔥"],
      [/earth|soil|land|mountain|rock|stone|planet/, "🌍"],
      [/wind|air|storm|breeze|tornado/, "🌪️"],
      [/plant|tree|forest|flower|leaf|grass/, "🌿"],
      [/animal|bird|fish|wolf|cat|dog|dragon/, "🐾"],
      [/music|song|sound|rhythm/, "🎵"],
      [/time|clock|future|past/, "⏳"],
      [/light|energy|electric|spark/, "✨"],
      [/life|human|person|people/, "🧬"],
      [/food|bread|fruit|cake|soup/, "🍃"]
    ];
    const match = rules.find(([pattern]) => pattern.test(text));
    return match ? match[1] : "🪄";
  }

  async function combine() {
    if (selected.length !== 2 || busy) return;
    const first = getElement(selected[0]);
    const second = getElement(selected[1]);
    if (!first || !second) return;
    const apiKey = sessionStorage.getItem(KEY_SESSION);
    if (!apiKey) {
      $("#settingsMessage").textContent = "Add your Gemini API key to start creating.";
      $("#settingsDialog").showModal();
      $("#apiKey").focus();
      return;
    }

    setBusy(true);
    $("#resultArea").replaceChildren();
    try {
      const model = sessionStorage.getItem(MODEL_SESSION) || "gemini-2.5-flash";
      const prompt = [
        "You are the creative combination engine for a playful discovery game.",
        "Combine these two concepts: " + first.name + " + " + second.name + ".",
        "Invent one satisfying result. Prefer a real, recognizable concept when possible; otherwise make a clever, understandable new concept.",
        "The combination is commutative: order does not matter.",
        "Return ONLY valid JSON with exactly these keys: name, emoji, description.",
        "name: short name, 1 to 4 words. emoji: one or two relevant emoji. description: one concise sentence, maximum 18 words.",
        "Do not include markdown or any text outside the JSON."
      ].join("\n");
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, responseMimeType: "application/json" }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        const apiMessage = payload && payload.error && payload.error.message;
        throw new Error(apiMessage || "Gemini request failed (" + response.status + ").");
      }
      const raw = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
      if (!raw) throw new Error("The AI returned an empty result. Try again.");
      const result = JSON.parse(raw.replace(/^\u0060{3}(?:json)?\s*/i, "").replace(/\s*\u0060{3}$/i, ""));
      if (!result || typeof result.name !== "string" || !result.name.trim()) throw new Error("The AI response did not contain a valid result.");
      const name = result.name.trim().slice(0, 50);
      const emoji = typeof result.emoji === "string" && result.emoji.trim() ? result.emoji.trim().slice(0, 12) : fallbackEmoji(name);
      const description = typeof result.description === "string" ? result.description.trim().slice(0, 180) : "A new discovery made by combining " + first.name + " and " + second.name + ".";
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65) || "discovery-" + Date.now();
      let item = discoveries.find(value => value.name.toLowerCase() === name.toLowerCase());
      const isNew = !item;
      if (!item) {
        item = { id: id + (discoveries.some(value => value.id === id) ? "-" + discoveries.length : ""), name, emoji, description };
        discoveries.push(item);
        save();
      }
      board = board.filter(value => value !== first.id && value !== second.id);
      if (!board.includes(item.id)) board.push(item.id);
      selected = [];
      lastResult = { item, isNew, first, second };
      render();
      showResult(lastResult);
    } catch (error) {
      showMessage(error.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      render();
    }
  }

  function showResult(result) {
    const area = $("#resultArea");
    area.innerHTML = '<span class="result-emoji" aria-hidden="true">' + escapeHTML(result.item.emoji) + '</span><div class="result-copy"><strong>' + escapeHTML(result.item.name) + (result.isNew ? " · New discovery" : " · Already discovered") + '</strong><span>' + escapeHTML(result.item.description) + '</span></div><span class="result-tag">AI MADE</span>';
  }

  $("#board").addEventListener("dragover", event => {
    event.preventDefault();
    $("#board").classList.add("drag-over");
  });
  $("#board").addEventListener("dragleave", event => {
    if (!$("#board").contains(event.relatedTarget)) $("#board").classList.remove("drag-over");
  });
  $("#board").addEventListener("drop", event => {
    event.preventDefault();
    $("#board").classList.remove("drag-over");
    const id = event.dataTransfer.getData("text/plain");
    if (getElement(id)) addToBoard(id);
  });
  $("#combineButton").addEventListener("click", combine);
  $("#searchInput").addEventListener("input", render);
  $("#clearBoard").addEventListener("click", () => {
    board = [];
    selected = [];
    $("#resultArea").replaceChildren();
    render();
  });
  $("#resetGame").addEventListener("click", () => {
    if (!window.confirm("Reset all discoveries and start again with the four basic elements?")) return;
    discoveries = [...starters];
    board = [];
    selected = [];
    lastResult = null;
    localStorage.removeItem(STORAGE_KEY);
    $("#resultArea").replaceChildren();
    save();
    render();
  });

  $("#settingsButton").addEventListener("click", () => {
    $("#apiKey").value = sessionStorage.getItem(KEY_SESSION) || "";
    $("#modelSelect").value = sessionStorage.getItem(MODEL_SESSION) || "gemini-2.5-flash";
    $("#settingsMessage").textContent = "";
    $("#settingsDialog").showModal();
  });
  $("#saveSettings").addEventListener("click", () => {
    const key = $("#apiKey").value.trim();
    if (!key) {
      $("#settingsMessage").textContent = "Paste a Gemini API key first.";
      return;
    }
    sessionStorage.setItem(KEY_SESSION, key);
    sessionStorage.setItem(MODEL_SESSION, $("#modelSelect").value);
    $("#settingsMessage").textContent = "Settings saved for this tab.";
    setTimeout(() => $("#settingsDialog").close(), 650);
  });
  $("#removeKey").addEventListener("click", () => {
    sessionStorage.removeItem(KEY_SESSION);
    sessionStorage.removeItem(MODEL_SESSION);
    $("#apiKey").value = "";
    $("#settingsMessage").textContent = "API key removed from this tab.";
  });

  render();
  if (!sessionStorage.getItem(KEY_SESSION)) {
    $("#combineStatus").textContent = "Add a Gemini API key in settings to begin";
  }
})();
