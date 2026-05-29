# YouTube Playlist Date Sorter

A browser extension for watching YouTube playlists in video publish-date order.

It reads the visible playlist items, fetches each video's publish date, and sorts the on-page list from oldest to newest or newest to oldest. It does not modify the saved order of the playlist itself. The extension only controls the visible page order and the destination used by its "Next video" action.

## Features

- Works on YouTube playlist pages and playlist watch pages
- Switch between oldest first, newest first, and YouTube's default order
- Jump to the next video in publish-date order
- Toggle automatic navigation
- Switch the extension UI between Japanese and English
- No YouTube Data API key required

## Notes

- Only playlist items loaded in the page DOM are included.
- YouTube layout changes may temporarily affect date detection or sorting.
- This extension is not an official YouTube feature.
