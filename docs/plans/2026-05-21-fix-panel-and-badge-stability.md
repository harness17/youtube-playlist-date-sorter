# 2026-05-21 パネル表示・バッジ安定性の修正

## 依頼内容

YouTube Playlist Date Sorter 拡張で次の挙動不安定を解消する。

1. `youtube.com/playlist?list=...` を開いてもパネル UI が出ない。リロードすると出る。
2. プレイリスト一覧から動画詳細（`/watch?v=...&list=...`）に入ったとき、サイドのプレイリスト行にバッジ（日付・順番）が表示されないことがある。
3. `/watch` ページで並び替えを実行すると、バッジが表示と非表示を繰り返してチラつく。

## 起点コミット

`9d83082 fix: hide visual order debug status`

## スコープ

- やる:
  - `content/content.js` 内のパネル生成タイミング、`applyVisualOrder` / `decorateRows` / `MutationObserver` / setInterval の再描画ループの修正
  - バッジ DOM を都度 remove → 再生成しないよう差分更新化
  - パネル DOM が消えた場合の再生成保証
- やらない:
  - 並び替えロジック（`shared/date-sorter.js`）の変更
  - manifest の権限変更
  - i18n 文言の変更
  - 新機能追加

## 現状コードの原因仮説

### 問題1: プレイリスト一覧ページでパネルが出ない

- `ensurePanel()` は `document.documentElement.appendChild(panel)` でパネルを追加する。
- 初期実行 `ensurePanel()` は IIFE 末尾で 1 回呼ばれるだけ。
- SPA ナビゲーションでは `yt-navigate-finish` で `onNavigationMaybeChanged()` が呼ばれるが、YouTube が `<html>` の子要素を初期化処理中に外す可能性、または `isSupportedPlaylistPage()` の判定タイミングで pathname が `/playlist` でない状態（リダイレクト遷移途中）でスキップされる可能性がある。
- `state.panel && document.contains(state.panel)` チェックがあるので消えれば再生成されるが、`isSupportedPlaylistPage()` が false を返した時点で `panel.remove()` + null セットされ、次の interval まで（最大 1 秒）出ない。

### 問題2: watch ページでバッジが出ない

- `restoreSortState()` で `state.badgesEnabled = false` にした後、`applySavedOrderWithoutBadges()` で `clearDecorations()` を呼ぶ。
- ユーザーが手動で並び替えボタン (`refreshSortedItems`) を押せば `state.badgesEnabled = true` になりバッジが出るはずだが、`applyVisualOrder` 内の早期 return 条件で `state.visualMode !== 'sorted' && !state.forceOrderWithoutBadges` のとき `clearDecorations()` を呼んでしまう分岐がある。
- `refreshSortedItems` は `state.visualMode = 'sorted'` の状態で `applyVisualOrder` を呼び、その後 `state.visualMode = 'badges'` に変える。次に MutationObserver か setInterval が `applyVisualOrder` を呼ぶときには `visualMode === 'badges'` で、`currentOrder === desiredOrder` ブランチに入って `safelyDecorateRows` でバッジ描画される。これは正しい。
- ただし、watch ページに遷移直後の `restoreSortState` 経路では `badgesEnabled` が false のままになり、ユーザーが並び替えボタンを押さない限りバッジが出ない（これは設計通り）。問題は、並び替えボタンを押した後にもバッジが消えるケース。

### 問題3: バッジの点滅（最重要）

- `decorateRows()` の冒頭で常に `clearDecorations()` が呼ばれ、全バッジを `badge.remove()` する。直後にループで `ensureBadge(row)` が新規 `<span>` を生成。
- バッジ追加 → MutationObserver の `childList` 変更検知 → 120ms デバウンス後 `applyVisualOrder` 呼び出し → `safelyDecorateRows` → `decorateRows` → 再度 `clearDecorations` → バッジ remove → … のループ。
- `state.applyingVisualOrder = true` で 150 / 300ms 抑制しているが、setTimeout の解除直後に observer が次のイベントを拾うとまた発火する。
- さらに 1.5 秒の `setInterval` も `applyVisualOrder` を毎回呼んでおり、毎回バッジを再生成して点滅させる原因になっている。

## 修正方針（チェックボックス）

### 1. バッジ・装飾の差分更新化（問題3への直接の対処）

- [ ] `decorateRows(rowByVideoId)` の冒頭 `clearDecorations()` を削除する。代わりに以下の差分更新を行う:
  - 既存のバッジ要素が **正しい行** にあり、テキストも一致するならそのまま残す。
  - `state.sortedItems` に含まれない行で、`data-ytpds-sorted` が付いている行は装飾を解除する。
  - `state.sortedItems` に含まれる行で、`data-ytpds-sorted` が付いていないか index がズレている行のみバッジを生成・更新する。
  - `ytpds-current-video` クラスのトグルも、現在の状態と一致するときは触らない（既に部分的にやっているが徹底する）。
