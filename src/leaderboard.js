import {
  getLeaderboardPlayerKey,
  getLeaderboardPlayerDisplayName
} from "./shared.js";

// -------------------- Leaderboard Class --------------------
export class Leaderboard {
  constructor() {
    this.leaderboardContainer = document.getElementById("leaderboardContainer");
    this.currentView = "speed"; // default view
  }

  // Render with tabs for Speed, Jump, Overall
  renderTabs(speedData, jumpData, overallData) {
    this.speedData = speedData;
    this.jumpData = jumpData;
    this.overallData = overallData;

    // Initial render
    this.show("speed");

    // Tab listeners
    document
      .getElementById("speedLeaderboardTab")
      .addEventListener("click", () => this.show("speed"));
    document
      .getElementById("jumpLeaderboardTab")
      .addEventListener("click", () => this.show("jump"));
    document
      .getElementById("overallLeaderboardTab")
      .addEventListener("click", () => this.show("overall"));
  }

  show(view) {
    this.currentView = view;
    this.leaderboardContainer.innerHTML = "";

    // Toggle active tab
    document.querySelectorAll(".leaderboard-tabs button").forEach(btn => btn.classList.remove("active"));
    document.getElementById(view + "LeaderboardTab").classList.add("active");

    if (view === "speed") {
      this.createSection("Overall Speed Records", this.speedData.worldRecordsLeaderboard);
      this.createSection("Solo Speed Records", this.speedData.soloWorldRecordsLeaderboard);
      this.createSection("Capping Speed Records", this.speedData.cappingWorldRecordsLeaderboard);
      // Games Completed moved out
    } else if (view === "jump") {
      this.createSection("Overall Jump Records", this.jumpData.jumpWorldRecordsLeaderboard);
      this.createSection("Solo Jump Records", this.jumpData.jumpSoloLeaderboard);
      this.createSection("Capping Jump Records", this.jumpData.jumpCappingLeaderboard);
    } else if (view === "overall") {
      this.createSection("Overall Records (Speed + Jumps)", this.overallData.overallLeaderboard);
      this.createSection("Overall Solo Records", this.overallData.overallSoloLeaderboard);
      this.createSection("Overall Capping Records", this.overallData.overallCappingLeaderboard);
      this.createSection("Games Completed", this.speedData.gamesCompletedLeaderboard);
    }
  }

