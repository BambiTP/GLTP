import { processLeaderboardData } from "./leaderboard.js";
import { dataUrl, setupNavigation } from './shared.js';

//TODO verify names by user ID and not only by name for white names

let recordsByMap = {};
let mapMetadata = {};
let completionSortKey = null;
let completionSortAsc = true;

const mergedProfiles = {
  "group1": {
    user_ids: ["5c59418b6c57cf3971151579", "52bb02613330151206000004"],
    names: ["FWO", "DAD.", "::"]
  }
};



async function loadData() {
  const res = await fetch("https://gltp.fwotagprodad.workers.dev/records");
  const raw = await res.json();
  const { recordsByMap: rbm } = processLeaderboardData(raw); //TODO the "keys are all lowercase. time to change to ID?"
  recordsByMap = rbm;

  const metadataRes = await fetch("./map_metadata.json");
  mapMetadata = await metadataRes.json();
  return Object.keys(mapMetadata).length;
}

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

// Exact match by player name OR exact ID
function searchPlayer(query) {
  const q = normalize(query);
  const seen = new Set();
  const out = [];

  for (const records of Object.values(recordsByMap)) {
    for (const r of records) {
      let match = false;

      // exact match on capping player name or ID
      if (normalize(r.capping_player) === q || normalize(r.capping_player_user_id) === q) {
        match = true;
      }

      // exact match on any teammate name or ID
      if (!match) {
        for (const p of r.players) {
          if (normalize(p.name) === q || normalize(p.user_id) === q) {
            match = true;
            break;
          }
        }
      }

      if (match && !seen.has(r.uuid)) {
        seen.add(r.uuid);
        out.push(r);
      }
    }
  }

  return out;
}

function findMergeGroup(query) {
  const qNorm = normalize(query);
  for (const group of Object.values(mergedProfiles)) {
    const idMatch = (group.user_ids || []).some(id => normalize(id) === qNorm);
    const nameMatch = (group.names || []).some(n => normalize(n) === qNorm);
    if (idMatch || nameMatch) return group;
  }
  return null;
}

function countTopRecords(playerNames, playerIds, statKey, topN = 3) {
  let count = 0;

  for (const [mapId, records] of Object.entries(recordsByMap)) {
    const meta = mapMetadata[mapId];
    if (!meta) continue;

    if (
      statKey === "total_jumps" &&
      (meta.grav_or_classic === "Classic" || (meta.categories || []).includes("0 jump"))
    ) {
      continue;
    }

    const sorted = [...records]
      .sort((a, b) => {
        if (statKey === "total_jumps") {
          const jumpDiff = a.total_jumps - b.total_jumps;
          if (jumpDiff !== 0) return jumpDiff;
          return a.record_time - b.record_time;
        }
        return a[statKey] - b[statKey];
      })
      .slice(0, topN);

    if (
      sorted.some(r =>
        r.players.some(
          p =>
            (playerNames && playerNames.includes(p.name)) ||
            (playerIds && playerIds.includes(p.user_id))
        )
      )
    ) {
      count++;
    }
  }

  return count;
}

