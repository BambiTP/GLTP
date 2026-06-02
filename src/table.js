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
    this.playModeFilterId = opts.playModeFilterId;
    this.completionFilterId = opts.completionFilterId;
    this.extraCategoriesFilterId = opts.extraCategoriesFilterId;
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
    if (this.filterId || this.playModeFilterId || this.completionFilterId || this.extraCategoriesFilterId) {
        this.setupFilters();
    }
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
    [this.filterId, this.playModeFilterId, this.completionFilterId, this.extraCategoriesFilterId]
      .forEach(id => {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => this.applyFilters());
      });
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
    const gravityVal = this.filterId ? (document.getElementById(this.filterId)?.value || '').toLowerCase() : '';
    const playModeVal = this.playModeFilterId ? document.getElementById(this.playModeFilterId)?.value : '';
    const completionVal = this.completionFilterId ? document.getElementById(this.completionFilterId)?.value : '';
    const extraVals = this.extraCategoriesFilterId
      ? Array.from(document.getElementById(this.extraCategoriesFilterId)?.selectedOptions || []).map(o => o.value)
      : [];

    // Handle unbeaten maps separately
    if (this.mode === 'speed' && gravityVal === 'unbeaten') {
      const beaten = new Set(this.allRecords.map(r => r.map_id));
      const allMaps = Object.entries(this.mapMetadata).map(([mapId, meta]) => ({ map_id: mapId, ...meta }));

      const unbeaten = allMaps.filter(m => {
        const categories = m.categories || [];
        const type = (m.grav_or_classic || '').toLowerCase();

        const matchesGravity = true; // unbeaten ignores grav/classic
        const matchesPlayMode = !playModeVal || categories.includes(playModeVal);
        const matchesCompletion = !completionVal || categories.includes(completionVal);
        const matchesExtra = extraVals.length === 0 || extraVals.some(val => categories.includes(val));

        const matchesSearch =
          (m.map_name || '').toLowerCase().includes(searchTerm) ||
          ((m.author || '').toLowerCase().includes(searchTerm));

        return !beaten.has(m.map_id) && matchesGravity && matchesPlayMode && matchesCompletion && matchesExtra && matchesSearch;
      });

      this.recordsArray = unbeaten;
      this.tbody.innerHTML = '';
      unbeaten.forEach(map => this.renderUnbeatenRow(map));
      return;
    }

    // Normal filtered view
    const filtered = this.allRecords.filter(record => {
      const meta = this.mapMetadata[record.map_id] || {};
      const categories = meta.categories || [];
      const type = (meta.grav_or_classic || '').toLowerCase();

      const matchesGravity = gravityVal === '' || type === gravityVal;
      const matchesPlayMode = !playModeVal || categories.includes(playModeVal);
      const matchesCompletion = !completionVal || categories.includes(completionVal);
      const matchesExtra = extraVals.length === 0 || extraVals.some(val => categories.includes(val));

      const matchesSearch =
        (record.map_name || '').toLowerCase().includes(searchTerm) ||
        ((record.map_author || '').toLowerCase().includes(searchTerm)) ||
        ((record.capping_player || '').toLowerCase().includes(searchTerm));

      return matchesGravity && matchesPlayMode && matchesCompletion && matchesExtra && matchesSearch;
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

this.tbody.innerHTML = ''; this.recordsArray.forEach(rec => this.renderRow(rec));
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
