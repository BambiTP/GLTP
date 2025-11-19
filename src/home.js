// home.js
import { dataUrl, setupNavigation } from './shared.js';
import { initMapsTable } from './maps.js';
import { initJumpsTable } from './jumpRecords.js';
import { Leaderboard, processLeaderboardData, processJumpLeaderboardData } from './leaderboard.js';

// Load presets + metadata
const presets = await fetch(`./presets.json`).then(r => r.json());
const mapMetadata = await fetch(`./map_metadata.json`).then(r => r.json());

// Setup navigation
setupNavigation();

// Fetch and process data
fetch(dataUrl)
  .then(response => response.json())
  .then(data => {
    const {
      gamesCompletedLeaderboard,
      worldRecordsLeaderboard,
      soloWorldRecordsLeaderboard,
      cappingWorldRecordsLeaderboard,
      bestRecords,
      recordsByMap
    } = processLeaderboardData(data);

    const {
      jumpWorldRecordsLeaderboard,
      jumpSoloLeaderboard,
      jumpCappingLeaderboard,
      bestJumpRecords,
      jumpRecordsByMap
    } = processJumpLeaderboardData(data, mapMetadata);

    // ✅ Speed Records table
    initMapsTable(presets, recordsByMap, mapMetadata, bestRecords);

    // ✅ Jump Records table
    initJumpsTable(presets, jumpRecordsByMap, mapMetadata, bestJumpRecords);

    // Merge overall leaderboards
    const overallLeaderboard = {};
    [worldRecordsLeaderboard, jumpWorldRecordsLeaderboard].forEach(lb => {
      Object.entries(lb).forEach(([key, player]) => {
        if (!overallLeaderboard[key]) {
          overallLeaderboard[key] = { name: player.name, score: 0, user_id: player.user_id };
        }
        overallLeaderboard[key].score += player.score;
      });
    });

    const overallSoloLeaderboard = {};
    [soloWorldRecordsLeaderboard, jumpSoloLeaderboard].forEach(lb => {
      Object.entries(lb).forEach(([key, player]) => {
        if (!overallSoloLeaderboard[key]) {
          overallSoloLeaderboard[key] = { name: player.name, score: 0, user_id: player.user_id };
        }
        overallSoloLeaderboard[key].score += player.score;
      });
    });

    const overallCappingLeaderboard = {};
    [cappingWorldRecordsLeaderboard, jumpCappingLeaderboard].forEach(lb => {
      Object.entries(lb).forEach(([key, player]) => {
        if (!overallCappingLeaderboard[key]) {
          overallCappingLeaderboard[key] = { name: player.name, score: 0, user_id: player.user_id };
        }
        overallCappingLeaderboard[key].score += player.score;
      });
    });

    // Leaderboard tabs
    const leaderboard = new Leaderboard();
    leaderboard.renderTabs(
      {
        worldRecordsLeaderboard,
        soloWorldRecordsLeaderboard,
        cappingWorldRecordsLeaderboard,
        gamesCompletedLeaderboard
      },
      {
        jumpWorldRecordsLeaderboard,
        jumpSoloLeaderboard,
        jumpCappingLeaderboard
      },
      {
        overallLeaderboard,
        overallSoloLeaderboard,
        overallCappingLeaderboard
      }
    );
  })
  .catch(error => console.error("Error fetching data:", error));
