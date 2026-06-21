# v0.2.2 Store Release Text

## 日本語版の変更内容

YouTube の現行プレイリスト表示への対応と、自動移動の安定性を改善しました。

- 新しいプレイリスト画面で動画項目を検出できない問題を修正
- 並び替え番号だけが表示され、動画の見た目順が変わらない問題を修正
- 並び替えバッジを小さく調整
- 自動移動の初期状態を ON に変更
- 自動移動の ON / OFF 設定を保存し、次の動画への移動後やページ再読み込み後も維持
- 表示言語を変更した場合も自動移動設定を維持

## English Version Notes

Improved compatibility with YouTube's current playlist layout and automatic navigation stability.

- Fixed playlist item detection on the current YouTube playlist page
- Fixed an issue where order badges changed but the visible video order did not
- Reduced the sort badge size
- Automatic navigation is now ON by default
- The ON/OFF setting is saved across video navigation and page reloads
- Changing the extension language no longer resets the automatic navigation setting

## Chrome Web Store Reviewer Notes

Version 0.2.2 updates playlist-page compatibility and automatic navigation preference handling.

Changes:
- Supports the current `yt-lockup-view-model` playlist layout.
- Sorts the current playlist layout with CSS visual order so YouTube re-rendering does not restore the native visible order.
- Reduces the sort badge size and places it within the metadata text area.
- Automatic navigation now defaults to ON.
- The ON/OFF preference is stored in `chrome.storage.local`.
- The preference is preserved when navigating to the next video, reloading the page, or changing the extension language.

No new permissions, host access, remote code, network endpoints, or data collection were added. The existing `storage` permission stores extension settings and playlist sort results locally.

Test steps:
1. Open a YouTube playlist URL containing a `list` parameter.
2. Select title ascending order and click the sort button. Confirm the visible rows and order badges use the same order.
3. Select YouTube's normal order and confirm the native visible order is restored.
4. Open a playlist watch URL containing both `v` and `list` parameters.
5. Confirm the extension panel shows automatic navigation as ON on a fresh install or after clearing extension storage.
6. Toggle automatic navigation OFF and reload the page. Confirm it remains OFF.
7. Toggle it ON, move to the next playlist video, and confirm it remains ON.
8. Change the extension UI language from the toolbar popup and confirm the automatic navigation state is unchanged.

## Firefox Add-ons Reviewer Notes

Version 0.2.2 updates playlist-page compatibility and automatic navigation preference handling.

- Supports YouTube's current playlist item layout.
- Keeps the visible playlist sorted without modifying the saved playlist order.
- Uses smaller order badges in the metadata area.
- Automatic navigation now defaults to ON.
- Its ON/OFF preference is stored locally and persists across video navigation, page reloads, and extension language changes.
- No new permissions, host access, remote code, network endpoints, or data collection were added.
- The existing storage permission is used only for extension settings and playlist sort results.

Test steps:
1. Load the extension and open a YouTube playlist URL containing `list`.
2. Select title ascending order, run the sort, and confirm visible rows match the order badges.
3. Select YouTube's normal order and confirm the native visible order returns.
4. Open a playlist watch URL containing both `v` and `list`.
5. Confirm automatic navigation is ON when no saved setting exists.
6. Toggle it OFF, reload, and confirm it remains OFF.
7. Toggle it ON, navigate to another playlist video, and confirm it remains ON.
8. Change the extension language and confirm the state is preserved.
