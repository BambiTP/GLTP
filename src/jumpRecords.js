// jumpRecords.js
import { TableModule } from './table.js';
import { dataUrl } from './shared.js';

// This file now just configures the Jump Records table using TableModule.
// All logic for sorting, searching, filtering, rendering rows, medals, previews, etc.
// is handled inside table.js.

export async function initJumpsTable(presets, jumpRecordsByMap, mapMetadata, bestJumpRecords) {
  // Create Jump Records table instance
  const jumpsTable = new TableModule({
    tableId: 'jumpsTable',
    bodyId: 'jumpTableBody',
    searchId: 'jumpmapSearch',
    clearId: 'jump-search-clear',
    filterId: 'jumpGravityFilter',
    uploadButtonId: 'jumpUploadWrButton',
    recordsByMap: jumpRecordsByMap,
    mapMetadata,
    presets,
    mode: 'jump'
  });

  // Sort records by timestamp descending (latest first)
  const jumpRecordsArray = Object.values(bestJumpRecords).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Render into the table
  jumpsTable.render(jumpRecordsArray);
}
