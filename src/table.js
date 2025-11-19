// table.js
import {
  formatTime,
  formatRelativeTime,
  getMapsPlayerKey,
  getMapsPlayerDisplayName,
  launchTagproGroup
} from './shared.js';

export class TableModule {
  /**
   * @param {Object} opts
   * @param {string} opts.tableId - The table element ID (e.g., "mapsTable", "jumpsTable")
   * @param {string} opts.bodyId - The tbody element ID (e.g., "mapsTableBody", "jumpTableBody")
   * @param {string} opts.searchId - The search input ID
   * @param {string} opts.clearId - The clear button ID for search
   * @param {string} [opts.filterId] - The filter select ID (gravity/classic/unbeaten for speed; gravity for jump)
   * @param {string} [opts.uploadButtonId] - The "Check Replay Data" button ID (e.g., "uploadWrButton", "jumpUploadWrButton")
   * @param {Object} opts.recordsByMap - Map of map_id -> array of records (sorted highest -> lowest)
   * @param {Object} opts.mapMetadata - Map of map_id -> metadata (difficulty, balls_req, grav_or_classic, preset, etc.)
   * @param {Object} opts.presets - Map of map_name -> preset string
   * @param {('speed'|'jump')} opts.mode - Page behavior differences ("speed" uses record_time; "jump" uses total_jumps)
   */
  constructor(opts) {
    this.tableId = opts.tableId;
    this.bodyId = opts.bodyId;
    this.searchId = opts.searchId;
    this.clearId = opts.clearId;
    this.filterId = opts.filterId;
    this.uploadButtonId = opts.uploadButtonId;

    this.recordsByMap = opts.recordsByMap || {};
    this.mapMetadata = opts.mapMetadata || {};
    this.presets = opts.presets || {};
    this.mode = opts.mode; // "speed" or "jump"

    this.currentSort = { property: 'timestamp', direction: 'desc' };
    this.allRecords = [];
    this.recordsArray = [];

    this.tbody = document.getElementById(this.bodyId);

    this.setupSorting();
    this.setupSearch();
    if (this.filterId) this.setupFilters();
    if (this.uploadButtonId) this.setupUploadModal();
  }

