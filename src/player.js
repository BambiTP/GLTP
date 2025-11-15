import { processLeaderboardData } from "./leaderboard.js";

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
  const res = await fetch("https://worldrecords.bambitp.workers.dev");
  const raw = await res.json();
  const { recordsByMap: rbm } = processLeaderboardData(raw);
  recordsByMap = rbm;

  const metadataRes = await fetch("./map_metadata.json");
  mapMetadata = await metadataRes.json();
}

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

function makeKey(name, author) {
  return `${normalize(name)}::${normalize(author)}`;
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
  const maps = new Set(relevantRecords.map(r => makeKey(r.map_name, r.map_author)));

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

  return {
    name: names.join(" / "),
    names,
    user_ids,
    first,
    last,
    totalMaps: maps.size,
    totalRuns: relevantRecords.length
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
        <div><span>Maps completed:</span> ${summary.totalMaps}</div>
        <div><span>Total games:</span> ${summary.totalRuns}</div>
      </div>
    </div>
  `;
  div.style.display = "block";
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
  const tbody = document.getElementById("playerRunsBody");
  tbody.innerHTML = "";
  records.forEach(r => {
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

function renderCompletion(records, sortKey = null, sortAsc = true) {
  completionSortKey = sortKey;
  completionSortAsc = sortAsc;

  const beatenMapStats = {};

  // Collect best time and lowest jumps per map
  records.forEach(r => {
    const key = makeKey(r.map_name, r.map_author);

    // ✅ Deduplicate: only one entry per map, but update stats if better
    if (!beatenMapStats[key]) {
      beatenMapStats[key] = {
        attempts: 1,
        bestTime: r.record_time,
        minJumps: r.total_jumps
      };
    } else {
      // Increment attempts (still counts multiple runs, but map completion is unique)
      beatenMapStats[key].attempts += 1;

      if (r.record_time < beatenMapStats[key].bestTime) {
        beatenMapStats[key].bestTime = r.record_time;
      }
      if (r.total_jumps < beatenMapStats[key].minJumps) {
        beatenMapStats[key].minJumps = r.total_jumps;
      }
    }
  });

  const allMaps = Object.entries(mapMetadata).map(([name, meta]) => ({
    name,
    ...meta
  }));

  if (sortKey) {
    allMaps.sort((a, b) => {
      const keyA = getSortValue(a, sortKey, beatenMapStats);
      const keyB = getSortValue(b, sortKey, beatenMapStats);
      if (keyA < keyB) return sortAsc ? -1 : 1;
      if (keyA > keyB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  const tbody = document.getElementById("completionBody");
  tbody.innerHTML = "";

  allMaps.forEach(m => {
    const key = makeKey(m.name, m.author);
    const stats = beatenMapStats[key];
    const attempts = stats ? stats.attempts : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.name}</td>
      <td>${attempts > 0 ? "✅" : "❌"}</td>
      <td>${attempts}</td>
      <td>${stats ? formatTime(stats.bestTime) : "-"}</td>
      <td>${stats ? stats.minJumps : "-"}</td>
      <td>${m.difficulty ?? "-"}</td>
      <td>${m.balls_req ?? "-"}</td>
    `;
    tbody.appendChild(tr);
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
      renderCompletion(records, key, asc);
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
  const stat = statsMap[makeKey(map.name, map.author)];
  switch (key) {
    case "name": return map.name.toLowerCase();
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
  await loadData();

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

    let summary = summarizePlayer(records, q);
    if (!summary) {
        alert("Could not summarize player.");
        return;
    }

    summary = await enhanceSummaryName(summary);
    await renderSummary(summary);
    renderCompletion(records); // ✅ now includes all merged records
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
