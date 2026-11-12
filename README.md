# VOXMAKER AI

**Your voice. Your music.**

An Android-first installable music studio built around preserving the singer's original lead vocal.

## First foundation build
- Mobile-first studio interface
- Song title, genre direction and song-theme fields
- Browser microphone recording with MediaRecorder
- Original vocal playback and download
- PWA manifest and offline application shell

## Honest implementation status
This foundation currently captures, plays back and downloads the original vocal. It is not yet a full AI music generator. The following systems still need to be integrated and tested:
1. Vocal pitch, melody, tempo and timing analysis
2. AI instrumental composition and arrangement
3. Vocal-to-band synchronisation
4. Optional harmony generation while retaining the original lead vocal
5. Mixing, mastering and MP3/WAV export

These capabilities require dedicated audio-processing and music-generation services. Provider cost, licensing, privacy and latency must be assessed before choosing integrations.

## Run and install
Serve the repository over HTTPS or localhost, then open it in a modern browser. Microphone access requires a secure context and user permission. For Android installation, deploy with GitHub Pages, open the HTTPS site in Chrome and choose Install app or Add to Home screen when offered.

## Product principles
- Original voice remains the lead vocal.
- Pitch correction and AI harmonies are optional.
- Singing and humming are both valid starting inputs.
- Users control title, genre, lyrics and arrangement.
- Never claim a fully AI-produced song until generation and synchronisation are connected.