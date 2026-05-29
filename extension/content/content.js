(function () {
  const sorter = window.__YT_PDS__;
  const i18n = window.__YT_PDS_I18N__;
  if (!sorter || !i18n) return;

  const MAX_ITEMS = 120;
  const FETCH_CONCURRENCY = 4;
  const SETTINGS_KEY = 'ytpds:settings';
  const state = {
    order: 'asc',
    language: 'ja',
    panelCollapsed: false,
    autoAdvance: false,
    sortedItems: [],
    dateByVideoId: Object.create(null),
    fetchStats: { ok: 0, httpError: 0, noDate: 0, networkError: 0 },
    lastFetchDebug: '',
    loading: false,
    progress: { current: 0, total: 0, phaseKey: '' },
    panel: null,
    lastUrl: location.href,
    lastPathname: location.pathname,
    playlistId: sorter.getPlaylistIdFromUrl(location.href),
    visualObserver: null,
    visualObserverRoot: null,
    visualApplyTimer: 0,
    applyingVisualOrder: false,
    restoredPlaylistId: '',
    badgesEnabled: false,
    visualMode: 'idle',
    forceOrderWithoutBadges: false,
    statusRenderer: null,
    panelObserver: null,
    panelRemovalTimer: 0,
  };

  function isPlaylistWatchPage() {
    return Boolean(sorter.getVideoIdFromUrl(location.href) && sorter.getPlaylistIdFromUrl(location.href));
  }

  function isSupportedPlaylistPage() {
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    return Boolean(playlistId && (location.pathname === '/watch' || location.pathname === '/playlist'));
  }

  function t(key, ...args) {
    return i18n.translate(state.language, key, ...args);
  }

  function renderStatus() {
    const node = state.panel && state.panel.querySelector('[data-ytpds-status]');
    if (node) node.textContent = state.statusRenderer ? state.statusRenderer() : t('ready');
    renderDebug();
  }

  function setStatusKey(key, ...args) {
    state.statusRenderer = () => t(key, ...args);
    renderStatus();
  }

  function setSummaryStatus() {
    state.statusRenderer = () => buildSummaryText();
    renderStatus();
  }

  function isDebugEnabled() {
    try {
      return localStorage.getItem('ytpds:debug') === '1';
    } catch (_error) {
      return false;
    }
  }

  function debugLog(message, details) {
    if (!isDebugEnabled()) return;
    console.info('[ytpds]', message, details || '');
  }

  function setDebug(message, details) {
    state.lastFetchDebug = message;
    debugLog(message, details);
    renderDebug();
  }

  function renderDebug() {
    const node = state.panel && state.panel.querySelector('[data-ytpds-debug]');
    if (!node) return;
    const enabled = isDebugEnabled();
    node.hidden = !enabled;
    if (!enabled) return;
    const rows = getPlaylistRows();
    const badgeCount = document.querySelectorAll('.ytpds-date-badge').length;
    node.textContent = [
      state.lastFetchDebug || 'debug ready',
      `badges=${badgeCount}`,
      `rows=${rows.length}`,
      `enabled=${state.badgesEnabled}`,
      `mode=${state.visualMode}`,
    ].join(' | ');
  }

  function refreshPanelText() {
    if (!state.panel) return;
    const title = state.panel.querySelector('[data-ytpds-title]');
    const collapseButton = state.panel.querySelector('[data-ytpds-collapse]');
    const order = state.panel.querySelector('[data-ytpds-order]');
    const sortButton = state.panel.querySelector('[data-ytpds-sort]');
    const nextButton = state.panel.querySelector('[data-ytpds-next]');
    const autoButton = state.panel.querySelector('[data-ytpds-auto]');
    if (title) title.textContent = t('title');
    if (collapseButton) {
      const label = state.panelCollapsed ? t('expand') : t('minimize');
      collapseButton.textContent = label;
      collapseButton.setAttribute('aria-label', label);
      collapseButton.setAttribute('aria-expanded', String(!state.panelCollapsed));
    }
    if (order) {
      order.setAttribute('aria-label', t('orderLabel'));
      const native = order.querySelector('option[value="native"]');
      const asc = order.querySelector('option[value="asc"]');
      const desc = order.querySelector('option[value="desc"]');
      if (native) native.textContent = t('normalOrder');
      if (asc) asc.textContent = t('oldestFirst');
      if (desc) desc.textContent = t('newestFirst');
      if (order.value !== state.order) order.value = state.order;
    }
    if (sortButton) sortButton.textContent = state.loading ? t('sorting') : t('sort');
    if (nextButton) nextButton.textContent = t('next');
    if (autoButton) autoButton.textContent = t('auto', state.autoAdvance);
    updateLoadingUi();
    renderStatus();
  }

  function ensurePanel() {
    if (!isSupportedPlaylistPage()) {
      if (state.panel && document.contains(state.panel) && !state.panelRemovalTimer) {
        state.panelRemovalTimer = setTimeout(() => {
          state.panelRemovalTimer = 0;
          if (!isSupportedPlaylistPage()) {
            if (state.panel) state.panel.remove();
            state.panel = null;
          }
        }, 1000);
      } else if (state.panel && !document.contains(state.panel)) {
        state.panel = null;
      }
      return;
    }

    if (state.panelRemovalTimer) {
      clearTimeout(state.panelRemovalTimer);
      state.panelRemovalTimer = 0;
    }

    if (state.panel && document.contains(state.panel)) return;

    if (state.panel) {
      state.panel = null;
    }

    const panel = document.createElement('section');
    panel.className = 'ytpds-panel';
    panel.innerHTML = `
      <div class="ytpds-header">
        <p class="ytpds-title" data-ytpds-title></p>
        <button class="ytpds-collapse" type="button" data-ytpds-collapse></button>
      </div>
      <div class="ytpds-body" data-ytpds-body>
        <select class="ytpds-select" data-ytpds-order>
          <option value="native"></option>
          <option value="asc"></option>
          <option value="desc"></option>
        </select>
        <div class="ytpds-row">
          <button class="ytpds-button" type="button" data-ytpds-sort></button>
          <button class="ytpds-button ytpds-button-primary" type="button" data-ytpds-next></button>
        </div>
        <div class="ytpds-row">
          <button class="ytpds-button" type="button" data-ytpds-auto></button>
        </div>
        <div class="ytpds-progress" data-ytpds-progress hidden>
          <div class="ytpds-progress-track">
            <div class="ytpds-progress-bar" data-ytpds-progress-bar></div>
          </div>
          <div class="ytpds-progress-label" data-ytpds-progress-label></div>
        </div>
        <div class="ytpds-status" data-ytpds-status></div>
        <div class="ytpds-debug" data-ytpds-debug hidden></div>
      </div>
    `;

    panel.querySelector('[data-ytpds-collapse]').addEventListener('click', () => {
      state.panelCollapsed = !state.panelCollapsed;
      updatePanelCollapsedUi();
      saveSettings();
    });
    panel.querySelector('[data-ytpds-order]').addEventListener('change', (event) => {
      const nextOrder =
        event.target.value === 'native'
          ? 'native'
          : event.target.value === 'desc'
            ? 'desc'
            : 'asc';
      state.order = nextOrder;
      if (nextOrder === 'native') {
        restoreNativeOrder();
        clearSortState();
        return;
      }
      if (state.sortedItems.length > 0) {
        state.sortedItems = sorter.sortItemsByPublishDate(
          state.sortedItems,
          state.dateByVideoId,
          state.order
        );
        applyVisualOrder();
        saveSortState();
        setSummaryStatus();
      }
    });
    panel.querySelector('[data-ytpds-sort]').addEventListener('click', () => refreshSortedItems());
    panel.querySelector('[data-ytpds-next]').addEventListener('click', () => goNextByPublishDate());
    panel.querySelector('[data-ytpds-auto]').addEventListener('click', (event) => {
      state.autoAdvance = !state.autoAdvance;
      event.currentTarget.textContent = t('auto', state.autoAdvance);
      attachEndedHandler();
    });

    document.documentElement.appendChild(panel);
    state.panel = panel;
    updatePanelCollapsedUi();
    refreshPanelText();
    updateLoadingUi();
  }

  function updatePanelCollapsedUi() {
    if (!state.panel) return;
    state.panel.classList.toggle('ytpds-panel-collapsed', state.panelCollapsed);
    const body = state.panel.querySelector('[data-ytpds-body]');
    if (body) body.hidden = state.panelCollapsed;
    refreshPanelText();
  }

  function ensurePanelObserver() {
    if (state.panelObserver || !document.documentElement) return;
    state.panelObserver = new MutationObserver(() => {
      if (!isSupportedPlaylistPage()) return;
      if (!state.panel || !document.contains(state.panel)) {
        state.panel = null;
        ensurePanel();
      }
    });
    state.panelObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function setLoading(isLoading, phaseKey, current, total) {
    state.loading = isLoading;
    state.progress = {
      phaseKey: phaseKey || '',
      current: Number.isFinite(current) ? current : 0,
      total: Number.isFinite(total) ? total : 0,
    };
    updateLoadingUi();
  }

  function updateProgress(phaseKey, current, total) {
    state.progress = {
      phaseKey: phaseKey || state.progress.phaseKey,
      current: Number.isFinite(current) ? current : state.progress.current,
      total: Number.isFinite(total) ? total : state.progress.total,
    };
    updateLoadingUi();
  }

  function updateLoadingUi() {
    if (!state.panel) return;
    const sortButton = state.panel.querySelector('[data-ytpds-sort]');
    const nextButton = state.panel.querySelector('[data-ytpds-next]');
    const progress = state.panel.querySelector('[data-ytpds-progress]');
    const bar = state.panel.querySelector('[data-ytpds-progress-bar]');
    const label = state.panel.querySelector('[data-ytpds-progress-label]');
    if (sortButton) {
      sortButton.disabled = state.loading;
      sortButton.textContent = state.loading ? t('sorting') : t('sort');
    }
    if (nextButton) {
      nextButton.disabled = state.loading;
    }
    if (progress) {
      progress.hidden = !state.loading;
    }
    if (bar) {
      const ratio =
        state.progress.total > 0
          ? Math.max(0, Math.min(1, state.progress.current / state.progress.total))
          : 0.2;
      bar.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (label) {
      const count =
        state.progress.total > 0
          ? ` ${state.progress.current}/${state.progress.total}`
          : '';
      const phase = state.progress.phaseKey ? t(state.progress.phaseKey) : t('defaultProgress');
      label.textContent = `${phase}${count}`;
    }
  }

  function buildSummaryText() {
    const known = state.sortedItems.filter((item) => state.dateByVideoId[item.videoId]).length;
    const failed = state.fetchStats.httpError + state.fetchStats.noDate + state.fetchStats.networkError;
    const debug =
      state.lastFetchDebug && failed && !state.lastFetchDebug.startsWith('visual ')
        ? state.lastFetchDebug
        : '';
    return t(
      'summary',
      state.sortedItems.length,
      state.order,
      known,
      failed,
      state.fetchStats,
      debug
    );
  }

  async function refreshSortedItems() {
    if (state.loading) return;
    if (state.order === 'native') {
      restoreNativeOrder();
      await clearSortState();
      return;
    }
    debugLog('sort clicked', {
      url: location.href,
      playlistId: sorter.getPlaylistIdFromUrl(location.href),
      rows: getPlaylistRows().length,
    });
    ensurePanel();

    setLoading(true, 'waitingPhase', 0, 0);
    setStatusKey('waitingStatus');

    const items = (await waitForPlaylistItems()).slice(0, MAX_ITEMS);
    if (items.length === 0) {
      setStatusKey('noItems');
      setLoading(false);
      return;
    }

    state.fetchStats = { ok: 0, httpError: 0, noDate: 0, networkError: 0 };
    state.lastFetchDebug = '';
    updateProgress('fetchingPhase', 0, items.length);
    state.statusRenderer = () => t('fetchingStatus', items.length);
    renderStatus();
    await fetchDates(items);
    updateProgress('sortingPhase', items.length, items.length);
    state.sortedItems = sorter.sortItemsByPublishDate(items, state.dateByVideoId, state.order);
    state.badgesEnabled = true;
    state.visualMode = 'sorted';
    applyVisualOrder();
    state.visualMode = 'badges';
    ensureVisualObserver();
    await saveSortState();
    setLoading(false);
    setSummaryStatus();
    renderDebug();
  }

  async function waitForPlaylistItems() {
    const deadline = Date.now() + 6000;
    let lastItems = [];
    while (Date.now() < deadline) {
      lastItems = sorter.extractPlaylistItemsFromDocument(document);
      if (lastItems.length > 0) return lastItems;
      await delay(200);
    }
    return lastItems;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchDates(items) {
    let cursor = 0;
    let completed = 0;
    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor++];
        if (!state.dateByVideoId[item.videoId]) {
          state.dateByVideoId[item.videoId] = await fetchPublishDate(item.videoId);
        }
        completed += 1;
        updateProgress('fetchingPhase', completed, items.length);
        state.statusRenderer = () => t('fetchingStatus', items.length, completed);
        renderStatus();
      }
    }
    await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, () => worker()));
  }

  async function fetchPublishDate(videoId) {
    const url = new URL('/watch', location.origin);
    url.searchParams.set('v', videoId);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('persist_hl', '1');
    url.searchParams.set('bpctr', '9999999999');
    url.searchParams.set('has_verified', '1');

    try {
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!response.ok) {
        state.fetchStats.httpError += 1;
        state.lastFetchDebug = `${videoId} HTTP ${response.status}`;
        return null;
      }
      const html = await response.text();
      const date = sorter.extractPublishDateFromHtml(html);
      if (date) {
        state.fetchStats.ok += 1;
      } else {
        state.fetchStats.noDate += 1;
        state.lastFetchDebug = `${videoId} no date, ${html.length} bytes, title=${extractHtmlTitle(html)}`;
      }
      return date;
    } catch (error) {
      state.fetchStats.networkError += 1;
      state.lastFetchDebug = `${videoId} ${error && error.name ? error.name : 'network error'}`;
      return null;
    }
  }

  function extractHtmlTitle(html) {
    const match = String(html).match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim().slice(0, 40) : 'none';
  }

  function getPlaylistRows() {
    const selectors =
      location.pathname === '/playlist'
        ? [
            'ytd-playlist-video-renderer',
            'ytd-playlist-video-list-renderer ytd-playlist-video-renderer',
          ]
        : [
            'ytd-playlist-panel-video-renderer',
            'ytd-playlist-panel-video-wrapper-renderer',
            'ytd-playlist-panel-renderer a[href*="/watch"][href*="v="]',
            'ytd-playlist-video-renderer',
          ];
    const rows = [];
    const seen = new Set();
    for (const selector of selectors) {
      for (const candidate of document.querySelectorAll(selector)) {
        const row = normalizePlaylistRow(candidate);
        if (!row || seen.has(row)) continue;
        if (!getVideoIdFromRow(row)) continue;
        seen.add(row);
        rows.push(row);
      }
    }
    return rows;
  }

  function normalizePlaylistRow(candidate) {
    if (!candidate) return null;
    if (candidate.matches && candidate.matches('a[href*="/watch"][href*="v="]')) {
      return (
        candidate.closest(
          'ytd-playlist-panel-video-renderer, ytd-playlist-panel-video-wrapper-renderer, ytd-playlist-video-renderer, ytd-rich-item-renderer'
        ) || candidate
      );
    }
    return candidate;
  }

  function getVideoIdFromRow(row) {
    if (!row || !row.querySelector) return '';
    const anchor =
      row.matches && row.matches('a[href*="/watch"][href*="v="]')
        ? row
        : row.querySelector('a[href*="/watch"][href*="v="]');
    if (!anchor) return '';
    return sorter.getVideoIdFromUrl(anchor.href || anchor.getAttribute('href') || '');
  }

  function applyVisualOrder() {
    if (state.applyingVisualOrder || state.sortedItems.length === 0 || state.order === 'native') return;

    const rows = getPlaylistRows();
    if (rows.length === 0) return;

    const rowByVideoId = new Map();
    for (const row of rows) {
      const videoId = getVideoIdFromRow(row);
      if (videoId && !rowByVideoId.has(videoId)) {
        rowByVideoId.set(videoId, row);
      }
    }

    const sortedRows = state.sortedItems
      .map((item) => rowByVideoId.get(item.videoId))
      .filter(Boolean);
    if (sortedRows.length === 0) {
      setDebug(`visual rows=${rows.length}, matched=0`, {
        desired: state.sortedItems.map((item) => item.videoId).slice(0, 10),
        actual: rows.map((row) => getVideoIdFromRow(row)).slice(0, 10),
      });
      setSummaryStatus();
      return;
    }

    const parent = sortedRows[0].parentElement;
    if (!parent || sortedRows.some((row) => row.parentElement !== parent)) {
      if (state.badgesEnabled) {
        decorateRows(rowByVideoId);
        setDebug(`visual rows=${rows.length}, matched=${sortedRows.length}, mixed parents, decorated`, {
          badgeCount: document.querySelectorAll('.ytpds-date-badge').length,
        });
      } else {
        setDebug(`visual rows=${rows.length}, matched=${sortedRows.length}, mixed parents`);
      }
      setSummaryStatus();
      return;
    }

    const currentOrder = Array.from(parent.children)
      .filter((node) => rowByVideoId.has(getVideoIdFromRow(node)))
      .map((node) => getVideoIdFromRow(node));
    const desiredOrder = state.sortedItems
      .filter((item) => rowByVideoId.has(item.videoId))
      .map((item) => item.videoId);
    if (sameOrder(currentOrder, desiredOrder)) {
      if (state.badgesEnabled) {
        decorateRows(rowByVideoId);
      } else {
        safelyDecorateRows(rowByVideoId);
      }
      setDebug(`visual rows=${rows.length}, matched=${sortedRows.length}, already sorted`, {
        badgeCount: document.querySelectorAll('.ytpds-date-badge').length,
      });
      return;
    }

    if (!state.badgesEnabled && state.visualMode !== 'sorted' && !state.forceOrderWithoutBadges) {
      state.badgesEnabled = false;
      setDebug(`visual rows=${rows.length}, matched=${sortedRows.length}, native order detected`);
      setSummaryStatus();
      return;
    }

    state.applyingVisualOrder = true;
    try {
      const marker = document.createComment('ytpds-order-marker');
      parent.insertBefore(marker, sortedRows[0]);
      for (let i = desiredOrder.length - 1; i >= 0; i -= 1) {
        const row = rowByVideoId.get(desiredOrder[i]);
        if (row && row.parentElement === parent) {
          parent.insertBefore(row, marker.nextSibling);
        }
      }
      marker.remove();
      decorateRows(rowByVideoId);
      setDebug(`visual rows=${rows.length}, matched=${sortedRows.length}, sorted`, {
        badgeCount: document.querySelectorAll('.ytpds-date-badge').length,
      });
    } finally {
      setTimeout(() => {
        state.applyingVisualOrder = false;
      }, 300);
    }
  }

  function sameOrder(left, right) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  function decorateRows(rowByVideoId) {
    if (!state.badgesEnabled) {
      clearDecorations();
      return;
    }
    const currentVideoId = sorter.getVideoIdFromUrl(location.href);
    const desiredVideoIds = new Set(state.sortedItems.map((item) => item.videoId));
    const decoratedVideoIds = new Set();
    let attempted = 0;
    for (const row of getPlaylistRows()) {
      const videoId = getVideoIdFromRow(row);
      if (!desiredVideoIds.has(videoId) && row.dataset.ytpdsSorted === '1') {
        row.classList.remove('ytpds-current-video');
        delete row.dataset.ytpdsSorted;
        delete row.dataset.ytpdsSortIndex;
        const badge = row.querySelector('.ytpds-date-badge');
        if (badge) badge.remove();
      }
    }
    state.sortedItems.forEach((item, index) => {
      const row = rowByVideoId.get(item.videoId);
      if (!row) return;
      decoratedVideoIds.add(item.videoId);
      attempted += 1;

      const isCurrent = item.videoId === currentVideoId;
      if (row.classList.contains('ytpds-current-video') !== isCurrent) {
        row.classList.toggle('ytpds-current-video', isCurrent);
      }
      if (row.dataset.ytpdsSorted !== '1') {
        row.dataset.ytpdsSorted = '1';
      }
      const sortIndex = String(index + 1);
      if (row.dataset.ytpdsSortIndex !== sortIndex) {
        row.dataset.ytpdsSortIndex = sortIndex;
      }

      const badge = ensureBadge(row);
      const badgeText = t(
        'badge',
        index + 1,
        state.dateByVideoId[item.videoId] || t('unknownDate')
      );
      if (badge.textContent !== badgeText) {
        badge.textContent = badgeText;
      }
    });
    const beforePrune = document.querySelectorAll('.ytpds-date-badge').length;
    pruneOrphanBadges(decoratedVideoIds);
    debugLog('decorate rows', {
      attempted,
      decoratedVideoIds: decoratedVideoIds.size,
      beforePrune,
      afterPrune: document.querySelectorAll('.ytpds-date-badge').length,
    });
  }

  function safelyDecorateRows(rowByVideoId) {
    if (state.applyingVisualOrder) return;
    state.applyingVisualOrder = true;
    try {
      decorateRows(rowByVideoId);
    } finally {
      setTimeout(() => {
        state.applyingVisualOrder = false;
      }, 150);
    }
  }

  function clearDecorations() {
    for (const row of getPlaylistRows()) {
      row.classList.remove('ytpds-current-video');
      row.classList.remove('ytpds-badge-overlay');
      if (row.dataset.ytpdsSorted) {
        delete row.dataset.ytpdsSorted;
      }
      if (row.dataset.ytpdsSortIndex) {
        delete row.dataset.ytpdsSortIndex;
      }
    }
    for (const badge of document.querySelectorAll('.ytpds-date-badge')) {
      badge.remove();
    }
  }

  function restoreNativeOrder() {
    state.badgesEnabled = false;
    state.visualMode = 'idle';
    applyOrderByItems(
      [...state.sortedItems].sort((left, right) => left.originalIndex - right.originalIndex),
      'native order'
    );
    clearDecorations();
    setStatusKey('nativeRestored');
  }

  function applyOrderByItems(items, reason) {
    if (state.applyingVisualOrder || items.length === 0) return false;
    const rows = getPlaylistRows();
    if (rows.length === 0) return false;

    const rowByVideoId = new Map();
    for (const row of rows) {
      const videoId = getVideoIdFromRow(row);
      if (videoId && !rowByVideoId.has(videoId)) {
        rowByVideoId.set(videoId, row);
      }
    }

    const desiredOrder = items
      .map((item) => item.videoId)
      .filter((videoId) => rowByVideoId.has(videoId));
    if (desiredOrder.length === 0) return false;

    const sortedRows = desiredOrder.map((videoId) => rowByVideoId.get(videoId)).filter(Boolean);
    const parent = sortedRows[0] && sortedRows[0].parentElement;
    if (!parent || sortedRows.some((row) => row.parentElement !== parent)) {
      debugLog(`${reason} skipped`, {
        rows: rows.length,
        matched: sortedRows.length,
        cause: 'mixed parents',
      });
      return false;
    }

    const currentOrder = Array.from(parent.children)
      .filter((node) => rowByVideoId.has(getVideoIdFromRow(node)))
      .map((node) => getVideoIdFromRow(node));
    if (sameOrder(currentOrder, desiredOrder)) {
      debugLog(`${reason} already applied`, {
        rows: rows.length,
        matched: sortedRows.length,
      });
      return true;
    }

    state.applyingVisualOrder = true;
    try {
      const marker = document.createComment('ytpds-native-order-marker');
      parent.insertBefore(marker, sortedRows[0]);
      for (let i = desiredOrder.length - 1; i >= 0; i -= 1) {
        const row = rowByVideoId.get(desiredOrder[i]);
        if (row && row.parentElement === parent) {
          parent.insertBefore(row, marker.nextSibling);
        }
      }
      marker.remove();
      debugLog(`${reason} applied`, {
        rows: rows.length,
        matched: sortedRows.length,
      });
      return true;
    } finally {
      setTimeout(() => {
        state.applyingVisualOrder = false;
      }, 300);
    }
  }

  function pruneOrphanBadges(decoratedVideoIds) {
    for (const badge of document.querySelectorAll('.ytpds-date-badge')) {
      const row = badge.closest(
        'ytd-playlist-panel-video-renderer, ytd-playlist-panel-video-wrapper-renderer, ytd-playlist-video-renderer, ytd-rich-item-renderer, a[href*="/watch"][href*="v="]'
      );
      const videoId = getVideoIdFromRow(row);
      if (!row || !decoratedVideoIds.has(videoId)) {
        if (row) row.classList.remove('ytpds-badge-overlay');
        badge.remove();
      }
    }
  }

  function ensureBadge(row) {
    let badge = row.querySelector('.ytpds-date-badge');
    const badgeTarget = getBadgeTarget(row);

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'ytpds-date-badge';
    }
    row.classList.toggle('ytpds-badge-overlay', badgeTarget.overlay);
    if (badge.parentElement !== badgeTarget.target) {
      badgeTarget.target.appendChild(badge);
    }
    return badge;
  }

  function getBadgeTarget(row) {
    const isWatchPanelRow =
      row.matches &&
      row.matches('ytd-playlist-panel-video-renderer, ytd-playlist-panel-video-wrapper-renderer');
    const target = row.querySelector(
      isWatchPanelRow
        ? '#meta, .metadata-wrapper, .metadata-info, #byline-container, #byline, #video-info, #details, .metadata'
        : '#meta, #byline-container, #video-info, .metadata, #video-title'
    );

    if (target) {
      return { target, overlay: false };
    }
    return { target: row, overlay: isWatchPanelRow };
  }

  function ensureVisualObserver() {
    const root =
      document.querySelector('ytd-playlist-panel-renderer') ||
      document.querySelector('ytd-playlist-video-list-renderer') ||
      document;
    if (state.visualObserver && state.visualObserverRoot === root) return;
    if (state.visualObserver) {
      state.visualObserver.disconnect();
    }

    const observer = new MutationObserver((mutations) => {
      if (state.applyingVisualOrder || state.sortedItems.length === 0) return;
      if (mutations.length > 0 && mutations.every(isOwnVisualMutation)) return;
      clearTimeout(state.visualApplyTimer);
      state.visualApplyTimer = setTimeout(() => applyVisualOrder(), 120);
    });
    observer.observe(root, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'data-ytpds-sorted', 'data-ytpds-sort-index'],
      childList: true,
      subtree: true,
    });
    state.visualObserver = observer;
    state.visualObserverRoot = root;
  }

  function isOwnVisualMutation(mutation) {
    if (mutation.type === 'attributes') {
      if (mutation.target.closest && mutation.target.closest('.ytpds-date-badge')) return true;
      if (
        mutation.attributeName === 'data-ytpds-sorted' ||
        mutation.attributeName === 'data-ytpds-sort-index'
      ) {
        return true;
      }
      if (mutation.attributeName === 'class') {
        return onlyClassTokenChanged(
          mutation.oldValue || '',
          mutation.target.getAttribute('class') || '',
          ['ytpds-current-video']
        );
      }
    }
    if (mutation.type === 'childList') {
      const nodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));
      return nodes.length > 0 && nodes.every(isYtpdsArtifactNode);
    }
    return false;
  }

  function isYtpdsArtifactNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return (
      node.classList.contains('ytpds-date-badge') ||
      Boolean(node.querySelector && node.querySelector('.ytpds-date-badge'))
    );
  }

  function onlyClassTokenChanged(oldValue, newValue, allowedTokens) {
    const before = new Set(String(oldValue).split(/\s+/).filter(Boolean));
    const after = new Set(String(newValue).split(/\s+/).filter(Boolean));
    const changed = [];
    for (const token of before) {
      if (!after.has(token)) changed.push(token);
    }
    for (const token of after) {
      if (!before.has(token)) changed.push(token);
    }
    return changed.length > 0 && changed.every((token) => allowedTokens.includes(token));
  }

  function hasDesiredDomOrder() {
    if (state.sortedItems.length === 0) return true;
    const snapshot = getVisualOrderSnapshot();
    return Boolean(snapshot && snapshot.orderMatches);
  }

  function getVisualOrderSnapshot() {
    const rows = getPlaylistRows();
    if (rows.length === 0) return null;

    const rowByVideoId = new Map();
    for (const row of rows) {
      const videoId = getVideoIdFromRow(row);
      if (videoId && !rowByVideoId.has(videoId)) rowByVideoId.set(videoId, row);
    }

    const desiredOrder = state.sortedItems
      .filter((item) => rowByVideoId.has(item.videoId))
      .map((item) => item.videoId);
    if (desiredOrder.length === 0) return null;

    const sortedRows = desiredOrder.map((videoId) => rowByVideoId.get(videoId)).filter(Boolean);
    const parent = sortedRows[0] && sortedRows[0].parentElement;
    if (!parent || sortedRows.some((row) => row.parentElement !== parent)) {
      return {
        rows,
        rowByVideoId,
        desiredOrder,
        currentOrder: [],
        matchedCount: desiredOrder.length,
        allVisibleMatched: desiredOrder.length === rows.length,
        orderMatches: false,
      };
    }

    const currentOrder = Array.from(parent.children)
      .filter((node) => rowByVideoId.has(getVideoIdFromRow(node)))
      .map((node) => getVideoIdFromRow(node));

    return {
      rows,
      rowByVideoId,
      desiredOrder,
      currentOrder,
      matchedCount: desiredOrder.length,
      allVisibleMatched: desiredOrder.length === rows.length,
      orderMatches: sameOrder(currentOrder, desiredOrder),
    };
  }

  function tryAutoEnableSavedBadges(reason) {
    if (state.badgesEnabled || state.sortedItems.length === 0) return false;
    const snapshot = getVisualOrderSnapshot();
    if (!snapshot || !snapshot.allVisibleMatched || !snapshot.orderMatches) {
      debugLog('auto badges skipped', {
        reason,
        rows: snapshot ? snapshot.rows.length : 0,
        matched: snapshot ? snapshot.matchedCount : 0,
        orderMatches: Boolean(snapshot && snapshot.orderMatches),
      });
      return false;
    }

    state.badgesEnabled = true;
    state.visualMode = 'badges';
    decorateRows(snapshot.rowByVideoId);
    setDebug(`auto badges enabled (${reason})`, {
      rows: snapshot.rows.length,
      matched: snapshot.matchedCount,
      badgeCount: document.querySelectorAll('.ytpds-date-badge').length,
    });
    setSummaryStatus();
    return true;
  }

  function storageKeyForPlaylist(playlistId) {
    return `ytpds:${playlistId}`;
  }

  function canUseChromeStorage() {
    return Boolean(
      typeof chrome !== 'undefined' &&
        chrome.storage &&
        chrome.storage.local &&
        chrome.storage.local.get &&
        chrome.storage.local.set
    );
  }

  function storageGet(key) {
    if (!canUseChromeStorage()) return Promise.resolve(null);
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result && result[key] ? result[key] : null);
      });
    });
  }

  function storageSet(key, value) {
    if (!canUseChromeStorage()) return Promise.resolve();
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  function storageRemove(key) {
    if (!canUseChromeStorage()) return Promise.resolve();
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => resolve());
    });
  }

  async function restoreSettings() {
    const saved = await storageGet(SETTINGS_KEY);
    state.language = i18n.normalizeLanguage(saved && saved.language);
    state.panelCollapsed = Boolean(saved && saved.panelCollapsed);
    ensurePanel();
    updatePanelCollapsedUi();
    refreshPanelText();
    if (state.badgesEnabled && state.sortedItems.length > 0) {
      applyVisualOrder();
    }
  }

  async function saveSettings() {
    await storageSet(SETTINGS_KEY, {
      language: state.language,
      panelCollapsed: state.panelCollapsed,
    });
  }

  function attachSettingsChangeHandler() {
    if (
      typeof chrome === 'undefined' ||
      !chrome.storage ||
      !chrome.storage.onChanged ||
      !chrome.storage.onChanged.addListener
    ) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      const changed = changes && changes[SETTINGS_KEY];
      if (areaName !== 'local' || !changed || !changed.newValue) return;
      const nextLanguage = i18n.normalizeLanguage(changed.newValue.language);
      const nextPanelCollapsed = Boolean(changed.newValue.panelCollapsed);
      const languageChanged = nextLanguage !== state.language;
      const collapsedChanged = nextPanelCollapsed !== state.panelCollapsed;
      if (!languageChanged && !collapsedChanged) return;
      state.language = nextLanguage;
      state.panelCollapsed = nextPanelCollapsed;
      ensurePanel();
      updatePanelCollapsedUi();
      refreshPanelText();
      if (state.badgesEnabled && state.sortedItems.length > 0) {
        applyVisualOrder();
      }
    });
  }

  async function saveSortState() {
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (!playlistId || state.sortedItems.length === 0 || state.order === 'native') return;
    await storageSet(storageKeyForPlaylist(playlistId), {
      playlistId,
      order: state.order,
      sortedItems: state.sortedItems,
      dateByVideoId: Object.assign({}, state.dateByVideoId),
      savedAt: Date.now(),
    });
  }

  async function clearSortState() {
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (!playlistId) return;
    state.restoredPlaylistId = '';
    await storageRemove(storageKeyForPlaylist(playlistId));
  }

  async function restoreSortState() {
    ensurePanel();
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (!playlistId || state.restoredPlaylistId === playlistId) return;
    const saved = await storageGet(storageKeyForPlaylist(playlistId));
    if (!saved || !Array.isArray(saved.sortedItems) || saved.sortedItems.length === 0) return;

    state.restoredPlaylistId = playlistId;
    state.order = saved.order === 'desc' ? 'desc' : 'asc';
    state.sortedItems = saved.sortedItems;
    state.dateByVideoId = Object.assign(Object.create(null), saved.dateByVideoId || {});
    state.badgesEnabled = false;
    const select = state.panel && state.panel.querySelector('[data-ytpds-order]');
    if (select) select.value = state.order;
    applySavedOrderWithoutBadges();
    ensureVisualObserver();
    scheduleSavedOrderApply(250);
    scheduleSavedOrderApply(1000);
    scheduleSavedOrderApply(2500);
    if (state.badgesEnabled) {
      setSummaryStatus();
    } else {
      setStatusKey('saved', state.sortedItems.length);
    }
    ensurePanel();
  }

  function applySavedOrderWithoutBadges() {
    state.badgesEnabled = false;
    state.forceOrderWithoutBadges = true;
    try {
      state.visualMode = 'sorted';
      applyVisualOrder();
      clearDecorations();
    } finally {
      state.visualMode = 'badges';
      state.forceOrderWithoutBadges = false;
    }
    tryAutoEnableSavedBadges('saved order');
  }

  function scheduleSavedOrderApply(ms) {
    setTimeout(() => {
      if (state.sortedItems.length > 0 && !state.badgesEnabled) {
        applySavedOrderWithoutBadges();
      } else if (state.sortedItems.length > 0) {
        tryAutoEnableSavedBadges(`saved order ${ms}ms`);
      }
    }, ms);
  }

  function scheduleVisualOrderApply(ms) {
    setTimeout(() => {
      if (state.sortedItems.length > 0) {
        applyVisualOrder();
        highlightCurrentVideo();
      }
    }, ms);
  }

  async function goNextByPublishDate() {
    if (state.sortedItems.length === 0) {
      await refreshSortedItems();
    }
    const currentVideoId = sorter.getVideoIdFromUrl(location.href);
    const nextVideoId =
      currentVideoId && state.sortedItems.some((item) => item.videoId === currentVideoId)
        ? sorter.findNextVideoId(state.sortedItems, currentVideoId)
        : state.sortedItems[0] && state.sortedItems[0].videoId;
    if (!nextVideoId) {
      setStatusKey('noNext');
      return;
    }

    location.href = sorter.buildWatchUrl(nextVideoId, sorter.getPlaylistIdFromUrl(location.href));
  }

  function attachEndedHandler() {
    const video = document.querySelector('video');
    if (!video || video.dataset.ytpdsEndedBound === '1') return;
    video.dataset.ytpdsEndedBound = '1';
    video.addEventListener('ended', () => {
      if (state.autoAdvance && isPlaylistWatchPage()) {
        goNextByPublishDate();
      }
    });
  }

  function onNavigationMaybeChanged() {
    const urlChanged = state.lastUrl !== location.href;
    const pathChanged = state.lastPathname !== location.pathname;
    if (urlChanged) {
      state.lastUrl = location.href;
    }
    if (pathChanged) {
      state.lastPathname = location.pathname;
    }
    const playlistId = sorter.getPlaylistIdFromUrl(location.href);
    if (playlistId !== state.playlistId) {
      state.playlistId = playlistId;
      state.sortedItems = [];
      state.restoredPlaylistId = '';
      state.badgesEnabled = false;
      clearDecorations();
    }
    const panelMissingBeforeEnsure =
      isSupportedPlaylistPage() && (!state.panel || !document.contains(state.panel));
    ensurePanel();
    if (pathChanged && state.sortedItems.length > 0) {
      state.badgesEnabled = false;
      applySavedOrderWithoutBadges();
      scheduleSavedOrderApply(250);
      scheduleSavedOrderApply(1000);
      scheduleSavedOrderApply(2500);
    } else if (urlChanged || panelMissingBeforeEnsure) {
      restoreSortState();
    }
    if (state.sortedItems.length > 0) {
      ensureVisualObserver();
      if (state.badgesEnabled) {
        scheduleVisualOrderApply(250);
        scheduleVisualOrderApply(1000);
        scheduleVisualOrderApply(2500);
      } else {
        scheduleSavedOrderApply(250);
        scheduleSavedOrderApply(1000);
        scheduleSavedOrderApply(2500);
      }
    }
    highlightCurrentVideo();
    attachEndedHandler();
  }

  function highlightCurrentVideo() {
    if (state.sortedItems.length === 0) return;
    const rowByVideoId = new Map();
    for (const row of getPlaylistRows()) {
      const videoId = getVideoIdFromRow(row);
      if (videoId) rowByVideoId.set(videoId, row);
    }
    safelyDecorateRows(rowByVideoId);
  }

  ensurePanel();
  ensurePanelObserver();
  restoreSettings();
  attachSettingsChangeHandler();
  restoreSortState();
  attachEndedHandler();
  document.addEventListener('DOMContentLoaded', ensurePanel);
  document.addEventListener('readystatechange', ensurePanel);
  document.addEventListener('yt-navigate-finish', onNavigationMaybeChanged);
  window.addEventListener('popstate', onNavigationMaybeChanged);
  setInterval(onNavigationMaybeChanged, 500);
  setInterval(() => {
    if (
      !state.loading &&
      state.badgesEnabled &&
      state.sortedItems.length > 0 &&
      !hasDesiredDomOrder()
    ) {
      applyVisualOrder();
    }
  }, 1500);
})();
