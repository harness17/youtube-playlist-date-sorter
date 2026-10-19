# v0.2.3 Store Release Text

## 日本語版の変更内容

自動移動の動作を安定させました。

- 並び替え後の自動移動で、YouTube 標準の自動再生と重なって動画が飛ばされたり、同じ動画が開き直されたりする問題を修正
- 自動移動は並び替えを適用したときだけ動作するように変更（未並び替えのときは YouTube 標準の順で再生）
- 広告の再生中は自動移動・終了前の一時停止を行わないように修正
- 配信中のライブ動画では自動移動・終了前の一時停止を行わないように修正

## English Version Notes

Improved automatic navigation stability.

- Fixed an issue where a sorted playlist could skip a video or reopen the same video because YouTube's own autoplay raced the extension
- Automatic navigation now runs only after a sort is applied; unsorted playlists keep YouTube's normal order
- Automatic navigation and the pause before the end no longer trigger during ads
- Automatic navigation and the pause before the end no longer trigger during live streams

## Chrome Web Store Reviewer Notes

Version 0.2.3 fixes automatic navigation timing on playlist watch pages.

Changes:
- With a sort applied and automatic navigation ON, the extension pauses the video 1.5 seconds before the end and opens the next video in the sorted order, so YouTube's native autoplay no longer races it.
- Automatic navigation runs only when a sort has been applied.
- Advance and pause logic is skipped while an ad is showing or while a live stream is playing.

No new permissions, host access, remote code, network endpoints, or data collection were added. The existing `storage` permission stores extension settings and playlist sort results locally.

Test steps:
1. Open a YouTube playlist watch URL containing both `v` and `list` parameters.
2. Select newest-first order and click the sort button.
3. With automatic navigation ON, seek to a few seconds before the end of the video.
4. Confirm the next video in the sorted order opens exactly once, without skipping a video.
5. Select YouTube's normal order and confirm playback at the end follows YouTube's own playlist order.
6. Turn automatic navigation OFF and confirm the video pauses just before the end.

## Firefox Add-ons Reviewer Notes

Version 0.2.3 fixes automatic navigation timing on playlist watch pages.

- With a sort applied and automatic navigation ON, the video pauses 1.5 seconds before the end and the next video in the sorted order opens, so YouTube's native autoplay no longer races it.
- Automatic navigation runs only when a sort has been applied.
- Advance and pause logic is skipped during ads and live streams.
- No new permissions, host access, remote code, network endpoints, or data collection were added.
- The existing storage permission is used only for extension settings and playlist sort results.

Test steps:
1. Open a playlist watch URL containing both `v` and `list`.
2. Select newest-first order and run the sort.
3. With automatic navigation ON, seek near the end and confirm the next sorted video opens exactly once.
4. Select YouTube's normal order and confirm YouTube's own order is followed at the end.
5. Turn automatic navigation OFF and confirm the video pauses just before the end.
