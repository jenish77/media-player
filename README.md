# Nova Player 🎬

> A production-grade, offline-first video player application built with React Native, TypeScript, Expo Prebuild (Media3 / AVFoundation), SQLite with migrations, and a typed playback adapter abstraction.

---

## 🌟 Architecture & Highlights

Nova Player is built to deliver resilient, hardware-accelerated playback across Android and iOS devices, strictly following the engineering guidelines defined in [plan (1).md](file:///d:/video-player/plan%20(1).md).

### Key Architectural Pillars

1. **Typed `PlayerAdapter` Pattern**:
   - Isolates the UI and navigation layer from low-level native playback engines.
   - Standardized state machine: `idle` ➔ `loading` ➔ `ready` ➔ `playing` ➔ `paused` ➔ `buffering` ➔ `completed` ➔ `recoverableError` / `fatalError` ➔ `disposed`.
   - Built-in session token management to discard stale events from superseded sources.
   - Provides concrete implementations: `ExpoVideoAdapter` (Media3 on Android / AVPlayer on iOS) and `MockPlayerAdapter` (for deterministic unit/integration testing).

2. **Offline-First SQLite Database**:
   - Local database schema with versioning and migrations.
   - Entities: `media_items`, `playback_preferences`, `playlists`, `playlist_items`, `app_settings`.
   - Performance optimized with dedicated indexes on `last_played_at`, `is_favorite`, `folder_name`, and `availability_status`.

3. **Throttled Playback Persistence**:
   - High-frequency playback progress callbacks are throttled (persisted at most once every 2.5s) to avoid UI drops and database contention.
   - Immediate saves on pause, source transition, and app backgrounding.
   - Smart resume threshold logic:
     - Watched `< 5 seconds`: restarts from beginning.
     - Watched `> 95%`: restarts from beginning.
     - Watched `5s – 95%`: automatically prompts / resumes from last position.

4. **Multi-Track Audio & Subtitle Engine**:
   - Embedded audio and subtitle track enumeration and switching.
   - Custom SRT and WebVTT external subtitle parser with tag stripping (`<b>`, `<i>`, `<font>`) and cue synchronization.
   - Fine-grained subtitle sync delay adjustment (`±10 seconds` in `100ms` steps).
   - Audio delay synchronization adjustment (`±5 seconds`).

5. **Advanced Gesture Overlay**:
   - Single tap: toggle overlay controls with auto-hide timer.
   - Double tap left / right: seek backward / forward by configurable interval (10s default).
   - Vertical swipe (left side): screen brightness adjustment.
   - Vertical swipe (right side): media volume adjustment.
   - Touch screen lock: locks all screen touches with clear unlock prompt.

---

## 📁 Repository Structure

```text
nova-player/
├── android/                         # Generated native Android project (Media3 / Kotlin)
├── docs/
│   ├── FORMAT_COMPATIBILITY.md     # Codec & container compatibility matrix
│   ├── LICENSES.md                 # Open source software & codec notices
│   └── RELEASE_CHECKLIST.md        # Store submission & privacy release checklist
├── src/
│   ├── app/
│   │   ├── navigation/
│   │   │   └── AppNavigator.tsx    # Bottom tabs & stack navigators
│   │   └── providers/
│   │       └── AppProvider.tsx     # DB init, settings load & lifecycle handlers
│   ├── components/
│   │   ├── EmptyState.tsx          # Resilient empty views for library/search/folders
│   │   ├── ErrorState.tsx          # Diagnostic error overlay with retry actions
│   │   ├── GestureOverlay.tsx      # Double-tap seek, edge swipes & touch lock
│   │   ├── PlayerControls.tsx      # Transport, seekbar, speed, aspect ratio controls
│   │   ├── SeekBar.tsx             # Scrubbable timeline with buffer & played progress
│   │   ├── SubtitleOverlay.tsx     # Real-time subtitle cue renderer with delay sync
│   │   └── VideoCard.tsx           # Video card for list and grid layouts with progress
│   ├── features/
│   │   ├── folders/
│   │   │   └── FoldersScreen.tsx   # Folder directory browser & filtered views
│   │   ├── history/
│   │   │   └── HistoryScreen.tsx   # Watch history with resume, restart, and clear
│   │   ├── library/
│   │   │   └── LibraryScreen.tsx   # Continue watching carousel, search, sort, scan
│   │   ├── playback/
│   │   │   └── PlayerScreen.tsx    # Immersive video player surface
│   │   ├── playlists/
│   │   │   └── PlaylistsScreen.tsx # Custom playlist management & queue playback
│   │   ├── premium/
│   │   │   └── PremiumScreen.tsx   # Pro tier showcase & store billing integration
│   │   ├── settings/
│   │   │   └── SettingsScreen.tsx  # Playback defaults, gesture toggles & maintenance
│   │   └── subtitles/
│   │       └── SubtitleAudioBottomSheet.tsx # Track selection & sync delay offset sheet
│   ├── native/
│   │   └── player/
│   │       ├── BasePlayerAdapter.ts# Base adapter with state machine & listeners
│   │       ├── capabilities.ts     # Platform capability detection
│   │       ├── ExpoVideoAdapter.ts # Native Media3/AVPlayer adapter
│   │       ├── MockPlayerAdapter.ts# Test adapter for headless execution
│   │       ├── PlayerAdapter.ts    # Adapter factory
│   │       └── playerTypes.ts      # Typed IPlayerAdapter interface
│   ├── services/
│   │   ├── database/
│   │   │   ├── db.ts               # Database connection manager with in-memory test fallback
│   │   │   ├── mediaRepository.ts  # Media queries, favorites, history, continue watching
│   │   │   ├── playlistRepository.ts # Playlist CRUD & item queries
│   │   │   ├── schema.ts           # SQLite DDL schema & indexes
│   │   │   └── settingsRepository.ts # App settings persistence
│   │   ├── mediaDiscovery/
│   │   │   └── mediaDiscoveryService.ts # Android MediaStore & SAF DocumentPicker
│   │   ├── playbackPersistence.ts  # Throttled progress writer
│   │   └── thumbnailService.ts     # Thumbnail cache & fallback resolver
│   ├── store/
│   │   ├── useLibraryStore.ts      # Videos, search query, sorting, and layout state
│   │   ├── usePlaybackStore.ts     # Player state machine, media session, tracks, and lock
│   │   ├── usePlaylistStore.ts     # Playlists and active playlist items
│   │   └── useSettingsStore.ts     # User preferences store
│   ├── theme/
│   │   ├── colors.ts               # Slate dark/light palette with cyan/indigo brand accents
│   │   ├── spacing.ts              # Spacing & border radii tokens
│   │   └── typography.ts           # Mobile typography hierarchy
│   ├── types/
│   │   ├── media.ts                # MediaItem, Playlist, AppSettings, AspectRatioMode
│   │   └── player.ts               # PlayerState, Tracks, SubtitleCue, PlaybackProgress
│   └── utils/
│       ├── edgeCaseHandlers.ts     # Zero-byte, threshold, clamp, debounce, throttle
│       ├── formatters.ts           # formatDuration, formatBytes, formatDate
│       ├── pathUtils.ts            # Filename, container, and folder extractors
│       └── subtitleParser.ts       # SRT & WebVTT parsers with delay synchronization
├── test/
│   ├── setupTests.ts               # Jest test setup and module mocks
│   ├── unit/
│   │   ├── edgeCaseHandlers.test.ts# Validation, resume thresholds, and bounds tests
│   │   ├── formatters.test.ts      # Duration, byte, and date formatting tests
│   │   ├── playbackStateMachine.test.ts # State transitions and session token tests
│   │   └── subtitleParser.test.ts  # SRT/VTT parsing and sync offset lookup tests
│   └── integration/
│       ├── database.test.ts        # SQLite migrations, CRUD, playlists, settings tests
│       ├── mediaDiscovery.test.ts  # Media scanning & document picker integration tests
│       └── playerAdapter.test.ts   # Player adapter & Zustand store integration tests
├── App.tsx                         # Root app entry point
├── app.json                        # Expo app manifest & permissions
├── package.json                    # Project configuration & scripts
└── tsconfig.json                   # TypeScript configuration
```

---

## 🛠️ CLI Commands & Development

### 1. Run Unit & Integration Tests
```bash
npm test
```
*Executes all 7 test suites (55 tests) across state transitions, subtitle parsers, edge case handlers, SQLite repositories, and playback adapters.*

### 2. Typecheck Codebase
```bash
npm run typecheck
```
*Validates TypeScript compilation with zero errors across the entire codebase.*

### 3. Start Development Server
```bash
npm start
```

### 4. Build & Run Native Android App
```bash
npm run android
```

---

## 🧪 Edge Cases Handled

- **0-Byte / Corrupted Files**: Handled before playback begins; shows diagnostic error card with code `ZERO_BYTE_FILE`.
- **Cloud-Only / Missing Media**: Marked with `cloud_only` or `missing` availability status and recovery suggestions.
- **Malformed Subtitles**: The SRT/WebVTT parser strips unclosed HTML tags, ignores invalid timestamps, and recovers without crashing.
- **Audio & Subtitle Sync**: Interactive ±10s subtitle delay and ±5s audio delay sliders directly in the bottom sheet.
- **Audio Interruption & Backgrounding**: App lifecycle listener pauses playback and immediately flushes watch progress to SQLite when the app backgrounds or is interrupted.
- **Rapid Seeking**: Throttled seeking and debounced progress prevents UI freezes and database lockups.
- **Screen Lock**: Full-surface gesture protection with an unlock prompt prevents accidental touches during movie watching.
