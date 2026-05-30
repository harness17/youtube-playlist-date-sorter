# YouTube Playlist Date Sorter

YouTube のプレイリストページとプレイリスト再生ページで、表示中の動画を投稿日順に並び替え、その順序で次の動画へ移動するブラウザ拡張です。

## 使い方

1. `chrome://extensions/` を開く
2. デベロッパーモードをオン
3. `.\scripts\package-release.ps1 -Target chrome` を実行
4. 「パッケージ化されていない拡張機能を読み込む」で `dist/chrome/youtube-playlist-date-sorter-chrome-v0.1.2` を選択
5. `https://www.youtube.com/playlist?list=...` または `https://www.youtube.com/watch?...&list=...` を開く
6. 右下の「並び替え」を押す
7. プレイリスト表示が投稿日順に並び替わる
8. 「次の動画へ」または「自動: ON」で投稿日順に移動する
9. 拡張アイコンを押して、日本語 / English を切り替える
10. 右下パネルの「最小化」で表示領域を小さくし、「展開」で戻す

Firefox で手動確認する場合は `.\scripts\package-release.ps1 -Target firefox` を実行し、`about:debugging#/runtime/this-firefox` から `dist/firefox/youtube-playlist-date-sorter-firefox-v0.1.1/manifest.json` を一時的なアドオンとして読み込みます。

## 開発用ロード（バージョン非依存）

開発中は `scripts/build-dev.ps1` でバージョン名のない固定フォルダ `dist/dev/<browser>/` に出力します。一度読み込めば、以後はリビルド → ブラウザの再読み込みボタンだけで反映され、バージョンごとのフォルダ選び直し（取り違え）が不要です。

```powershell
.\scripts\build-dev.ps1              # chrome のみ（既定）
.\scripts\build-dev.ps1 -Target all  # chrome + firefox
```

- 初回のみ: `chrome://extensions/` →「パッケージ化されていない拡張機能を読み込む」→ `dist/dev/chrome` を選択
- Firefox: `about:debugging#/runtime/this-firefox` から `dist/dev/firefox/manifest.json` を一時的なアドオンとして読み込む
- 出力先 `dist/` は Git 管理外（ストア提出用パッケージは `package-release.ps1`）

## 方針

- YouTube Data API と API キーは使いません。
- プレイリストの所有者データは変更しません。
- ページ内 DOM と各動画ページ HTML から投稿日を取得します。
- YouTube 本体の内部キューは変更せず、表示DOMと拡張側の次動画制御で投稿日順を実現します。
- 並び替え結果は playlist ID 単位で保存し、同じプレイリストの再生画面へ移動したときに復元します。
- 表示言語は拡張全体の設定として保存します。
- パネルの最小化状態は保存し、再読み込み後も維持します。

## 検証

```powershell
node .\verify-date-sorter.mjs
```

## リリースパッケージ

Chrome と Firefox のリリースは `manifests/chrome.json` と `manifests/firefox.json` で別々に管理します。配布時は `extension/` の中身と対象 manifest を組み合わせます。

```powershell
.\scripts\package-release.ps1 -Target chrome
.\scripts\package-release.ps1 -Target firefox
.\scripts\package-release.ps1 -Target all
```

生成物は `dist/<target>/` に出力され、Git には含めません。

## ライセンス

MIT
