// maps.js
import { TableModule } from './table.js';
import { dataUrl } from './shared.js';

import { ReplayUploader } from './replayUploader.js';

// This file now just configures the Speed Records table using TableModule.
// All logic for sorting, searching, filtering, rendering rows, medals, previews, etc.
// is handled inside table.js.

export async function initMapsTable(presets, recordsByMap, mapMetadata, bestRecords) {
  // Create Speed Records table instance
  const mapsTable = new TableModule({
    tableId: 'mapsTable',
    bodyId: 'mapsTableBody',
    searchId: 'mapSearch',
    clearId: 'search-clear',
    filterId: 'gravityFilter',
    playModeFilterId: 'playModeFilter',
    completionFilterId: 'completionFilter',
    extraCategoriesFilterId: 'extraCategoriesFilter',
    //uploadButtonId: 'uploadWrButton',
    recordsByMap,
    mapMetadata,
    presets,
    mode: 'speed'
  });

  // ✅ Restore replay uploader
  mapsTable.replayUploader = new ReplayUploader();

  // Sort records by timestamp descending (latest first)
  const recordsArray = Object.values(bestRecords).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Render into the table
  mapsTable.render(recordsArray);
}