function summarizePlayer(records, query) {
  if (!records || !records.length) return null;

  const qNorm = normalize(query);
  const group = findMergeGroup(query);

  const groupIds = new Set(group?.user_ids || []);
  const groupNamesNorm = new Set((group?.names || []).map(n => normalize(n)));

  // Filter records: match if ANY player in the team matches the group IDs or group names (normalized)
  const relevantRecords = records.filter(r => {
    if (!r.players || r.players.length === 0) return false;

    if (group) {
      const idHit = r.players.some(p => p.user_id && groupIds.has(p.user_id));
      const nameHit = r.players.some(p => p.name && groupNamesNorm.has(normalize(p.name)));
      return idHit || nameHit;
    }

    // Fallback: match by the query itself (id or name)
    return r.players.some(
      p => normalize(p.user_id) === qNorm || normalize(p.name) === qNorm
    );
  });

  if (!relevantRecords.length) return null;

  // Aggregate stats from relevantRecords
  const timestamps = relevantRecords.map(r => r.timestamp).sort();
  const first = new Date(timestamps[0]).toLocaleDateString();
  const last = new Date(timestamps[timestamps.length - 1]).toLocaleDateString();
  const maps = new Set(relevantRecords.map(r => r.map_id));

    // Names: strictly from mergedProfiles group (do NOT add names from records)
    // Names: if merged, use aliases; if not merged, leave empty so enhanceSummaryName can fill in
    const names = group ? [...group.names] : [];


  // IDs: include configured group IDs plus any encountered IDs for matched players
  const encounteredIds = new Set();
  for (const r of relevantRecords) {
    for (const p of r.players) {
      if (!p.user_id) continue;
      if (group) {
        // Only collect IDs that belong to the group
        if (groupIds.has(p.user_id)) encounteredIds.add(p.user_id);
      } else {
        // Fallback mode: collect IDs that match the query
        if (normalize(p.user_id) === qNorm || normalize(p.name) === qNorm) {
          encounteredIds.add(p.user_id);
        }
      }
    }
  }
  const user_ids = Array.from(new Set([...(group?.user_ids || []), ...encounteredIds]));

// Count top 3 records across all aliases
const top3Time = countTopRecords(names, user_ids, "record_time", 3);
const top3Jumps = countTopRecords(names, user_ids, "total_jumps", 3);

const top1Time = countTopRecords(names, user_ids, "record_time", 1);
const top1Jumps = countTopRecords(names, user_ids, "total_jumps", 1);

  return {
    name: names.join(" / "),
    names,
    user_ids,
    first,
    last,
    totalMaps: maps.size,
    totalRuns: relevantRecords.length,
    top3Time,
    top3Jumps,
    top1Time,
    top1Jumps
  };
}

async function enhanceSummaryName(summary) {
  if (!summary) return null;

  // Fetch canonical names for the group's user_ids
  const canonical = [];
  if (summary.user_ids && summary.user_ids.length > 0) {
    for (const id of summary.user_ids) {
      if (!id) continue;
      try {
        const tagproName = await fetchTagProName(id);
        if (tagproName) canonical.push(tagproName);
      } catch (err) {
        console.warn("Could not fetch TagPro name for", id, err);
      }
    }
  }

  // If merged group: combine canonical names with aliases
  if (summary.names && summary.names.length > 0) {
    const canonSet = new Set(canonical.map(n => normalize(n)));
    const aliasTail = summary.names.filter(n => !canonSet.has(normalize(n)));
    const merged = [...canonical, ...aliasTail];
    summary.names = merged;
    summary.name = merged.join(" / ");
  } else if (canonical.length > 0) {
    // Not merged: just show canonical TagPro names
    summary.names = canonical;
    summary.name = canonical.join(" / ");
  }

  return summary;
}

async function renderSummary(summary) {
  const div = document.getElementById("playerSummary");

  if (!summary) {
    div.innerHTML = "<p>No summary available.</p>";
    div.style.display = "block";
    return;
  }

  const displayName = summary.names && summary.names.length
    ? summary.names.join(" / ")
    : summary.name || "";
//TODO get rid of innerHTML
  div.innerHTML = `
    <div class="player-summary-box">
      <h2>${displayName}</h2>
      ${
        summary.user_ids && summary.user_ids.length > 0
          ? summary.user_ids
              .filter(id => id)
              .map(
                id => `
          <p class="player-id">User ID: ${id}</p>
          <p>
            <a href="/GLTP/player.html?user_id=${id}">Local Profile</a> |
            <a href="https://tagpro.koalabeast.com/profile/${id}" target="_blank">TagPro Profile</a>
          </p>
        `
              )
              .join("")
          : ""
      }
      <div class="summary-grid">
        <div><span>First game:</span> ${summary.first}</div>
        <div><span>Most recent:</span> ${summary.last}</div>
        <div><span>Unique Maps completed:</span> ${summary.totalMaps}</div>
        <div><span>Total games:</span> ${summary.totalRuns}</div>
        <div><span>Top 1 (Fastest Time):</span> <span class="badge gold">🏆 ${summary.top1Time}</span></div>
        <div><span>Top 1 (Lowest Jumps):</span> <span class="badge gold">🏆 ${summary.top1Jumps}</span></div>
        <div><span>Top 3 (Fastest Time):</span> <span class="badge bronze">🥉 ${summary.top3Time}</span></div>
        <div><span>Top 3 (Lowest Jumps):</span> <span class="badge bronze">🥉 ${summary.top3Jumps}</span></div>
    </div>
    </div>
  `;
  div.style.display = "block";
}

