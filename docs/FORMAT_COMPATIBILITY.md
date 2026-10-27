# Nova Player — Format & Codec Compatibility Matrix

This document defines the media compatibility matrix, container support, codec decoders, and playback capabilities for Nova Player across Android and iOS platforms.

> **Important Guarantee Disclaimer:** Playback depends on container structure, audio/video codecs, hardware vs. software decoder availability, DRM protection, file integrity, and device capabilities. Unsupported media is detected and surfaced with actionable diagnostic feedback.

---

## 1. Container Formats

| Container | Extension(s) | Android (Media3 / VLC) | iOS (AVFoundation / VLC) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **MP4** | `.mp4`, `.m4v` | Native Hardware / Full | Native Hardware / Full | Primary format for streaming and local recording. |
| **MKV** | `.mkv` | Full (Media3 Ext / VLC) | Supported (VLC / Ext) | Multiple subtitle & audio track switching supported. |
| **WebM** | `.webm` | Full (VP8/VP9/AV1) | Supported (VP8/VP9/AV1) | Standard web container with Vorbis / Opus audio. |
| **AVI** | `.avi` | Full (VLC / Software) | Supported (VLC / Software) | Legacy container; seek indices verified on open. |
| **MOV** | `.mov` | Full | Native Hardware / Full | Apple QuickTime format; ProRes where supported. |
| **MPEG-TS**| `.ts`, `.mts` | Full | Supported | Transport stream; variable audio timestamps handled. |
| **3GP** | `.3gp` | Full | Limited | Legacy mobile container. |
| **FLV** | `.flv` | Supported (VLC) | Supported (VLC) | Flash video container. |

---

## 2. Video Codecs & Hardware Acceleration

| Codec | Profile / Details | Android Hardware | iOS Hardware | Fallback / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **H.264 / AVC** | Baseline, Main, High (up to 4K) | Yes (MediaCodec) | Yes (VideoToolbox) | Universal playback across all devices. |
| **H.265 / HEVC** | Main, Main 10 (HDR10, HLG) | Yes (Android 5.0+) | Yes (A9+ chips) | 10-bit color profile supported on modern SoC. |
| **VP8** | Standard | Yes / Software | Software / WebKit | Standard WebM video. |
| **VP9** | Profile 0, Profile 2 (HDR) | Yes (Android 7.0+) | Yes (iOS 14+) | YouTube / open web standard. |
| **AV1** | Main profile | Yes (Android 10+ SoC) | Yes (A17 Pro+ / M3+) | High-efficiency modern open codec; software fallback. |
| **MPEG-4 Part 2**| Simple, Advanced Simple | Yes / Software | Software | DivX/Xvid legacy files. |

---

## 3. Audio Codecs & Channel Configurations

| Audio Codec | Channels | Android Support | iOS Support | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **AAC** (LC, HE-AAC) | Up to 7.1 | Full Hardware | Full Hardware | Default standard audio format. |
| **MP3** | Stereo | Full Hardware | Full Hardware | Legacy audio format. |
| **Opus** | Up to 7.1 | Full Native | Full Native | Low latency, high fidelity. |
| **Vorbis** | Stereo / 5.1 | Full Native | Full Native | Standard Ogg / WebM audio. |
| **FLAC** | Up to 24-bit/192kHz | Full Native | Full Native | Lossless audio format. |
| **WAV / PCM** | 16-bit, 24-bit, 32-bit | Full Native | Full Native | Uncompressed PCM. |
| **AC-3 / E-AC-3** | Dolby Digital / Plus 5.1 | Device-dependent | Native | Downmixed to stereo when multichannel unsupported. |

---

## 4. Subtitle Formats & Synchronization

| Format | Type | Styling Support | Sync Delay Adjustment |
| :--- | :--- | :--- | :--- |
| **SRT (SubRip)** | External & Embedded | Font size, color, background, outline | ±10 seconds in 100ms steps |
| **WebVTT** | External & Embedded | CSS styling, cues, position | ±10 seconds in 100ms steps |
| **ASS / SSA** | External & Embedded | Advanced styles, positions, colors | Supported with custom renderer |
| **Embedded Text** | MKV / MP4 tracks | Configurable styling overlay | Synchronized with video clock |

---

## 5. Playback Features & Capability Matrix

| Feature | Android Media3 | VLC Adapter | iOS AVFoundation |
| :--- | :--- | :--- | :--- |
| Background Audio | Supported | Supported | Supported (Audio session active) |
| Picture-in-Picture (PiP) | Supported (Android 8.0+) | Supported | Supported (iOS 14.0+) |
| Speed Adjustment | 0.25x – 2.0x | 0.25x – 4.0x | 0.5x – 2.0x |
| Aspect Ratio Modes | Fit, Fill/Crop, Stretch, 16:9, 4:3 | Fit, Fill, Stretch, Original | Fit, Fill, Stretch |
| Audio Delay Control | ±5000 ms | ±5000 ms | Supported |
| Swipe Brightness & Volume | Built-in Gesture Overlay | Built-in Gesture Overlay | Built-in Gesture Overlay |
| Lock Controls | Touch Screen Lock | Touch Screen Lock | Touch Screen Lock |
| Double Tap to Seek | ±10s (Configurable: 5s, 10s, 15s, 30s) | Configurable | Configurable |
| Resume from Last Position | Millisecond accurate, persisted in SQLite | Persisted in SQLite | Persisted in SQLite |
