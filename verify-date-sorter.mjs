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
assert.equal(sorter.extractPublishDateFromHtml(html), '2024-03-05');
assert.match(html, /<ytd-playlist-panel-video-renderer>/);
assert.match(html, /class="metadata-wrapper"/);
assert.match(contentScript, /\.metadata-wrapper/);
assert.match(contentScript, /ytpds-badge-overlay/);
assert.match(contentScript, /mixed parents, decorated/);
assert.match(contentScript, /localStorage\.getItem\('ytpds:debug'\)/);
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

assert.equal(i18n.normalizeLanguage('en'), 'en');
assert.equal(i18n.normalizeLanguage('fr'), 'ja');
assert.equal(i18n.translate('en', 'sort'), 'Sort');
assert.equal(i18n.translate('en', 'minimize'), 'Minimize');
assert.equal(i18n.translate('en', 'normalOrder'), 'Default order');
assert.equal(i18n.translate('ja', 'expand'), '展開');
assert.equal(i18n.translate('ja', 'nativeRestored'), 'YouTubeの通常順に戻しました。');
assert.equal(i18n.translate('ja', 'badge', 2, '2024-03-05'), '投稿日順 #2 2024-03-05');
assert.deepEqual(chromeManifest.content_scripts[0].matches, ['https://www.youtube.com/*']);
assert.deepEqual(firefoxManifest.content_scripts[0].matches, ['https://www.youtube.com/*']);
assert.equal(firefoxManifest.browser_specific_settings.gecko.id, 'youtube-playlist-date-sorter@harness');
assert.deepEqual(
  firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required,
  ['none']
);
assert.match(contentScript, /option value="native"/);
assert.match(contentScript, /clearSortState/);
assert.match(readFileSync('extension/shared/date-sorter.js', 'utf8'), /window\.__YT_PDS__ = api/);
assert.match(readFileSync('extension/shared/i18n.js', 'utf8'), /window\.__YT_PDS_I18N__ = api/);

console.log('date sorter verification passed');
