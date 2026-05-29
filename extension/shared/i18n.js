(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    root.__YT_PDS_I18N__ = api;
    if (typeof window !== 'undefined') {
      window.__YT_PDS_I18N__ = api;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const TEXT = {
    ja: {
      title: '投稿日順プレイリスト',
      minimize: '最小化',
      expand: '展開',
      orderLabel: '並び順',
      languageLabel: '表示言語',
      normalOrder: '通常順',
      oldestFirst: '古い投稿日から',
      newestFirst: '新しい投稿日から',
      sort: '並び替え',
      sorting: '並び替え中...',
      next: '次の動画へ',
      auto(value) {
        return `自動: ${value ? 'ON' : 'OFF'}`;
      },
      ready: 'プレイリスト表示後に並び替えてください。',
      defaultProgress: '処理中',
      waitingPhase: 'プレイリスト項目を待機中',
      waitingStatus: 'プレイリスト項目を待っています...',
      loadingPhase: '全ての項目を読み込み中',
      loadingStatus: '全ての項目を読み込んでいます...',
      noItems: 'プレイリスト項目を検出できません。右側リストの読み込み後に再実行してください。',
      fetchingPhase: '投稿日を取得中',
      fetchingStatus(total, completed) {
        return completed == null
          ? `${total}件の投稿日を取得中...`
          : `${total}件の投稿日を取得中... ${completed}/${total}`;
      },
      sortingPhase: '表示を並び替え中',
      summary(count, order, known, failed, stats, debug) {
        const detail = failed
          ? ` 失敗: HTTP ${stats.httpError}, 日付なし ${stats.noDate}, 通信 ${stats.networkError}。`
          : '';
        const last = debug ? ` 最後: ${debug}` : '';
        return `${count}件を${order === 'desc' ? '新しい' : '古い'}投稿日順に準備済み。投稿日取得 ${known}/${count}。${detail}${last}`;
      },
      unknownDate: '日付不明',
      badge(index, date) {
        return `投稿日順 #${index} ${date}`;
      },
      saved(count) {
        return `${count}件の保存済み投稿日順があります。表示するには「並び替え」を押してください。`;
      },
      noNext: '投稿日順リストの末尾、または現在動画がリスト外です。',
      nativeRestored: 'YouTubeの通常順に戻しました。',
      truncated(max) {
        return ` 上限${max}件まで処理しました。`;
      },
    },
    en: {
      title: 'Publish-date playlist',
      minimize: 'Minimize',
      expand: 'Expand',
      orderLabel: 'Sort order',
      languageLabel: 'Language',
      normalOrder: 'Default order',
      oldestFirst: 'Oldest first',
      newestFirst: 'Newest first',
      sort: 'Sort',
      sorting: 'Sorting...',
      next: 'Next video',
      auto(value) {
        return `Auto: ${value ? 'ON' : 'OFF'}`;
      },
      ready: 'Sort after the playlist is visible.',
      defaultProgress: 'Working',
      waitingPhase: 'Waiting for playlist items',
      waitingStatus: 'Waiting for playlist items...',
      loadingPhase: 'Loading all items',
      loadingStatus: 'Loading all playlist items...',
      noItems: 'No playlist items found. Try again after the side list loads.',
      fetchingPhase: 'Fetching publish dates',
      fetchingStatus(total, completed) {
        return completed == null
          ? `Fetching publish dates for ${total} videos...`
          : `Fetching publish dates for ${total} videos... ${completed}/${total}`;
      },
      sortingPhase: 'Sorting the visible list',
      summary(count, order, known, failed, stats, debug) {
        const detail = failed
          ? ` Failed: HTTP ${stats.httpError}, no date ${stats.noDate}, network ${stats.networkError}.`
          : '';
        const last = debug ? ` Last: ${debug}` : '';
        return `${count} videos ready in ${order === 'desc' ? 'newest' : 'oldest'} publish-date order. Dates fetched ${known}/${count}.${detail}${last}`;
      },
      unknownDate: 'unknown date',
      badge(index, date) {
        return `Publish order #${index} ${date}`;
      },
      saved(count) {
        return `${count} saved publish-date items found. Press "Sort" to show badges.`;
      },
      noNext: 'This is the end of the publish-date list, or the current video is outside the list.',
      nativeRestored: 'Restored YouTube default order.',
      truncated(max) {
        return ` Processed up to the ${max}-item limit.`;
      },
    },
  };

  function normalizeLanguage(language) {
    return language === 'en' ? 'en' : 'ja';
  }

  function translate(language, key, ...args) {
    const table = TEXT[normalizeLanguage(language)] || TEXT.ja;
    const value = table[key] || TEXT.ja[key] || '';
    return typeof value === 'function' ? value(...args) : value;
  }

  return {
    normalizeLanguage,
    translate,
  };
});