function setupCompletionFilters(records, summary) {
  const gravitySelect = document.getElementById("gravityFilter");
  const playModeSelect = document.getElementById("playModeFilter");
  const completionSelect = document.getElementById("completionFilter");
  const searchInput = document.getElementById("completionSearch");
  const clearBtn = document.getElementById("completion-search-clear");

  function applyCompletionFilters() {
    const gravityVal = gravitySelect.value.toLowerCase();
    const playModeVal = playModeSelect.value;
    const completionVal = completionSelect.value;
    const searchTerm = searchInput.value.toLowerCase().trim();

    // ✅ Define allMaps here
    const allMaps = Object.entries(mapMetadata).map(([mapId, meta]) => ({
      map_id: mapId,
      ...meta
    }));

    const beaten = new Set(records.map(r => r.map_id));

    const filteredMaps = allMaps.filter(m => {
      const mapType = (m.grav_or_classic || "").toLowerCase();
      const categories = m.categories || [];

      // Gravity filter
      let matchesGravity = true;
      if (gravityVal === "grav") matchesGravity = mapType === "grav";
      else if (gravityVal === "classic") matchesGravity = mapType === "classic";
      else if (gravityVal === "unbeaten") {
        matchesGravity = !beaten.has(m.map_id);
      }

      // Play Mode filter
      const matchesPlayMode = !playModeVal || categories.includes(playModeVal);

      // Completion Style filter
      const matchesCompletion = !completionVal || categories.includes(completionVal);

      // Search filter
      const matchesSearch =
        (m.map_name || "").toLowerCase().includes(searchTerm) ||
        (m.author && m.author.toLowerCase().includes(searchTerm));

      return matchesGravity && matchesPlayMode && matchesCompletion && matchesSearch;
    });

    renderCompletion(records, summary, null, true, filteredMaps);
  }

  // Event listeners
  [gravitySelect, playModeSelect, completionSelect].forEach(sel => {
    sel.addEventListener("change", applyCompletionFilters);
  });
  searchInput.addEventListener("input", () => {
    clearBtn.style.display = searchInput.value ? "inline-block" : "none";
    applyCompletionFilters();
  });
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    applyCompletionFilters();
  });

  // Initial render
  applyCompletionFilters();
}



async function fetchTagProName(user_id) {
  const url = `https://tagpro.koalabeast.com/profile/${user_id}`;
  const proxies = [
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url='
  ];

  let response;
  for (const proxy of proxies) {
    try {
      response = await fetch(proxy + url);
      if (response.ok) break;
    } catch (err) {
      console.log(`Proxy ${proxy} failed:`, err);
    }
  }

  if (!response || !response.ok) {
    throw new Error("Failed to fetch profile HTML");
  }

  const html = await response.text();

  // Parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Try reserved name span first, then normal name span
  const reserved = doc.querySelector("span.reserved");
  const normal = doc.querySelector("span.name");

  return reserved?.textContent.trim() || normal?.textContent.trim() || null;
}



function renderRuns(records) {
  const gravityVal = document.getElementById("gravityFilter").value.toLowerCase();
  const playModeVal = document.getElementById("playModeFilter").value;
  const completionVal = document.getElementById("completionFilter").value;

  const filtered = records.filter(r => {
    const meta = mapMetadata[r.map_id] || {};
    const categories = meta.categories || [];
    const type = (meta.grav_or_classic || "").toLowerCase();

    const matchesGravity = gravityVal === "" || type === gravityVal;
    const matchesPlayMode = !playModeVal || categories.includes(playModeVal);
    const matchesCompletion = !completionVal || categories.includes(completionVal);

    return matchesGravity && matchesPlayMode && matchesCompletion;
  });

  const tbody = document.getElementById("playerRunsBody");
  tbody.innerHTML = "";
  filtered.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.map_name}</td>
      <td>${formatTime(r.record_time)}</td>
      <td>${new Date(r.timestamp).toLocaleDateString()}</td>
      <td>${r.uuid ? `<a href="https://tagpro.koalabeast.com/replays?uuid=${r.uuid}" target="_blank">Replay</a>` : ""}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("playerRunsContainer").style.display = "block";
  document.getElementById("playerRunsTable").style.display = "table";
  document.getElementById("runsHeader").style.display = "block";
}