  // Wire <th data-sort="..." data-type="..."> clickable sorting
  setupSorting() {
    const thElements = document.querySelectorAll(`#${this.tableId} thead th`);
    thElements.forEach(th => {
      const sortProperty = th.getAttribute('data-sort');
      const sortType = th.getAttribute('data-type');
      if (!sortProperty || !sortType) return;
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => this.sortRecords(sortProperty, sortType));
    });
  }

  setupSearch() {
    const searchInput = document.getElementById(this.searchId);
    const clearButton = document.getElementById(this.clearId);

    // Ensure container positioning for the clear button
    const searchContainer = searchInput.parentElement;
    if (searchContainer) searchContainer.style.position = 'relative';

    // Typing triggers filter + live clear button visibility
    searchInput.addEventListener('input', () => {
      clearButton.style.display = searchInput.value ? 'block' : 'none';
      this.applyFilters(); // Always apply filter pipeline to keep behavior identical
    });

    // Clear returns to full list and re-applies filters
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      clearButton.style.display = 'none';
      // Reset filter select (when present)
      if (this.filterId) {
        const filterEl = document.getElementById(this.filterId);
        if (filterEl) filterEl.value = '';
      }
      this.render(this.allRecords);
      this.applyFilters();
      searchInput.focus();
    });
  }

  setupFilters() {
    const filterEl = document.getElementById(this.filterId);
    if (!filterEl) return;
    filterEl.addEventListener('change', () => this.applyFilters());
  }

  setupUploadModal() {
    const modal = document.getElementById('uploadModal');
    const uploadButton = document.getElementById(this.uploadButtonId);
    const cancelButton = document.getElementById('cancelUpload');
    const submitButton = document.getElementById('submitReplayUrl');
    const urlInput = document.getElementById('replayUrlInput');

    if (!modal || !uploadButton || !cancelButton || !submitButton || !urlInput) return;

    const show = () => { modal.style.display = 'block'; urlInput.focus(); };
    const hide = () => { modal.style.display = 'none'; urlInput.value = ''; };

    uploadButton.addEventListener('click', show);
    cancelButton.addEventListener('click', hide);
    window.addEventListener('click', (event) => { if (event.target === modal) hide(); });
    submitButton.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        console.log('Submitting URL:', url);
        hide();
      }
    });
    urlInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') submitButton.click();
    });
  }

  applyFilters() {
    // If no filters configured, just search within allRecords
    const searchTerm = (document.getElementById(this.searchId)?.value || '').toLowerCase().trim();

    // Speed page supports "unbeaten" option; jump page has gravity-only filter
    const filterVal = this.filterId ? (document.getElementById(this.filterId)?.value || '').toLowerCase() : '';

    if (this.mode === 'speed' && filterVal === 'unbeaten') {
      // Beaten set from existing records
      const beaten = new Set(this.allRecords.map(r => r.map_id));

      // Convert metadata to array for maps catalog
      const allMaps = Object.entries(this.mapMetadata).map(([mapId, meta]) => ({ mapId, ...meta }));

      // Filter unbeaten maps
      const unbeaten = allMaps.filter(m => {
        const key = m.map_id;
        const type = (m.grav_or_classic || '').toLowerCase();
        const matchesType = true; // "unbeaten" ignores grav/classic subfilter (matches both)
        const matchesSearch =
          (m.map_name || '').toLowerCase().includes(searchTerm) ||
          ((m.author || '').toLowerCase().includes(searchTerm));
        return !beaten.has(key) && matchesType && matchesSearch;
      });

      this.recordsArray = unbeaten;
      this.tbody.innerHTML = '';
      unbeaten.forEach(map => this.renderUnbeatenRow(map));
      return;
    }

    // Normal filtered view on existing records
    const filtered = this.allRecords.filter(record => {
      const metadata = this.mapMetadata[record.map_id] || {};
      const type = (metadata.grav_or_classic || '').toLowerCase();

      // Mode-specific type filters:
      // - Speed: '', 'grav', 'classic'
      // - Jump: '', 'grav' (jump table is grav-only by default in its render)
      const matchesType = filterVal === '' || type === filterVal;

      const matchesSearch =
        (record.map_name || '').toLowerCase().includes(searchTerm) ||
        ((record.map_author || '').toLowerCase().includes(searchTerm)) ||
        ((record.capping_player || '').toLowerCase().includes(searchTerm));

      return matchesType && matchesSearch;
    });

    this.recordsArray = filtered;
    this.tbody.innerHTML = '';
    filtered.forEach(rec => this.renderRow(rec));
  }

  sortRecords(property, type) {
    if (this.currentSort.property === property) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort.property = property;
      this.currentSort.direction = 'asc';
    }

    const dir = this.currentSort.direction;

    this.recordsArray.sort((a, b) => {
      let aVal, bVal;

      // Handle metadata-backed columns
      if (property === 'difficulty' || property === 'balls_req') {
        const aMeta = this.mapMetadata[a.map_id] || {};
        const bMeta = this.mapMetadata[b.map_id] || {};
        aVal = aMeta[property] ?? 'N/A';
        bVal = bMeta[property] ?? 'N/A';
      } else {
        aVal = a[property];
        bVal = b[property];
      }

      if (property === 'capping_player') {
        aVal = aVal || 'DNF';
        bVal = bVal || 'DNF';
      }

      if (type === 'numeric') {
        if (property === 'timestamp') {
          const at = new Date(aVal).getTime();
          const bt = new Date(bVal).getTime();
          return dir === 'asc' ? at - bt : bt - at;
        } else {
          const an = aVal === 'N/A' ? -1 : parseFloat(aVal);
          const bn = bVal === 'N/A' ? -1 : parseFloat(bVal);
          return dir === 'asc' ? an - bn : bn - an;
        }
      } else {
        const as = (aVal || '').toLowerCase();
        const bs = (bVal || '').toLowerCase();
        if (as < bs) return dir === 'asc' ? -1 : 1;
        if (as > bs) return dir === 'asc' ? 1 : -1;
        return 0;
      }
    });

    this.render(this.recordsArray);
  }

  // Render entry-point: mirrors current behavior on each page
  render(records) {
    if (this.mode === 'jump') {
      // Jump page defaults to gravity maps only (as current code does)
      const gravityOnly = (records || []).filter(r => {
        const meta = this.mapMetadata[r.map_id] || {};
        return ((meta.grav_or_classic || '')).toLowerCase() === 'grav';
      });
      this.allRecords = gravityOnly;
      this.recordsArray = gravityOnly;
    } else {
      this.allRecords = records || [];
      this.recordsArray = records || [];
    }

    this.tbody.innerHTML = '';
    this.recordsArray.forEach(rec => this.renderRow(rec));
  }

  renderRow(record) {
    const tr = document.createElement('tr');
    tr.className = 'map-row';

    // Map name with expandable detail
    const nameTd = document.createElement('td');
    nameTd.className = 'map-name';
    nameTd.textContent = record.map_name;

    const detailDiv = document.createElement('div');
    detailDiv.className = 'detail';
    detailDiv.style.display = 'none';

    const leftDetail = document.createElement('div');
    leftDetail.className = 'left-detail';

    // Date
    const dateDiv = document.createElement('div');
    dateDiv.textContent = 'Date: ' + new Date(record.timestamp).toLocaleDateString();
    leftDetail.appendChild(dateDiv);

    // Replay link
    const replayLink = document.createElement('a');
    replayLink.href = `https://tagpro.koalabeast.com/replays?uuid=${record.uuid}`;
    replayLink.textContent = 'Watch Replay';
    replayLink.target = '_blank';
    leftDetail.appendChild(replayLink);

    // Players list (dedup by user_id/name)
    const playersDiv = document.createElement('div');
    playersDiv.textContent = 'Players: ';
    const seen = new Set();
    const uniquePlayers = [];
    (record.players || []).forEach(p => {
      const key = getMapsPlayerKey(p);
      if (!seen.has(key)) { seen.add(key); uniquePlayers.push(p); }
    });

    uniquePlayers.forEach((p, i) => {
      if (p.user_id) {
        const playerLink = document.createElement('a');
        playerLink.href = `/GLTP/player.html?user_id=${p.user_id}`;
        playerLink.textContent = getMapsPlayerDisplayName(p);
        playerLink.classList.add('player-link');
        playersDiv.appendChild(playerLink);
      } else {
        const span = document.createElement('span');
        span.textContent = getMapsPlayerDisplayName(p);
        playersDiv.appendChild(span);
      }
      if (i < uniquePlayers.length - 1) {
        playersDiv.appendChild(document.createTextNode(', '));
      }
    });
    leftDetail.appendChild(playersDiv);

    // Preset + Map ID
    const presetValue = this.presets[record.map_name] || 'N/A';
    const infoDiv = document.createElement('div');
    infoDiv.textContent = 'Preset: ' + presetValue + ' | Map ID: ' + record.map_id;
    leftDetail.appendChild(infoDiv);

    // Quote
    if (record.capping_player_quote) {
      const quoteDiv = document.createElement('div');
      quoteDiv.className = 'capping-player-quote';
      quoteDiv.textContent = `"${record.capping_player_quote}"`;
      leftDetail.appendChild(quoteDiv);
    }

    // Copy preset
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Preset';
    copyBtn.classList.add('copy-button');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (presetValue !== 'N/A') {
        navigator.clipboard.writeText(presetValue)
          .then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = 'Copy Preset';
              copyBtn.classList.remove('copied');
            }, 2000);
          })
          .catch(err => console.error('Error copying preset:', err));
      }
    });
    leftDetail.appendChild(copyBtn);

    // Launch group
    const launchBtn = document.createElement('button');
    launchBtn.textContent = 'Launch Group';
    launchBtn.classList.add('copy-button');
    launchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (presetValue !== 'N/A') launchTagproGroup(presetValue);
    });
    leftDetail.appendChild(launchBtn);

    // Map preview placeholder
    if (record.map_id) {
      const mapPreview = document.createElement('div');
      mapPreview.className = 'map-preview';
      mapPreview.innerHTML = '<div class="loading-spinner">Click to load preview</div>';
      leftDetail.appendChild(mapPreview);
    }

    // Medal panel
    const medalPanel = document.createElement('div');
    medalPanel.className = 'medal-panel';

    const key = record.map_id;
    const mapRecords = this.recordsByMap[key] || [];
    const top3 = mapRecords.slice(0, 3);
    const medalLabels = ['1st', '2nd', '3rd'];
    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    top3.forEach((rec, idx) => {
      const replayLinkMedal = document.createElement('a');
      replayLinkMedal.href = `https://tagpro.koalabeast.com/replays?uuid=${rec.uuid}`;
      replayLinkMedal.target = '_blank';
      replayLinkMedal.className = 'medal-link';

      const row = document.createElement('div');
      row.className = 'medal-row';
      row.style.borderColor = medalColors[idx];

      const label = document.createElement('span');
      label.className = 'medal-label';
      label.style.color = medalColors[idx];
      label.textContent = medalLabels[idx];

      const stat = document.createElement('span');
      stat.className = 'medal-time';
      stat.style.color = medalColors[idx];
      stat.textContent = this.mode === 'jump' ? rec.total_jumps : formatTime(rec.record_time);

      row.appendChild(label);
      row.appendChild(stat);
      replayLinkMedal.appendChild(row);
      medalPanel.appendChild(replayLinkMedal);
    });

    // Detail wrapper
    const detailWrapper = document.createElement('div');
    detailWrapper.className = 'detail-wrapper';
    detailWrapper.appendChild(leftDetail);
    detailWrapper.appendChild(medalPanel);
    detailDiv.appendChild(detailWrapper);

    // Toggle details + lazy-load preview
    nameTd.addEventListener('click', () => {
      const expanding = detailDiv.style.display === 'none';
      detailDiv.style.display = expanding ? 'block' : 'none';

      if (expanding && record.map_id) {
        const mp = leftDetail.querySelector('.map-preview');
        if (mp && mp.querySelector('.loading-spinner')) {
          mp.innerHTML = '<div class="loading-spinner">Loading...</div>';
          const img = document.createElement('img');
          const url = `https://fortunatemaps.herokuapp.com/preview/${record.map_id}`;
          img.src = url;
          img.alt = `Preview of ${record.map_name}`;
          img.style.cursor = 'pointer';

          img.onload = () => { mp.innerHTML = ''; mp.appendChild(img); };
          img.onerror = () => { mp.innerHTML = '<div class="error">Preview failed</div>'; };
          img.onclick = () => { this.showLargePreview(record.map_name, url); };
        }
      }
    });

    nameTd.appendChild(detailDiv);
    tr.appendChild(nameTd);

    // Author
    const authorTd = document.createElement('td');
    authorTd.textContent = record.map_author || 'Anon';
    tr.appendChild(authorTd);

    // Mode-specific primary stat column(s)
    if (this.mode === 'jump') {
        // # Jumps column
        const jumpsTd = document.createElement('td');
        jumpsTd.textContent = record.total_jumps;
        tr.appendChild(jumpsTd);

        // Time column (always shown for jump records)
        const timeTd = document.createElement('td');
        timeTd.textContent = formatTime(record.record_time);
        tr.appendChild(timeTd);
    } else {
        // Speed records only show time
        const timeTd = document.createElement('td');
        timeTd.textContent = formatTime(record.record_time);
        tr.appendChild(timeTd);
    }

    // Relative time
    const relTd = document.createElement('td');
    relTd.textContent = formatRelativeTime(record.timestamp);
    tr.appendChild(relTd);

    // Capping player
    const capTd = document.createElement('td');
    if (record.capping_player) {
      const dummy = { name: record.capping_player, user_id: record.capping_player_user_id };
      if (dummy.user_id) {
        const link = document.createElement('a');
        link.href = `/GLTP/player.html?user_id=${dummy.user_id}`;
        link.textContent = getMapsPlayerDisplayName(dummy);
        capTd.appendChild(link);
      } else {
        capTd.textContent = getMapsPlayerDisplayName(dummy);
      }
    } else {
      capTd.textContent = 'DNF';
    }
    tr.appendChild(capTd);

    // Difficulty
    const meta = this.mapMetadata[record.map_id] || {};
    const diffTd = document.createElement('td');
    diffTd.textContent = meta.difficulty || 'N/A';
    diffTd.className = 'difficulty-col';
    tr.appendChild(diffTd);

    // Balls required
    const ballsTd = document.createElement('td');
    ballsTd.textContent = meta.balls_req || 'N/A';
    ballsTd.className = 'balls-col';
    tr.appendChild(ballsTd);

    this.tbody.appendChild(tr);
  }

  renderUnbeatenRow(map) {
    const tr = document.createElement('tr');
    tr.className = 'map-row unbeaten';

    const nameTd = document.createElement('td');
    nameTd.className = 'map-name';
    nameTd.textContent = map.map_name;

    const detailDiv = document.createElement('div');
    detailDiv.className = 'detail';
    detailDiv.style.display = 'none';

    const leftDetail = document.createElement('div');
    leftDetail.className = 'left-detail';

    const presetValue = this.presets[map.map_name] || map.preset || 'N/A';
    const infoDiv = document.createElement('div');
    infoDiv.textContent = 'Preset: ' + presetValue + ' | Map ID: ' + (map.map_id || '—');
    leftDetail.appendChild(infoDiv);

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Preset';
    copyBtn.classList.add('copy-button');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (presetValue !== 'N/A') {
        navigator.clipboard.writeText(presetValue)
          .then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
              copyBtn.textContent = 'Copy Preset';
              copyBtn.classList.remove('copied');
            }, 2000);
          })
          .catch(err => console.error('Error copying preset:', err));
      }
    });
    leftDetail.appendChild(copyBtn);

    const launchBtn = document.createElement('button');
    launchBtn.textContent = 'Launch Group';
    launchBtn.classList.add('copy-button');
    launchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (presetValue !== 'N/A') launchTagproGroup(presetValue);
    });
    leftDetail.appendChild(launchBtn);

    if (map.map_id) {
      const mapPreview = document.createElement('div');
      mapPreview.className = 'map-preview';
      mapPreview.innerHTML = '<div class="loading-spinner">Click to load preview</div>';
      leftDetail.appendChild(mapPreview);
    }

    const detailWrapper = document.createElement('div');
    detailWrapper.className = 'detail-wrapper';
    detailWrapper.appendChild(leftDetail);
    detailDiv.appendChild(detailWrapper);

    nameTd.addEventListener('click', () => {
      const expanding = detailDiv.style.display === 'none';
      detailDiv.style.display = expanding ? 'block' : 'none';

      if (expanding && map.map_id) {
        const mp = leftDetail.querySelector('.map-preview');
        if (mp && mp.querySelector('.loading-spinner')) {
          mp.innerHTML = '<div class="loading-spinner">Loading...</div>';
          const img = document.createElement('img');
          const url = `https://fortunatemaps.herokuapp.com/preview/${map.map_id}`;
          img.src = url;
          img.alt = `Preview of ${map.map_name}`;
          img.style.cursor = 'pointer';

          img.onload = () => { mp.innerHTML = ''; mp.appendChild(img); };
          img.onerror = () => { mp.innerHTML = '<div class="error">Preview failed</div>'; };
          img.onclick = () => { this.showLargePreview(map.map_name, url); };
        }
      }
    });

    nameTd.appendChild(detailDiv);
    tr.appendChild(nameTd);

    const authorTd = document.createElement('td');
    authorTd.textContent = map.author || 'Anon';
    tr.appendChild(authorTd);

    const timeTd = document.createElement('td');
    timeTd.textContent = 'No WR yet';
    tr.appendChild(timeTd);

    const relTd = document.createElement('td');
    relTd.textContent = '—';
    tr.appendChild(relTd);

    const capTd = document.createElement('td');
    capTd.textContent = '—';
    tr.appendChild(capTd);

    const diffTd = document.createElement('td');
    diffTd.textContent = map.difficulty || 'N/A';
    diffTd.className = 'difficulty-col';
    tr.appendChild(diffTd);

    const ballsTd = document.createElement('td');
    ballsTd.textContent = map.balls_req || 'N/A';
    ballsTd.className = 'balls-col';
    tr.appendChild(ballsTd);

    this.tbody.appendChild(tr);
  }

  showLargePreview(mapName, imageSrc) {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = `Large preview of ${mapName}`;

    const closeButton = document.createElement('div');
    closeButton.innerHTML = '×';
    closeButton.className = 'close-button';

    const mapNameLabel = document.createElement('div');
    mapNameLabel.textContent = mapName;
    mapNameLabel.className = 'map-name-label';

    modalContent.appendChild(img);
    modalContent.appendChild(closeButton);
    modalContent.appendChild(mapNameLabel);
    modal.appendChild(modalContent);

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    modal.addEventListener('click', closeModal);
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(modal);
  }

}