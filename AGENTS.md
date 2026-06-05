# youtube-playlist-date-sorter

YouTube の `playlist` / `watch` ページ上で、表示中のプレイリストを動画投稿日順に並び替え、その順序に沿って次の動画へ移動する Manifest V3 ブラウザ拡張。

## スコープ

- 対象 URL: `https://www.youtube.com/playlist*`, `https://www.youtube.com/watch*`
- YouTube Data API は使わない。
- プレイリスト自体の順序は変更しない。
- 拡張側が次に開く動画 URL を決める。
- 右側プレイリストの見た目順は DOM を並べ替えて再適用する。YouTube 本体の内部キューは変更しない。
- 並び替え結果は `chrome.storage.local` に playlist ID 単位で保存し、同じプレイリストの `playlist` / `watch` 間で復元する。

## 検証

```powershell
node .\verify-date-sorter.mjs
```

リリースパッケージ変更時:

```powershell
.\scripts\package-release.ps1 -Target all
```

## リリース管理

- Chrome: `manifests/chrome.json` を更新し、`.\scripts\package-release.ps1 -Target chrome` を実行する。
- Firefox: `manifests/firefox.json` を更新し、`.\scripts\package-release.ps1 -Target firefox` を実行する。
- 生成物は `dist/` 配下に置き、Git 管理しない。

## 既知の制約

- YouTube の DOM 構造変更に弱い。
- DOM にロード済みのプレイリスト項目だけを対象にする。
- 日時取得は各動画ページ HTML の `publishDate` / `datePublished` から抽出する。
- 初期上限は 120 件。長いプレイリストは必要に応じて上限・読み込み方式を見直す。
- YouTube の再描画で表示順が戻る場合があるため、`MutationObserver` で再適用する。
