(function () {
  "use strict";

  const MAX_GENERATION_ATTEMPTS = 200;

  /** @type {Array<object>} */
  let drivers = [];
  /** @type {Array<object>} 3 Zeilen-Requirements */
  let rowRequirements = [];
  /** @type {Array<object>} 3 Spalten-Requirements */
  let colRequirements = [];
  /** cellIndex (row*3+col) -> driverId */
  let cellAnswers = new Array(9).fill(null);
  /** Set der bereits verwendeten Fahrer-IDs */
  let usedDriverIds = new Set();

  const gridBody = document.getElementById("grid-body");
  const colHeadRow = document.getElementById("col-headers");
  const rowHeadCells = [];
  const progressEl = document.getElementById("progress");
  const statusEl = document.getElementById("status-message");
  const newGameBtn = document.getElementById("new-game");

  function formatLabel(type, value) {
    return type.labelTemplate.replace("{value}", String(value));
  }

  function buildDynamicValues(types, driverList) {
    return types.map((type) => {
      if (type.values !== null) return type;
      if (type.id === "team") {
        const teams = new Set();
        driverList.forEach((d) => d.teams.forEach((t) => teams.add(t)));
        return Object.assign({}, type, { values: Array.from(teams) });
      }
      if (type.id === "nation") {
        const nations = new Set(driverList.map((d) => d.nation));
        return Object.assign({}, type, { values: Array.from(nations) });
      }
      return type;
    });
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildRequirement(type, value) {
    return {
      typeId: type.id,
      type: type,
      value: value,
      label: formatLabel(type, value),
      check: (driver) => type.check(driver, value)
    };
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Fahrer haben genau eine Nation, daher duerfen mehrere Nation-Anforderungen
  // nur auf EINER Achse (nur Zeilen ODER nur Spalten) vorkommen - sonst waere
  // eine Zelle mit z.B. "Deutscher" x "Brite" nie erfuellbar. Teams dagegen
  // duerfen mehrfach UND frei über Zeilen und Spalten gemischt vorkommen, da ein
  // Fahrer fuer mehrere Teams gefahren sein kann (typeId "team" hat
  // allowMultipleAnyAxis statt allowMultiple).
  function drawRequirementsWithNationRule(availableTypes) {
    // Pool aus Typ-Eintraegen mit eigener, veraenderbarer Werteliste, damit ein
    // "allowMultipleAnyAxis"-Typ (aktuell: team) mit unterschiedlichen Werten
    // mehrfach gezogen werden kann.
    const pool = availableTypes.map((type) => ({ type: type, remainingValues: type.values.slice() }));
    const rows = new Array(3).fill(null);
    const cols = new Array(3).fill(null);

    const nationIdx = pool.findIndex((entry) => entry.type.id === "nation" && entry.type.allowMultiple);
    const nationType = nationIdx >= 0 ? pool[nationIdx].type : null;
    const canUseMultiNation = nationType && nationType.values.length >= 2;

    if (canUseMultiNation && Math.random() < 0.4) {
      pool.splice(nationIdx, 1);
      const axisArr = Math.random() < 0.5 ? rows : cols;
      const maxCount = Math.min(3, nationType.values.length);
      const count = 2 + Math.floor(Math.random() * (maxCount - 1));
      const values = shuffle(nationType.values).slice(0, count);
      for (let i = 0; i < count; i++) {
        axisArr[i] = buildRequirement(nationType, values[i]);
      }
    }

    const remainingSlots = [];
    for (let i = 0; i < 3; i++) if (!rows[i]) remainingSlots.push({ arr: rows, i });
    for (let i = 0; i < 3; i++) if (!cols[i]) remainingSlots.push({ arr: cols, i });

    for (const slot of remainingSlots) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      const entry = pool[idx];
      const valueIdx = Math.floor(Math.random() * entry.remainingValues.length);
      const value = entry.remainingValues.splice(valueIdx, 1)[0];
      slot.arr[slot.i] = buildRequirement(entry.type, value);

      const canRepeat = entry.type.allowMultipleAnyAxis && entry.remainingValues.length > 0;
      if (!canRepeat) pool.splice(idx, 1);
    }

    if (rows.some((r) => !r) || cols.some((c) => !c)) return null;
    return { rows, cols };
  }

  // Kuhn's Algorithmus: prueft, ob ein perfektes Matching der Groesse 9 existiert.
  function isSolvable(rows, cols, driverList) {
    const candidateLists = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const candidates = driverList.filter(
          (d) => rows[r].check(d) && cols[c].check(d)
        );
        candidateLists.push(candidates);
      }
    }
    if (candidateLists.some((list) => list.length === 0)) {
      return { solvable: false, candidateLists, matchCount: 0 };
    }

    const matchForDriver = new Map(); // driverId -> cellIndex
    function tryAssign(cellIndex, visited) {
      for (const driver of candidateLists[cellIndex]) {
        if (visited.has(driver.id)) continue;
        visited.add(driver.id);
        const currentOwner = matchForDriver.get(driver.id);
        if (currentOwner === undefined || tryAssign(currentOwner, visited)) {
          matchForDriver.set(driver.id, cellIndex);
          return true;
        }
      }
      return false;
    }

    let matched = 0;
    for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
      if (tryAssign(cellIndex, new Set())) matched++;
    }

    return { solvable: matched === 9, candidateLists, matchCount: matched };
  }

  function fallbackRequirements() {
    // Garantiert loesbares Notfall-Grid: alle "1+ Starts", differenziert per Team/Nation.
    const anyType = { id: "starts", labelTemplate: "{value}+ Starts", check: (d, v) => d.starts >= v };
    return {
      rows: [1, 1, 1].map((v) => ({
        typeId: "starts",
        value: v,
        label: "1+ Starts",
        check: (d) => d.starts >= 1
      })),
      cols: [1, 1, 1].map((v) => ({
        typeId: "starts",
        value: v,
        label: "1+ Starts",
        check: (d) => d.starts >= 1
      }))
    };
  }

  function generateGrid(allTypes, driverList) {
    const typesWithValues = buildDynamicValues(allTypes, driverList);

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const drawn = drawRequirementsWithNationRule(typesWithValues);
      if (drawn === null) continue;
      const { rows, cols } = drawn;

      const result = isSolvable(rows, cols, driverList);
      if (result.solvable) {
        return { rows, cols };
      }

      // Optimierung: ersetze bei Fehlschlag nur das schwaechste Requirement
      // (wenige Versuche lang), statt komplett neu zu ziehen.
    }

    console.warn("Grid-Generierung: Limit erreicht, verwende Notfall-Requirements.");
    return fallbackRequirements();
  }

  function renderGrid() {
    colHeadRow.innerHTML = "";
    const corner = document.createElement("th");
    corner.className = "corner";
    colHeadRow.appendChild(corner);
    colRequirements.forEach((req) => {
      const th = document.createElement("th");
      th.textContent = req.label;
      colHeadRow.appendChild(th);
    });

    gridBody.innerHTML = "";
    rowHeadCells.length = 0;

    for (let r = 0; r < 3; r++) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = rowRequirements[r].label;
      tr.appendChild(th);

      for (let c = 0; c < 3; c++) {
        const td = document.createElement("td");
        td.className = "cell";
        const cellIndex = r * 3 + c;
        td.appendChild(buildCell(cellIndex));
        tr.appendChild(td);
      }
      gridBody.appendChild(tr);
    }
  }

  function buildCell(cellIndex) {
    const wrapper = document.createElement("div");
    wrapper.className = "cell-inner";
    wrapper.dataset.cellIndex = String(cellIndex);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = window.matchMedia("(max-width: 640px)").matches ? "Suchen..." : "Fahrer suchen...";
    input.autocomplete = "off";

    const errorMsg = document.createElement("div");
    errorMsg.className = "error-msg";

    const list = document.createElement("div");
    list.className = "autocomplete-list";
    list.hidden = true;

    let activeIndex = -1;

    function closeList() {
      list.hidden = true;
      list.innerHTML = "";
      activeIndex = -1;
    }

    function renderSuggestions(query) {
      list.innerHTML = "";
      activeIndex = -1;
      const trimmed = query.trim().toLowerCase();
      if (trimmed.length === 0) {
        closeList();
        return;
      }
      const matches = drivers
        .filter((d) => !usedDriverIds.has(d.id) || cellAnswers[cellIndex] === d.id)
        .filter((d) => d.name.toLowerCase().includes(trimmed))
        .slice(0, 8);

      if (matches.length === 0) {
        const div = document.createElement("div");
        div.className = "no-match";
        div.textContent = "Keine Treffer";
        list.appendChild(div);
        list.hidden = false;
        return;
      }

      matches.forEach((driver) => {
        const div = document.createElement("div");
        div.textContent = driver.name;
        div.dataset.driverId = String(driver.id);
        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          selectDriver(driver);
        });
        list.appendChild(div);
      });
      list.hidden = false;
    }

    function selectDriver(driver) {
      errorMsg.textContent = "";
      if (usedDriverIds.has(driver.id) && cellAnswers[cellIndex] !== driver.id) {
        errorMsg.textContent = "Fahrer bereits verwendet.";
        closeList();
        input.value = "";
        return;
      }

      const rowReq = rowRequirements[Math.floor(cellIndex / 3)];
      const colReq = colRequirements[cellIndex % 3];
      const isCorrect = rowReq.check(driver) && colReq.check(driver);

      if (!isCorrect) {
        wrapper.classList.add("shake");
        errorMsg.textContent = "Erfuellt nicht beide Anforderungen.";
        setTimeout(() => wrapper.classList.remove("shake"), 400);
        closeList();
        input.value = "";
        return;
      }

      cellAnswers[cellIndex] = driver.id;
      usedDriverIds.add(driver.id);
      renderFilledCell(driver);
      closeList();
      updateProgress();
    }

    function renderFilledCell(driver) {
      wrapper.classList.add("correct");
      wrapper.innerHTML = "";
      const filled = document.createElement("div");
      filled.className = "cell-filled";

      if (driver.image) {
        const img = document.createElement("img");
        img.src = driver.image;
        img.alt = driver.name;
        img.onerror = () => {
          img.remove();
          filled.prepend(buildAvatarFallback(driver.name));
        };
        filled.appendChild(img);
      } else {
        filled.appendChild(buildAvatarFallback(driver.name));
      }

      const nameEl = document.createElement("div");
      nameEl.className = "driver-name";
      nameEl.textContent = driver.name;
      filled.appendChild(nameEl);

      wrapper.appendChild(filled);
    }

    function buildAvatarFallback(name) {
      const div = document.createElement("div");
      div.className = "avatar-fallback";
      const initials = name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      div.textContent = initials;
      return div;
    }

    input.addEventListener("input", () => renderSuggestions(input.value));
    input.addEventListener("focus", () => renderSuggestions(input.value));
    input.addEventListener("blur", () => setTimeout(closeList, 150));
    input.addEventListener("keydown", (e) => {
      const items = list.querySelectorAll("div[data-driver-id]");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length === 0) return;
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length === 0) return;
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          const id = Number(items[activeIndex].dataset.driverId);
          const driver = drivers.find((d) => d.id === id);
          if (driver) selectDriver(driver);
        }
      } else if (e.key === "Escape") {
        closeList();
      }
    });

    wrapper.appendChild(input);
    wrapper.appendChild(list);
    wrapper.appendChild(errorMsg);
    return wrapper;
  }

  function updateProgress() {
    const filled = cellAnswers.filter((a) => a !== null).length;
    progressEl.textContent = `${filled} von 9 ausgefuellt`;
    if (filled === 9) {
      statusEl.textContent = "Glueckwunsch, Grid komplett!";
    } else {
      statusEl.textContent = "";
    }
  }

  function startNewGame() {
    cellAnswers = new Array(9).fill(null);
    usedDriverIds = new Set();
    statusEl.textContent = "";
    const { rows, cols } = generateGrid(requirementTypes, drivers);
    rowRequirements = rows;
    colRequirements = cols;
    renderGrid();
    updateProgress();
  }

  async function init() {
    try {
      const response = await fetch("drivers.json");
      drivers = await response.json();
    } catch (err) {
      statusEl.textContent = "Fehler beim Laden der Fahrerdaten.";
      console.error(err);
      return;
    }
    newGameBtn.addEventListener("click", startNewGame);
    startNewGame();
  }

  init();
})();
