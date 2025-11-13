import { dataUrl, setupNavigation } from './shared.js';
import { MapsTable } from './maps.js';
import { JumpsTable } from './jumpRecords.js';
import { Leaderboard, processLeaderboardData, processJumpLeaderboardData } from './leaderboard.js';

// Load presets
const presets = await fetch(`./presets.json`)
    .then(response => response.json());
const mapMetadata = await fetch(`./map_metadata.json`)
    .then(response => response.json());

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
    } = processJumpLeaderboardData(data);

    // Speed Records table
    const mapsTable = new MapsTable(presets, recordsByMap, mapMetadata);
    const recordsArray = Object.values(bestRecords);
    recordsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    mapsTable.render(recordsArray);

    // Jump Records table
    const jumpsTable = new JumpsTable(presets, jumpRecordsByMap, mapMetadata);
    const jumpRecordsArray = Object.values(bestJumpRecords);
    jumpRecordsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    jumpsTable.render(jumpRecordsArray);

    // Overall leaderboard merge
    const overallLeaderboard = {};
    [worldRecordsLeaderboard, jumpWorldRecordsLeaderboard].forEach(lb => {
      Object.values(lb).forEach(player => {
        if (!overallLeaderboard[player.name]) {
          overallLeaderboard[player.name] = { name: player.name, score: 0 };
        }
        overallLeaderboard[player.name].score += player.score;
      });
    });

    const overallSoloLeaderboard = {};
    [soloWorldRecordsLeaderboard, jumpSoloLeaderboard].forEach(lb => {
      Object.values(lb).forEach(player => {
        if (!overallSoloLeaderboard[player.name]) {
          overallSoloLeaderboard[player.name] = { name: player.name, score: 0 };
        }
        overallSoloLeaderboard[player.name].score += player.score;
      });
    });

    const overallCappingLeaderboard = {};
    [cappingWorldRecordsLeaderboard, jumpCappingLeaderboard].forEach(lb => {
      Object.values(lb).forEach(player => {
        if (!overallCappingLeaderboard[player.name]) {
          overallCappingLeaderboard[player.name] = { name: player.name, score: 0 };
        }
        overallCappingLeaderboard[player.name].score += player.score;
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