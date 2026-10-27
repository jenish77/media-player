# Nova Player — Production Release Checklist

## 1. Build and App Identity
- [x] Application name set to "Nova Player"
- [x] Package name configured: `com.novaplayer.app`
- [x] Android target SDK updated and compliant with Play Store requirements
- [x] iOS bundle identifier configured: `com.novaplayer.app`
- [x] Version and build numbers synchronized (`1.0.0`)
- [x] Release keystores / signing keys generated and secured

## 2. Privacy & Permissions
- [x] Android Scoped Storage / MediaStore API implemented (`READ_MEDIA_VIDEO`)
- [x] iOS Photos permission justification string provided in Info.plist
- [x] Storage Access Framework (SAF) used for external documents without requesting broad storage permissions
- [x] No personal data, filenames, or media content uploaded to external servers
- [x] Offline-first architecture fully functional without network connection

## 3. Media Playback & Engine
- [x] Typed `PlayerAdapter` abstraction separates engine from UI
- [x] Core playback functions verified: Play, Pause, Scrub, Seek, Speed, Aspect Ratio, Lock
- [x] Resuming playback from last persisted position (with threshold detection)
- [x] Subtitle parser (SRT/WebVTT) with real-time timecode sync and delay offset
- [x] Audio track selection and delay adjustment
- [x] Interruption handling: Audio focus loss, incoming calls, headphone disconnect

## 4. Edge Cases & Resilience
- [x] Corrupted / 0-byte video handling with descriptive user error and recovery
- [x] Missing or revoked media file handling with UI indicators
- [x] Rapid seeking, buffering, and throttling prevents UI freezes and DB lockups
- [x] Audio focus ducking and auto-pause on unplugging headphones
- [x] Safe area insets, notches, and landscape orientation transitions handled

## 5. Testing & Quality
- [x] Unit test suite passes for all state transitions, persistence, and subtitle parsers
- [x] Integration test suite passes for media library, search, folders, playlists, and settings
- [x] Zero critical lint or TypeScript compilation errors
