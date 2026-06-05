import assert from 'assert/strict';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sorter = require('./extension/shared/date-sorter.js');
const i18n = require('./extension/shared/i18n.js');

const html = readFileSync('fixtures/watch-page.html', 'utf8');
const contentScript = readFileSync('extension/content/content.js', 'utf8');
const contentCss = readFileSync('extension/content/content.css', 'utf8');
const chromeManifest = JSON.parse(readFileSync('manifests/chrome.json', 'utf8'));
const firefoxManifest = JSON.parse(readFileSync('manifests/firefox.json', 'utf8'));
const jaLocale = JSON.parse(readFileSync('extension/_locales/ja/messages.json', 'utf8'));
const enLocale = JSON.parse(readFileSync('extension/_locales/en/messages.json', 'utf8'));
assert.equal(sorter.extractPublishDateFromHtml(html), '2024-03-05');
assert.match(html, /<ytd-playlist-panel-video-renderer>/);
assert.match(html, /class="metadata-wrapper"/);
assert.match(contentScript, /\.metadata-wrapper/);
assert.match(contentScript, /ytpds-badge-overlay/);
assert.match(contentScript, /mixed parents, decorated/);
assert.match(contentScript, /localStorage\.getItem\('ytpds:debug'\)/);
assert.match(contentScript, /mutations\.some\(shouldReapplyForMutation\)/);
assert.match(contentScript, /function shouldReapplyForMutation/);
assert.match(contentScript, /function scheduleSavedOrderRetries/);
assert.match(contentScript, /clearSavedOrderRetries\(\);\s*scheduleSavedOrderApply\(250\);/);
assert.match(contentScript, /state\.badgesEnabled && \(urlChanged \|\| pathChanged \|\| panelMissingBeforeEnsure\)/);
assert.match(contentScript, /const restoreLoadedScroll = await loadAllPlaylistRows\(MAX_ITEMS\);/);
assert.match(
  contentScript,
  /allItems = await waitForPlaylistItems\(\);\s*\} finally \{\s*restoreLoadedScroll\(\);/
);
assert.match(
  contentScript,
  /state\.sortedItems = sorter\.sortItems\(state\.sortedItems, state\.dateByVideoId, state\.order\)[\s\S]*?applyCachedSortVisualOrder\('selected order'\);/
);
assert.match(
  contentScript,
  /function applyCachedSortVisualOrder\(reason\)[\s\S]*?state\.cachedApplyDeadline = Date\.now\(\) \+ CACHED_APPLY_TIMEOUT_MS;[\s\S]*?runCachedSortApplyLoop\(reason\);/
);
assert.match(
  contentScript,
  /function runCachedSortApplyLoop\(reason\)[\s\S]*?state\.visualMode = 'sorted';\s*applyVisualOrder\(\);\s*state\.visualMode = 'badges';\s*ensureVisualObserver\(\);\s*highlightCurrentVideo\(\);/
);
assert.match(
  contentScript,
  /state\.cachedApplyTimer = setTimeout\(\s*\(\) => runCachedSortApplyLoop\(reason\),\s*CACHED_APPLY_STEP_MS\s*\);/
);
assert.match(
  contentScript,
  /function clearCachedSortApply\(\)[\s\S]*?clearTimeout\(state\.cachedApplyTimer\);[\s\S]*?state\.cachedApplyReason = '';/
);
assert.match(
  contentScript,
  /state\.badgesEnabled = true;\s*const select[\s\S]*?applyCachedSortVisualOrder\('saved order'\);\s*setSummaryStatus\(\);/
);
assert.match(
  contentScript,
  /if \(pathChanged && state\.sortedItems\.length > 0\) \{\s*applyCachedSortVisualOrder\('navigation'\);/
);
assert.doesNotMatch(contentScript, /pathChanged && state\.sortedItems\.length > 0[\s\S]{0,120}state\.badgesEnabled = false/);
assert.match(
  contentScript,
  /function highlightCurrentVideo\(\) \{\s*if \(!state\.badgesEnabled \|\| state\.sortedItems\.length === 0\) return;/
);
assert.doesNotMatch(contentScript, /attributeFilter: \['class'/);
// 101+ playlist fix: load all lazily-rendered rows before extracting,
// raise the item cap, and stop the reorder loop that flickers thumbnails.
assert.match(contentScript, /const MAX_ITEMS = 300;/);
assert.match(contentScript, /const CACHED_APPLY_TIMEOUT_MS = 30000;/);
assert.match(contentScript, /const CACHED_APPLY_STEP_MS = 500;/);
assert.match(contentScript, /const LOAD_ALL_STABLE_TICKS = 8;/);
assert.match(contentScript, /async function loadAllPlaylistRows\(maxItems\)/);
assert.match(contentScript, /function scrollPlaylistRowsTowardEnd\(lastRow, restoreElementScrollTops\)/);
assert.match(contentScript, /function getPlaylistScrollTargets\(lastRow\)/);
assert.match(contentScript, /function restoreScroll\(\)/);
assert.match(contentScript, /playlistRoot\.querySelector\(selector\)/);
assert.match(contentScript, /window\.scrollBy\(0, Math\.max\(window\.innerHeight \* 0\.8, 600\)\);/);
// Sort source must equal reorder source (getPlaylistRows) to avoid selector drift.
assert.match(contentScript, /function extractItemsFromRows\(\)/);
assert.match(contentScript, /lastItems = extractItemsFromRows\(\);/);
assert.match(contentScript, /await loadAllPlaylistRows\(MAX_ITEMS\);/);
assert.match(contentScript, /state\.reorderGaveUp = true;/);
assert.match(contentScript, /REORDER_THRASH_LIMIT/);
assert.match(contentScript, /!state\.reorderGaveUp &&\s*!hasDesiredDomOrder\(\)/);
// Flicker root cause: convergence must compare only the sorted videos' order,
// not all rows, otherwise a length mismatch loops the reorder forever.
assert.match(contentScript, /const desiredSet = new Set\(desiredOrder\);/);
assert.doesNotMatch(
  contentScript,
  /Array\.from\(parent\.children\)\s*\.filter\(\(node\) => rowByVideoId\.has\(getVideoIdFromRow\(node\)\)\)/
);
assert.match(contentCss, /ytd-playlist-panel-video-renderer\.ytpds-badge-overlay > \.ytpds-date-badge/);
assert.match(contentCss, /\.ytpds-debug/);
assert.equal(
  sorter.extractPublishDateFromHtml('window["ytInitialPlayerResponse"]="{\\u0022microformat\\u0022:{\\u0022playerMicroformatRenderer\\u0022:{\\u0022publishDate\\u0022:\\u00222023-07-09\\u0022}}}"'),
  '2023-07-09'
);
assert.equal(
  sorter.extractPublishDateFromHtml('{"dateText":{"simpleText":"2022年4月3日"}}'),
  '2022-04-03'
);
assert.equal(
  sorter.extractPublishDateFromHtml('{"publishDateText":{"simpleText":"2021/6/12"}}'),
  '2021-06-12'
);

const fakeTitle = {
  textContent: ' First Stream ',
  getAttribute(name) {
    return name === 'title' ? 'First Stream' : null;
  },
};
const fakeRow = {
  querySelector(selector) {
    return selector === '#video-title' ? fakeTitle : null;
  },
};
const fakeAnchor = {
  href: 'https://www.youtube.com/watch?v=first&list=PLtest&index=1',
  textContent: 'fallback',
  closest() {
    return fakeRow;
  },
  getAttribute(name) {
    return name === 'href' ? this.href : null;
  },
};
const fakeDocument = {
  querySelectorAll() {
    return [fakeAnchor, fakeAnchor];
  },
};
assert.deepEqual(sorter.extractPlaylistItemsFromDocument(fakeDocument), [
  { videoId: 'first', title: 'First Stream', originalIndex: 0 },
]);

// Regression: extraction must not silently cap at ~100 rows. Given 150 unique
// anchors (mimicking a fully loaded 150-item playlist) it returns all 150.
const manyAnchors = Array.from({ length: 150 }, (_unused, index) => {
  const href = `https://www.youtube.com/watch?v=vid${index}&list=PLbig&index=${index + 1}`;
  return {
    href,
    textContent: `Video ${index}`,
    closest() {
      return null;
    },
    querySelector() {
      return null;
    },
    getAttribute(name) {
      return name === 'href' ? href : null;
    },
  };
});
const manyDocument = {
  querySelectorAll() {
    return manyAnchors;
  },
};
const manyItems = sorter.extractPlaylistItemsFromDocument(manyDocument);
assert.equal(manyItems.length, 150);
assert.equal(manyItems[149].videoId, 'vid149');

const items = [
  { videoId: 'newer', title: 'newer', originalIndex: 0 },
  { videoId: 'older', title: 'older', originalIndex: 1 },
  { videoId: 'unknown', title: 'unknown', originalIndex: 2 },
];
const dates = {
  newer: '2024-03-05',
  older: '2021-01-10',
};

const asc = sorter.sortItemsByPublishDate(items, dates, 'asc');
assert.deepEqual(
  asc.map((item) => item.videoId),
  ['older', 'newer', 'unknown']
);
assert.equal(sorter.findNextVideoId(asc, 'older'), 'newer');
assert.equal(
  sorter.buildWatchUrl('abc123', 'PLtest'),
  'https://www.youtube.com/watch?v=abc123&list=PLtest'
);

const desc = sorter.sortItemsByPublishDate(items, dates, 'desc');
assert.deepEqual(
  desc.map((item) => item.videoId),
  ['newer', 'older', 'unknown']
);
assert.equal(sorter.normalizeSortOrder('bad-value'), 'asc');
assert.equal(sorter.getSortKind('title-desc'), 'title');
assert.deepEqual(
  sorter.sortItems(
    [
      { videoId: 'b', title: 'Video 10', originalIndex: 0 },
      { videoId: 'a', title: 'Video 2', originalIndex: 1 },
    ],
    {},
    'title-asc'
  ).map((item) => item.videoId),
  ['a', 'b']
);

assert.equal(i18n.normalizeLanguage('en'), 'en');
assert.equal(i18n.normalizeLanguage('fr'), 'ja');
assert.equal(i18n.translate('en', 'sort'), 'Sort');
assert.equal(i18n.translate('en', 'minimize'), 'Minimize');
assert.equal(i18n.translate('en', 'normalOrder'), 'Default order');
assert.equal(i18n.translate('en', 'titleAsc'), 'Title A-Z');
assert.equal(i18n.translate('ja', 'expand'), '展開');
assert.equal(i18n.translate('ja', 'nativeRestored'), 'YouTubeの通常順に戻しました。');
assert.equal(i18n.translate('ja', 'badge', 2, '2024-03-05'), '投稿日順 #2 2024-03-05');
assert.equal(i18n.translate('en', 'badge', 3, 'Video 2', 'title-asc'), 'Title order #3 Video 2');
assert.equal(i18n.translate('ja', 'truncated', 300), ' 上限300件まで処理しました。');
assert.equal(i18n.translate('en', 'truncated', 300), ' Processed up to the 300-item limit.');
assert.equal(i18n.translate('ja', 'loadingStatus'), '全ての項目を読み込んでいます...');
assert.deepEqual(chromeManifest.content_scripts[0].matches, ['https://www.youtube.com/*']);
assert.deepEqual(firefoxManifest.content_scripts[0].matches, ['https://www.youtube.com/*']);
assert.equal(chromeManifest.version, '0.1.5');
assert.equal(firefoxManifest.version, '0.1.5');
assert.equal(chromeManifest.name, '__MSG_extName__');
assert.equal(chromeManifest.description, '__MSG_extDescription__');
assert.equal(chromeManifest.default_locale, 'ja');
assert.equal(chromeManifest.action.default_title, '__MSG_actionTitle__');
assert.equal(firefoxManifest.default_locale, 'ja');
assert.equal(jaLocale.extName.message, 'YouTube Playlist Date Sorter');
assert.match(jaLocale.extDescription.message, /投稿日順やタイトル順/);
assert.equal(enLocale.extName.message, 'YouTube Playlist Date Sorter');
assert.match(enLocale.extDescription.message, /publish date or title/);
assert.equal(firefoxManifest.browser_specific_settings.gecko.id, 'youtube-playlist-date-sorter@harness');
assert.deepEqual(
  firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required,
  ['none']
);
assert.match(contentScript, /option value="native"/);
assert.match(contentScript, /option value="title-asc"/);
assert.doesNotMatch(contentScript, /option value="added-/);
assert.doesNotMatch(contentScript, /extractAddedDateFromRow/);
assert.match(contentScript, /function requiresPublishDates\(\)/);
assert.match(contentScript, /function needsPublishDatesForCurrentItems\(\)/);
assert.match(contentScript, /if \(needsPublishDatesForCurrentItems\(\)\) \{\s*refreshSortedItems\(\);\s*return;\s*\}/);
assert.doesNotMatch(readFileSync('extension/shared/date-sorter.js', 'utf8'), /extractAddedDateFromText/);
assert.doesNotMatch(readFileSync('extension/shared/i18n.js', 'utf8'), /visibleOrderFallback|addedAsc|addedDesc/);
assert.match(contentScript, /clearSortState/);
assert.match(readFileSync('extension/shared/date-sorter.js', 'utf8'), /window\.__YT_PDS__ = api/);
assert.match(readFileSync('extension/shared/i18n.js', 'utf8'), /window\.__YT_PDS_I18N__ = api/);

console.log('date sorter verification passed');
