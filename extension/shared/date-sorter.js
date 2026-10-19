(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    root.__YT_PDS__ = api;
    if (typeof window !== 'undefined') {
      window.__YT_PDS__ = api;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const WATCH_PATH = '/watch';

  function getPlaylistIdFromUrl(urlLike) {
    try {
      const url = new URL(urlLike, 'https://www.youtube.com');
      return url.searchParams.get('list') || '';
    } catch (_) {
      return '';
    }
  }

  function getVideoIdFromUrl(urlLike) {
    try {
      const url = new URL(urlLike, 'https://www.youtube.com');
      return url.searchParams.get('v') || '';
    } catch (_) {
      return '';
    }
  }

  function buildWatchUrl(videoId, playlistId) {
    const url = new URL(WATCH_PATH, 'https://www.youtube.com');
    url.searchParams.set('v', videoId);
    if (playlistId) {
      url.searchParams.set('list', playlistId);
    }
    return url.toString();
  }

  function normalizePlaylistRow(candidate) {
    if (!candidate) return null;

    let row = candidate;
    const href =
      (candidate.getAttribute && candidate.getAttribute('href')) ||
      candidate.href ||
      '';
    const isWatchAnchor =
      (candidate.matches && candidate.matches('a[href*="/watch"][href*="v="]')) ||
      (String(href).includes('/watch') && String(href).includes('v='));
    if (isWatchAnchor && candidate.closest) {
      row =
        candidate.closest(
          'ytd-playlist-panel-video-renderer, ytd-playlist-panel-video-wrapper-renderer, ytd-playlist-video-renderer, ytd-rich-item-renderer, yt-lockup-view-model'
        ) || candidate;
    }

    // The current playlist page renders each lockup inside a sibling wrapper
    // div. Moving the inner lockup leaves every item with a different parent,
    // so use the wrapper as the sortable row.
    if (row.matches && row.matches('yt-lockup-view-model')) {
      return row.parentElement || row;
    }
    return row;
  }

  function extractPlaylistItemsFromDocument(documentRef) {
    if (!documentRef) return [];

    const isPlaylistPage =
      documentRef.location && documentRef.location.pathname === '/playlist';
    const selector = isPlaylistPage
      ? 'ytd-playlist-video-renderer a[href*="/watch"][href*="v="], ytd-playlist-video-list-renderer ytd-playlist-video-renderer a[href*="/watch"][href*="v="], yt-item-section-renderer yt-lockup-view-model a[href*="/watch"][href*="v="]'
      : 'ytd-playlist-panel-video-renderer a[href*="/watch"][href*="v="], ytd-playlist-panel-video-wrapper-renderer a[href*="/watch"][href*="v="], ytd-playlist-panel-renderer a[href*="/watch"][href*="v="], ytd-playlist-video-renderer a[href*="/watch"][href*="v="]';
    const anchors = Array.from(documentRef.querySelectorAll(selector));
    const seen = new Set();
    const items = [];

    for (const anchor of anchors) {
      const videoId = getVideoIdFromUrl(anchor.href || anchor.getAttribute('href') || '');
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);

      const row = normalizePlaylistRow(anchor);
      const titleNode =
        row.querySelector('#video-title') ||
        row.querySelector('[id="video-title"]') ||
        row.querySelector('h3[title]') ||
        row.querySelector('span[title]') ||
        anchor;
      const title =
        (titleNode.getAttribute && titleNode.getAttribute('title')) ||
        (titleNode.textContent || '').trim() ||
        anchor.getAttribute('aria-label') ||
        videoId;

      items.push({
        videoId,
        title: title.replace(/\s+/g, ' ').trim(),
        originalIndex: items.length,
      });
    }

    return items;
  }

  function extractPublishDateFromHtml(html) {
    if (!html) return null;

    const normalized = normalizeHtmlForDateSearch(html);
    const exactDateCandidates = [
      /"publishDate"\s*:\s*"([^"]+)"/,
      /"uploadDate"\s*:\s*"([^"]+)"/,
      /"datePublished"\s*:\s*"([^"]+)"/,
      /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i,
      /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    ];

    for (const pattern of exactDateCandidates) {
      const match = normalized.match(pattern);
      const date = normalizeDateText(match && match[1]);
      if (date) return date;
    }

    const textDateCandidates = [
      /"dateText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/,
      /"publishDateText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/,
    ];

    for (const pattern of textDateCandidates) {
      const match = normalized.match(pattern);
      const date = normalizeDateText(match && match[1]);
      if (date) return date;
    }

    return null;
  }

  function normalizeHtmlForDateSearch(html) {
    return String(html)
      .replace(/\\u0022|\\x22|&quot;/g, '"')
      .replace(/\\u003c|\\x3c|&lt;/gi, '<')
      .replace(/\\u003e|\\x3e|&gt;/gi, '>')
      .replace(/\\u0026|&amp;/g, '&')
      .replace(/\\\//g, '/');
  }

  function normalizeDateText(text) {
    if (!text) return null;
    const cleaned = String(text).trim();

    const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const slash = cleaned.match(/(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
    if (slash) return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;

    const japanese = cleaned.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (japanese) {
      return `${japanese[1]}-${japanese[2].padStart(2, '0')}-${japanese[3].padStart(2, '0')}`;
    }

    return null;
  }

  function toDateMs(dateText) {
    if (!dateText) return Number.POSITIVE_INFINITY;
    const ms = Date.parse(`${dateText}T00:00:00Z`);
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  }

  function normalizeSortOrder(order) {
    if (order === 'native') return 'native';
    if (order === 'desc') return 'desc';
    if (order === 'title-asc' || order === 'title-desc') return order;
    if (order === 'duration-asc' || order === 'duration-desc') return order;
    return 'asc';
  }

  function getSortKind(order) {
    const normalized = normalizeSortOrder(order);
    if (normalized === 'title-asc' || normalized === 'title-desc') return 'title';
    if (normalized === 'duration-asc' || normalized === 'duration-desc') return 'duration';
    if (normalized === 'native') return 'native';
    return 'publish';
  }

  function sortItems(items, dateByVideoId, order) {
    const normalized = normalizeSortOrder(order);
    const kind = getSortKind(normalized);
    if (kind === 'title') return sortItemsByTitle(items, normalized);
    if (kind === 'duration') return sortItemsByDuration(items, normalized);
    return sortItemsByPublishDate(items, dateByVideoId, normalized);
  }

  function parseDurationSeconds(text) {
    if (!text) return Infinity;
    const parts = String(text).trim().split(':').map(Number);
    if (parts.length < 2 || parts.some(Number.isNaN)) return Infinity;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }

  function sortItemsByDuration(items, order) {
    const multiplier = order === 'duration-desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      const aSeconds = parseDurationSeconds(a.duration);
      const bSeconds = parseDurationSeconds(b.duration);
      const aUnknown = !Number.isFinite(aSeconds);
      const bUnknown = !Number.isFinite(bSeconds);
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
      if (aSeconds !== bSeconds) return (aSeconds - bSeconds) * multiplier;
      return a.originalIndex - b.originalIndex;
    });
  }

  function sortItemsByPublishDate(items, dateByVideoId, order) {
    const multiplier = order === 'desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      const aDate = toDateMs(dateByVideoId[a.videoId]);
      const bDate = toDateMs(dateByVideoId[b.videoId]);
      const aUnknown = !Number.isFinite(aDate);
      const bUnknown = !Number.isFinite(bDate);
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
      if (aDate !== bDate) return (aDate - bDate) * multiplier;
      return a.originalIndex - b.originalIndex;
    });
  }

  function sortItemsByTitle(items, order) {
    const multiplier = order === 'title-desc' ? -1 : 1;
    return [...items].sort((a, b) => {
      const compared = compareText(a.title, b.title);
      if (compared !== 0) return compared * multiplier;
      return a.originalIndex - b.originalIndex;
    });
  }

  function compareText(left, right) {
    const leftText = normalizeSortText(left);
    const rightText = normalizeSortText(right);
    return leftText.localeCompare(rightText, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  function normalizeSortText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function findNextVideoId(sortedItems, currentVideoId) {
    const index = sortedItems.findIndex((item) => item.videoId === currentVideoId);
    if (index < 0 || index >= sortedItems.length - 1) return '';
    return sortedItems[index + 1].videoId;
  }

  return {
    buildWatchUrl,
    extractPlaylistItemsFromDocument,
    extractPublishDateFromHtml,
    findNextVideoId,
    getPlaylistIdFromUrl,
    getVideoIdFromUrl,
    getSortKind,
    normalizePlaylistRow,
    normalizeSortOrder,
    parseDurationSeconds,
    sortItems,
    sortItemsByDuration,
    sortItemsByPublishDate,
    sortItemsByTitle,
  };
});
