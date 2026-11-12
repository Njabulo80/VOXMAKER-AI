# VOXMAKER AI

**Your voice. Your music.**

An Android-first, installable music studio built around preserving the singer's original lead vocal.

## Current foundation
- Mobile-first studio interface and song metadata (title, genre and theme)
- Browser microphone recording with microphone processing disabled where supported
- Live waveform visualisation while recording
- Multiple vocal takes saved locally in IndexedDB on the device/browser
- Playback and download of the original recorded audio
- WAV export by decoding the original recording and writing PCM WAV locally
- Basic browser-side pitch estimation (median frequency, nearest note and approximate 10th–90th percentile note range)
- PWA manifest and offline application shell

## Important limitations
This is a recording and early analysis foundation, **not yet a complete AI music generator**.
- Pitch estimation is a lightweight autocorrelation experiment; it can be affected by noise, vibrato, harmonics and polyphonic/background sound. It is not a reliable transcription or key detector.
- Tempo/rhythm extraction is not yet implemented.
- AI instrumental composition, vocal-to-band synchronisation, optional harmonies, mixing/mastering and finished-song generation are not connected.
- MP3 encoding is not included. Original browser recording is kept in its browser-supported format; WAV export is generated locally.
- IndexedDB recordings are stored only in the current browser profile on this device. Clearing browser site data can delete them. Download backups you want to keep.

## Privacy and product principles
- The original vocal remains the lead and is never replaced by an AI singer in this app.
- Recording and pitch analysis happen locally in the browser. No recording upload or external AI API is used by this build.
- Pitch correction and generated backing harmonies must remain optional.
- Singing and humming are both valid inputs.
- Provider pricing, licensing, privacy and latency must be reviewed before any external generation service is connected.

## Run and install
Serve the repository over HTTPS or localhost, then open it in a modern Android browser such as Chrome. Microphone access requires a secure context and user permission. For Android installation, deploy with GitHub Pages, open the HTTPS site in Chrome and choose Install app or Add to Home screen when offered.

## Next milestones
1. Improve melody, timing and tempo analysis with confidence reporting.
2. Evaluate affordable/licensed AI instrumental generation that accepts or follows a reference vocal.
3. Arrange instruments around the untouched original vocal and synchronise the backing.
4. Add optional harmony layers and local/export mixing controls.
5. Validate Android performance and prepare a tested APK workflow.

Do not claim full AI production, live deployment or APK availability until each has actually been built and verified.
