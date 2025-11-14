import { processLeaderboardData } from "./leaderboard.js";

let recordsByMap = {};
let mapMetadata = {};
let completionSortKey = null;
let completionSortAsc = true;


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

function summarizePlayer(records, query) {
  const timestamps = records.map(r => r.timestamp).sort();
  const first = new Date(timestamps[0]).toLocaleDateString();
  const last = new Date(timestamps[timestamps.length - 1]).toLocaleDateString();
  const maps = new Set(records.map(r => makeKey(r.map_name, r.map_author)));

  // Prefer showing the queried name if capping_player is null or different
  const displayName =
    normalize(records[0].capping_player || "") === normalize(query)
      ? records[0].capping_player
      : query;

  // Try to find a user_id from any matching spot
  let displayId = records[0].capping_player_user_id || null;
  if (!displayId) {
    for (const r of records) {
      for (const p of r.players) {
        if (normalize(p.name) === normalize(query) && p.user_id) {
          displayId = p.user_id;
          break;
        }
      }
      if (displayId) break;
    }
  }

  return {
    name: displayName,
    user_id: displayId,
    first,
    last,
    totalMaps: maps.size,
    totalRuns: records.length
  };
}

function renderSummary(summary) {
  const div = document.getElementById("playerSummary");
  div.innerHTML = `
    <div class="player-summary-box">
      <h2>${summary.name}</h2>
      ${summary.user_id ? `<p><a href="https://tagpro.koalabeast.com/profile/${summary.user_id}" target="_blank">View Profile</a></p>` : ""}
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
    if (!beatenMapStats[key]) {
      beatenMapStats[key] = {
        attempts: 1,
        bestTime: r.record_time,
        minJumps: r.total_jumps
      };
    } else {
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
      <td>${m.balls_required ?? "-"}</td>
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
        // ✅ records is in scope here because we’re inside renderCompletion
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
    case "balls": return map.balls_required ?? 0;
    default: return 0;
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  await loadData();

  const input = document.getElementById("playerSearchInput");
  const searchBtn = document.getElementById("playerSearchButton");

  async function run(query) {
    const q = query.trim();
    if (!q) return;

    const records = searchPlayer(q);
    if (!records.length) {
      alert("No records found for that player.");
      return;
    }

    const summary = summarizePlayer(records, q);
    renderSummary(summary);
    //renderRuns(records);
    renderCompletion(records);
  }

  searchBtn.addEventListener("click", () => run(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run(input.value);
  });
});