function renderCompletion(records, summary=null, sortKey=null, sortAsc=true, mapsOverride=null) {

  completionSortKey = sortKey;
  completionSortAsc = sortAsc;

  const beatenMapStats = {};
  records.forEach(r => {
    const key = r.map_id;
    if (!beatenMapStats[key]) {
      beatenMapStats[key] = {
        attempts: 1,
        bestTime: r.record_time,
        minJumps: r.total_jumps,
        runs: [r]
      };
    } else {
      beatenMapStats[key].attempts += 1;
      if (r.record_time < beatenMapStats[key].bestTime) {
        beatenMapStats[key].bestTime = r.record_time;
      }
      if (r.total_jumps < beatenMapStats[key].minJumps) {
        beatenMapStats[key].minJumps = r.total_jumps;
      }
      beatenMapStats[key].runs.push(r);
    }
  });

  let mapsToRender = mapsOverride || Object.entries(mapMetadata).map(([mapId, meta]) => ({
    mapId,
    ...meta
  }));
  
  if (sortKey) {
    mapsToRender.sort((a, b) => {
      const keyA = getSortValue(a, sortKey, beatenMapStats);
      const keyB = getSortValue(b, sortKey, beatenMapStats);
      if (keyA < keyB) return sortAsc ? -1 : 1;
      if (keyA > keyB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  const tbody = document.getElementById("completionBody");
  tbody.innerHTML = "";

  mapsToRender.forEach(m => {
    const key = m.map_id;
    const stats = beatenMapStats[key];
    const attempts = stats ? stats.attempts : 0;

    // Safe helper
    function getBestRun(runs, statKey) {
    if (!Array.isArray(runs) || runs.length === 0) return null;
    return runs.reduce((best, r) => (r[statKey] < best[statKey] ? r : best));
    }

    const allRuns = Array.isArray(recordsByMap[key]) ? recordsByMap[key] : [];
    const bestTimeRun = getBestRun(allRuns, "record_time");
    const bestJumpRun = getBestRun(allRuns, "total_jumps");

    // Check if current player (summary context) is in those runs
    const holdsTime = bestTimeRun && bestTimeRun.players.some(p =>
    summary.user_ids.includes(p.user_id) || summary.names.includes(p.name)
    );
    const holdsJumps = bestJumpRun && bestJumpRun.players.some(p =>
    summary.user_ids.includes(p.user_id) || summary.names.includes(p.name)
    );


    function getTopRuns(runs, statKey, topN) {
        if (!Array.isArray(runs) || runs.length === 0) return [];
        return [...runs].sort((a, b) => a[statKey] - b[statKey]).slice(0, topN);
    }

    const top1TimeRun = getTopRuns(allRuns, "record_time", 1)[0];
    const top1JumpRun = getTopRuns(allRuns, "total_jumps", 1)[0];
    const top3TimeRuns = getTopRuns(allRuns, "record_time", 3);
    const top3JumpRuns = getTopRuns(allRuns, "total_jumps", 3);

    const holdsTop1Time = top1TimeRun && top1TimeRun.players.some(p =>
    summary.user_ids.includes(p.user_id) || summary.names.includes(p.name)
    );
    const holdsTop1Jumps = top1JumpRun && top1JumpRun.players.some(p =>
    summary.user_ids.includes(p.user_id) || summary.names.includes(p.name)
    );

    const holdsTop3Time = top3TimeRuns.some(r =>
    r.players.some(p => summary.user_ids.includes(p.user_id) || summary.names.includes(p.name))
    );
    const holdsTop3Jumps = top3JumpRuns.some(r =>
    r.players.some(p => summary.user_ids.includes(p.user_id) || summary.names.includes(p.name))
    );

    // Main row
    const tr = document.createElement("tr");
    tr.classList.add("completion-row");
    // detect classic maps
    const isClassic = m.grav_or_classic === "Classic";
    const isZeroJumpCategory = (m.categories || []).includes("0 jump");

    // Decide what to show in jump cell
    let jumpDisplay;
    if (isClassic || isZeroJumpCategory) {
    jumpDisplay = "N/A";
    } else {
    jumpDisplay = stats ? stats.minJumps : "-";
    }

    tr.innerHTML = `
    <td>${m.map_name}</td>
    <td>${attempts > 0 ? "✅" : "❌"}</td>
    <td>${attempts}</td>
    <td>
        ${stats ? formatTime(stats.bestTime) : "-"}
        ${holdsTop1Time ? '<span class="badge gold">🏆</span>' : ""}
        ${!holdsTop1Time && holdsTop3Time ? '<span class="badge bronze">🥉</span>' : ""}
    </td>
    <td>
        ${jumpDisplay}
        ${!(isClassic || isZeroJumpCategory) && holdsTop1Jumps ? '<span class="badge gold">🏆</span>' : ""}
        ${!(isClassic || isZeroJumpCategory) && !holdsTop1Jumps && holdsTop3Jumps ? '<span class="badge bronze">🥉</span>' : ""}
    </td>
    <td>${m.difficulty ?? "-"}</td>
    <td>${m.balls_req ?? "-"}</td>
    `;



    // Details row
    const detailsTr = document.createElement("tr");
    detailsTr.classList.add("completion-details");
    detailsTr.style.display = "none";

    const preset = m.preset ?? "No preset available";
    const mapLink = m.map_id ? `/GLTP/map.html?map_id=${m.map_id}` : null;

    detailsTr.innerHTML = `
    <td colspan="7">
        <div class="details-box details-flex">
        <div class="map-preview-player">
            <div class="loading-spinner">Click row to load preview...</div>
        </div>
        <div class="map-meta-player">
            <p><strong>Preset:</strong> <code>${preset}</code>
            <button class="copy-preset">Copy</button>
            </p>
            ${
            m.map_id
                ? `<p><strong>Map ID:</strong> <code>${m.map_id}</code>
                    <button class="copy-mapid" data-id="${m.map_id}">Copy</button>
                </p>
                <p><a href="https://fortunatemaps.herokuapp.com/map/${m.map_id}" target="_blank" class="view-map-link">🔗 View Map on Fortunate</a></p>`
                : ""
            }
            <br><p><strong>Map Type:</strong> ${m.grav_or_classic ?? "Unknown"}</p>
            <p><strong>Map Categories:</strong> ${(m.categories && m.categories.length) ? m.categories.join(", ") : "None"}</p>
            <div class="run-list">
            <h4>Run History</h4>
            ${
                stats
                ? stats.runs
                    .map(
                        run => `
                <p>
                    ${new Date(run.timestamp).toLocaleDateString()} — 
                    ${formatTime(run.record_time)} — 
                    ${run.total_jumps} jumps
                    ${run.uuid ? `— <a href="https://tagpro.koalabeast.com/replays?uuid=${run.uuid}" target="_blank">Replay</a>` : ""}
                </p>
                `
                    )
                    .join("")
                : "<p>No runs yet.</p>"
            }
            </div>
        </div>
        </div>
    </td>
    `;



    // Toggle details on click
    tr.addEventListener("click", () => {
      const isExpanding = detailsTr.style.display === "none";
      detailsTr.style.display = isExpanding ? "table-row" : "none";

      if (isExpanding && m.map_id) {
        const mapPreview = detailsTr.querySelector(".map-preview-player");
        if (mapPreview && mapPreview.querySelector(".loading-spinner")) {
          mapPreview.innerHTML = '<div class="loading-spinner">Loading...</div>';

          const img = document.createElement("img");
          const imageUrl = `https://fortunatemaps.herokuapp.com/preview/${m.map_id}`;
          img.src = imageUrl;
          img.alt = `Preview of ${m.map_name}`;
          img.style.cursor = "pointer";

          img.onload = function () {
            mapPreview.innerHTML = "";
            mapPreview.appendChild(img);
          };

          img.onerror = function () {
            mapPreview.innerHTML = '<div class="error">Preview failed</div>';
          };

          img.onclick = function () {
            if (typeof showLargePreview === "function") {
              showLargePreview(m.map_name, imageUrl);
            }
          };
        }
      }
    });

    // Copy preset
    detailsTr.querySelector(".copy-preset").addEventListener("click", () => {
      navigator.clipboard.writeText(preset).then(() => {
        alert("Preset copied to clipboard!");
      });
    });

    // Copy map ID
    const copyMapIdBtn = detailsTr.querySelector(".copy-mapid");
    if (copyMapIdBtn) {
      copyMapIdBtn.addEventListener("click", () => {
        const id = copyMapIdBtn.getAttribute("data-id");
        navigator.clipboard.writeText(id).then(() => {
          alert("Map ID copied to clipboard!");
        });
      });
    }

    tbody.appendChild(tr);
    tbody.appendChild(detailsTr);
  });

  document.getElementById("completionContainer").style.display = "block";
  document.getElementById("completionTable").style.display = "table";
  document.getElementById("completionHeader").style.display = "block";

  document.querySelectorAll("#completionTable th").forEach(th => {
    th.style.cursor = "pointer";
    th.onclick = () => {
      const keyMap = {
        0: "name",
        1: "completed",
        2: "attempts",
        3: "bestTime",
        4: "minJumps",
        5: "difficulty",
        6: "balls"
      };
      const colIndex = th.cellIndex;
      const key = keyMap[colIndex];
      const asc = completionSortKey === key ? !completionSortAsc : true;
      renderCompletion(records, summary, key, asc, mapsToRender);
    };
  });
}


function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}:${rem.toString().padStart(2, "0")}`;
}

function getSortValue(map, key, statsMap) {
  const stat = statsMap[map.map_id];
  switch (key) {
    case "name": return map.map_name.toLowerCase();
    case "completed": return stat ? 1 : 0;
    case "attempts": return stat?.attempts ?? 0;
    case "bestTime": return stat?.bestTime ?? Infinity;
    case "minJumps": return stat?.minJumps ?? Infinity;
    case "difficulty": return map.difficulty ?? 0;
    case "balls": return map.balls_req ?? 0;
    default: return 0;
  }
}

function searchMergedGroup(group) {
  const seen = new Set();
  const out = [];

  for (const records of Object.values(recordsByMap)) {
    for (const r of records) {
      // Match if any player in r.players belongs to the group
      //TODO white names still matching
      const idHit = r.players.some(p => group.user_ids.includes(p.user_id));
      const nameHit = r.players.some(p => group.names.includes(p.name));
      if ((idHit || nameHit) && !seen.has(r.uuid)) {
        seen.add(r.uuid);
        out.push(r);
      }
    }
  }

  return out;
}



document.addEventListener("DOMContentLoaded", async () => {
  const totalMapsCount = await loadData();

  const input = document.getElementById("playerSearchInput");
  const searchBtn = document.getElementById("playerSearchButton");

  async function run(query) {
    const q = query.trim();
    if (!q) return;

    const group = findMergeGroup(q);
    let records;

    if (group) {
        records = searchMergedGroup(group);
    } else {
        records = searchPlayer(q);
    }

    if (!records.length) {
        alert("No records found for that player.");
        return;
    }

    let summary = summarizePlayer(records, q, totalMapsCount);
    if (!summary) {
        alert("Could not summarize player.");
        return;
    }

    summary = await enhanceSummaryName(summary);
    await renderSummary(summary);
    renderCompletion(records, summary); // ✅ now includes all merged records
    setupCompletionFilters(records, summary);

    }


  searchBtn.addEventListener("click", () => run(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run(input.value);
  });

   // Auto-load if user_id is in URL
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("user_id");
  if (userId) {
    run(userId);
  }
});
