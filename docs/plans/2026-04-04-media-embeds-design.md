# Media & Embed Support

## Slash Menu
Two groups with divider: "Basic blocks" (existing) and "Media" (new: Image, Video, Audio, Embed URL).

## Storage
Files copied to `<core>/media/<timestamp>-<hash8>.<ext>`. Directory auto-created on first upload.

## Markdown Syntax
- Images: `![](media/file.png)` — standard
- Video: `![video](media/file.mp4)` — alt text signals type
- Audio: `![audio](media/file.mp3)` — alt text signals type
- Embed: `[embed](https://url)` — link text signals embed

## Editor Nodes
- VideoBlock: `<video controls>` with rounded corners
- AudioBlock: `<audio controls>` full-width styled bar
- EmbedBlock: iframe for known providers (YouTube, Vimeo, Twitter, Spotify, SoundCloud), OG link card for others

## Upload Flow
- Slash menu commands open OS file picker
- Drag-and-drop onto editor auto-detects type
- Both copy file to media/, insert node at cursor/drop position

## URL Embed Detection
Known providers get iframe with URL transformation:
- youtube.com/watch?v=ID → youtube.com/embed/ID
- vimeo.com/ID → player.vimeo.com/video/ID
- twitter.com/user/status/ID → platform.twitter.com/embed
- open.spotify.com/track/ID → open.spotify.com/embed/track/ID