  createSection(title, leaderboardObj) {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "leaderboard-section";
    const table = document.createElement("table");
    table.className = "leaderboard-table";

    // Title row
    const titleRow = document.createElement("tr");
    const titleCell = document.createElement("th");
    titleCell.textContent = title;
    titleCell.colSpan = 2;
    titleCell.className = "leaderboard-title";
    titleRow.appendChild(titleCell);
    table.appendChild(titleRow);

    // Header row
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>Name</th><th>Score</th>";
    table.appendChild(headerRow);

    // Sort and add rows
    let playersArray = Object.values(leaderboardObj).sort((a, b) => b.score - a.score);
    playersArray.forEach(player => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${player.name}</td><td>${player.score}</td>`;
      table.appendChild(row);
    });

    sectionDiv.appendChild(table);
    this.leaderboardContainer.appendChild(sectionDiv);
  }
}

// -------------------- Speed Records Processor --------------------
export function processLeaderboardData(data) {
  let gamesCompletedLeaderboard = {};
  let worldRecordsLeaderboard = {};
  let soloWorldRecordsLeaderboard = {};
  let cappingWorldRecordsLeaderboard = {};
  let bestRecords = {};
  let recordsByMap = {};

  data.forEach(record => {
    if (record.record_time !== null) {
      const seenForGame = new Set();
      record.players.forEach(player => {
        let key = getLeaderboardPlayerKey(player);
        let displayName = getLeaderboardPlayerDisplayName(player);
        let hasPlayerId = player.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(player.name);
        if (!seenForGame.has(key)) {
          if (!gamesCompletedLeaderboard[key]) {
            gamesCompletedLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
          }
          gamesCompletedLeaderboard[key].score += 1;
          seenForGame.add(key);
        }
      });

      const key = record.map_id;
      if (!bestRecords[key] || record.record_time < bestRecords[key].record_time) {
        bestRecords[key] = record;
      }

      if (!recordsByMap[key]) {
        recordsByMap[key] = [];
      }
      recordsByMap[key].push(record);
    }
  });

  Object.values(bestRecords).forEach(record => {
    const seenForRecord = new Set();
    record.players.forEach(player => {
      let key = getLeaderboardPlayerKey(player);
      let displayName = getLeaderboardPlayerDisplayName(player);
      let hasPlayerId = player.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(player.name);
      if (!seenForRecord.has(key)) {
        if (!worldRecordsLeaderboard[key]) {
          worldRecordsLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
        }
        worldRecordsLeaderboard[key].score += 1;
        seenForRecord.add(key);
      }
    });

    if (record.is_solo) {
      const seenForSolo = new Set();
      record.players.forEach(player => {
        let key = getLeaderboardPlayerKey(player);
        let displayName = getLeaderboardPlayerDisplayName(player);
        let hasPlayerId = player.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(player.name);
        if (!seenForSolo.has(key)) {
          if (!soloWorldRecordsLeaderboard[key]) {
            soloWorldRecordsLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
          }
          soloWorldRecordsLeaderboard[key].score += 1;
          seenForSolo.add(key);
        }
      });
    }

    if (record.capping_player) {
      const dummyPlayer = { name: record.capping_player, user_id: record.capping_player_user_id };
      let key = getLeaderboardPlayerKey(dummyPlayer);
      let displayName = getLeaderboardPlayerDisplayName(dummyPlayer);
      let hasPlayerId = dummyPlayer.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(dummyPlayer.name);
      if (!cappingWorldRecordsLeaderboard[key]) {
        cappingWorldRecordsLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
      }
      cappingWorldRecordsLeaderboard[key].score += 1;
    }
  });

  for (let map in recordsByMap) {
    recordsByMap[map].sort((a, b) => a.record_time - b.record_time);
  }

  return {
    gamesCompletedLeaderboard,
    worldRecordsLeaderboard,
    soloWorldRecordsLeaderboard,
    cappingWorldRecordsLeaderboard,
    bestRecords,
    recordsByMap
  };
}

// -------------------- Jump Records Processor --------------------
export function processJumpLeaderboardData(data, mapMetadata) {
  //TOdo does this include classic maps?
  let jumpWorldRecordsLeaderboard = {};
  let jumpSoloLeaderboard = {};
  let jumpCappingLeaderboard = {};
  let bestJumpRecords = {};
  let jumpRecordsByMap = {};

  data.forEach(record => {
    const meta = mapMetadata[record.map_id];
    if (!meta) return;

    if (meta.grav_or_classic === "Classic") return;
    if (record.total_jumps !== null) {
      // Track best jump record per map (fewest jumps)
      const key = record.map_id;
      if (!bestJumpRecords[key] || record.total_jumps < bestJumpRecords[key].total_jumps) {
        bestJumpRecords[key] = record;
      }

      if (!jumpRecordsByMap[key]) {
        jumpRecordsByMap[key] = [];
      }
      jumpRecordsByMap[key].push(record);
    }
  });

  Object.values(bestJumpRecords).forEach(record => {
    const seenForRecord = new Set();

    // Overall Jump Records
    record.players.forEach(player => {
      let key = getLeaderboardPlayerKey(player);
      let displayName = getLeaderboardPlayerDisplayName(player);
      let hasPlayerId = player.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(player.name);
      if (!seenForRecord.has(key)) {
        if (!jumpWorldRecordsLeaderboard[key]) {
          jumpWorldRecordsLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
        }
        jumpWorldRecordsLeaderboard[key].score += 1;
        seenForRecord.add(key);
      }
    });

    // Solo Jump Records
    if (record.is_solo) {
      const seenForSolo = new Set();
      record.players.forEach(player => {
        let key = getLeaderboardPlayerKey(player);
        let displayName = getLeaderboardPlayerDisplayName(player);
        let hasPlayerId = player.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(player.name);
        if (!seenForSolo.has(key)) {
          if (!jumpSoloLeaderboard[key]) {
            jumpSoloLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
          }
          jumpSoloLeaderboard[key].score += 1;
          seenForSolo.add(key);
        }
      });
    }

    // Capping Jump Records
    if (record.capping_player) {
      const dummyPlayer = { name: record.capping_player, user_id: record.capping_player_user_id };
      let key = getLeaderboardPlayerKey(dummyPlayer);
      let displayName = getLeaderboardPlayerDisplayName(dummyPlayer);
      let hasPlayerId = dummyPlayer.user_id && !/^Some Ball(?:\s*\d+)?$/i.test(dummyPlayer.name);
      if (!jumpCappingLeaderboard[key]) {
        jumpCappingLeaderboard[key] = { name: displayName, score: 0, hasPlayerId };
      }
      jumpCappingLeaderboard[key].score += 1;
    }
  });

  for (let map in jumpRecordsByMap) {
    jumpRecordsByMap[map].sort((a, b) => a.total_jumps - b.total_jumps);
  }

  return {
    jumpWorldRecordsLeaderboard,
    jumpSoloLeaderboard,
    jumpCappingLeaderboard,
    bestJumpRecords,
    jumpRecordsByMap
  };
}