- [ ] `decorateRows` の最後で、 `state.sortedItems` に対応しない孤児バッジ（`ytpds-date-badge` のうち `[data-ytpds-sorted="1"]` 行以外に付いているもの）だけを削除する関数 `pruneOrphanBadges()` を追加する。
- [ ] `clearDecorations()` は「並び替え結果が破棄されたとき」「playlistId が変わったとき」のみ呼ぶ。`applyVisualOrder` のネイティブ順序検出ブランチでも、バッジを残したまま `data-ytpds-sorted` を残してよいなら remove しない。

### 2. MutationObserver の発火抑制

- [ ] MutationObserver のコールバックを、`state.applyingVisualOrder` 中は何もしないだけでなく、 **自分が追加した `ytpds-` 系の DOM 変更（バッジ追加・属性追加・data 属性追加）はトリガーしない** よう、変更レコードの `target` / `addedNodes` / `attributeName` をチェックして無視する。
  - `mutation.target.closest && mutation.target.closest('.ytpds-date-badge')` → 無視
  - `mutation.attributeName === 'data-ytpds-sorted' || 'data-ytpds-sort-index' || 'class'` で `ytpds-current-video` のみのトグル → 無視
  - 追加された node が `ytpds-date-badge` 自体 → 無視
- [ ] observer の `attributes` 監視を、必要な属性に絞れない場合は `attributeFilter` を使う、または applyVisualOrder 後に observer を一時停止→次のフレームで再開する。
- [ ] 1.5 秒の setInterval 内 `applyVisualOrder()` 呼び出しは、現在の DOM 順序が `state.sortedItems` と一致していれば早期 return するようにする（既存の `sameOrder` チェックで賄えるが、setInterval から呼ぶ前に軽量チェックを入れる）。

### 3. パネル表示の安定化

- [ ] `ensurePanel()` を、以下のタイミングでも呼ぶ:
  - `restoreSettings()` 完了後
  - `restoreSortState()` 完了後
  - DOMContentLoaded / readystatechange 後
- [ ] `onNavigationMaybeChanged` の interval を 1000ms → 500ms に短縮する（実装コストが低い場合）。または `MutationObserver` で `document.documentElement` の `childList` 変更を観測し、`state.panel` が外されたら即再生成する別 observer を追加する。
- [ ] `isSupportedPlaylistPage()` の判定で、`location.pathname` が `/playlist` または `/watch` のときに playlistId が空でも、pathname が一致していれば「準対象」と判定して panel を残す（消さない）方針に変更可。ただし副作用が読めない場合は、`isSupportedPlaylistPage()` で false になっても `state.panel` を 1 秒間は残す猶予を入れるだけでも良い。
- [ ] パネル DOM が消えたことを検知したら（`document.contains(state.panel) === false`）、即時に再生成する。

### 4. watch ページ初回バッジ表示の挙動

- [ ] `restoreSortState()` で復元したとき、`state.badgesEnabled = false` のままにする現状の設計は維持する（YouTube ネイティブ順で表示し、ユーザーが「並び替え」を押したらバッジ表示）。
- [ ] ただし、 **「並び替えボタンを押した後」** にバッジが消える事象があるなら、それは問題3の点滅と同根なので、1〜2 の対策で解消するはず。確認用に observer 抑制ログ（コンソール debug ではなく `state.lastFetchDebug` 経由）を残す。

## 完成条件（スプリントコントラクト）

- 正常系:
  - `youtube.com/playlist?list=PL...` を初回ロードしたとき、リロードなしでパネルが右下に表示される。
  - パネルから「並び替え」を実行したとき、各行に日付バッジが付き、ロード後にちらつかない（連続 5 秒間バッジ DOM が remove → append されない）。
- 認可: なし（ローカル拡張、認可なし）。
- 異常系:
  - YouTube が再描画でプレイリスト行を入れ替えても、バッジが一瞬消えて戻る現象が起きない。
  - playlistId が変わったらバッジは確実にクリアされる。
- 副作用:
  - `verify-date-sorter.mjs` が引き続き通る。
  - 既存の言語切替・自動再生 (`auto`) フローが壊れない。

## 検証手順

1. `node ./verify-date-sorter.mjs` を実行してパスを確認。
2. 拡張を再読み込みし、`youtube.com/playlist?list=PL...` をリロードなしで開き、パネル表示を確認。
3. パネルで「並び替え」を実行し、バッジ表示後に 10 秒間ページを放置してチラつきがないことを確認。
4. 動画リストの 1 つをクリックし、`/watch?v=...&list=...` に遷移したあと、パネルが残り、サイドプレイリストの並び順が保たれることを確認。
5. その状態で再度「並び替え」を押し、バッジが点滅せず安定して表示されることを確認。
6. 言語切替（popup から英語に）を行ってもバッジが残り、テキストが切り替わることを確認。
