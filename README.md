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
- Browser-side YIN-style pitch tracking in a separate, unit-tested audio-analysis module (median frequency, nearest note, 10th–90th percentile range, voiced coverage and pitch-quality estimate)
- Approximate melody-note events with timestamps, durations and a visual note-contour timeline
- Experimental vocal-energy rhythm/tempo estimate with a confidence indicator
- Soulful vocal-piano direction with intimate worship, tender and uplifting moods; synthetic piano-like accompaniment, warm atmosphere, adjustable vocal/piano/pad levels and room reverb; optional manual BPM and piano-key selection
- Experimental note-contour following: detected vocal note events can trigger quiet piano harmony notes at their detected timestamps, alongside the chord bed
- Reopen any saved take into the studio with its original audio, song title, genre, theme and analysis restored
- Save edited project title, genre and theme back to the selected take without altering its recorded vocal
- Per-take delete control in the saved library, with confirmation before local deletion
- Mixed WAV and untouched original-vocal exports remain separate
- PWA manifest and offline application shell

## Important limitations
This is a recording and early analysis foundation, **not yet a complete AI music generator**.
- Pitch analysis is an inexpensive YIN-style periodicity estimate, not a neural transcription model. It can misread harmonics, vibrato, breathy singing, chords and noisy recordings. The contour is an approximate guide rather than sheet music or a guaranteed melody transcription.
- Pitch estimation is a lightweight autocorrelation experiment; it can be affected by noise, vibrato, harmonics and polyphonic/background sound. It is not a reliable transcription or key detector.
- Tempo estimation is now experimental and based on vocal-energy peaks; it can mistake syllables or noise for beats and should not be treated as a reliable metronome or tempo detector.
- The spiritual backing stage is a locally rendered synthetic piano-like demo, not sampled acoustic piano or AI composition. The backing render is automatically triggered after a take is analysed and saved. The vocal and backing are rendered from the same zero-time origin and duration. When the lightweight pitch detector finds stable notes, a quiet piano harmony line follows detected note events at their estimated timestamps. This is experimental note-contour following, not perfect transcription or guaranteed musical synchronization: unvoiced sections, vibrato, overlapping notes and pitch errors can cause missed or incorrect notes. The chord progression remains a fixed soulful progression based on a simple pitch estimate or selected key. Reverb is a simple generated room effect. AI instrumental composition, vocal-aware arrangement, optional harmony layers, professional mixing/mastering and finished-song generation are not connected.
- MP3 encoding is not included. Original browser recording is kept in its browser-supported format; WAV export is generated locally.
- IndexedDB recordings are stored only in the current browser profile on this device. Clearing browser site data can delete them. Download backups you want to keep.

## Privacy and product principles
- The original vocal remains the lead and is never replaced by an AI singer in this app.
- Recording and pitch analysis happen locally in the browser. No recording upload or external AI API is used by this build.
- Pitch correction and generated backing harmonies must remain optional.
- Singing and humming are both valid inputs.
- Provider pricing, licensing, privacy and latency must be reviewed before any external generation service is connected.

## Development checks
Run `npm test` to exercise the audio-analysis module against synthetic tones, silence, a two-note contour, a regular pulse and common 48 kHz audio. Run `node --check app.js` and `node --check audio-analysis.js` for syntax checks.

## Run and install
Serve the repository over HTTPS or localhost, then open it in a modern Android browser such as Chrome. Microphone access requires a secure context and user permission. For Android installation, deploy with GitHub Pages, open the HTTPS site in Chrome and choose Install app or Add to Home screen when offered.

## Next milestones
1. Improve melody, timing and tempo analysis with confidence reporting and real-world singing tests on Android.
2. Evaluate affordable/licensed AI instrumental generation that accepts or follows a reference vocal.
3. Improve backing generation and arrangement controls, then evaluate vocal-aware synchronisation around the untouched original vocal.
4. Improve vocal note tracking, chord adaptation and phrase-aware accompaniment; add optional harmony layers and improved local/export mixing controls.
5. Evaluate a consent-based talking-photo/lip-sync workflow; this requires a suitable external video-generation service and separate privacy, licensing and cost review.
6. Validate Android performance, microphone permissions and APK installation on a real phone.

Do not claim full AI production, live deployment or APK availability until each has actually been built and verified.
