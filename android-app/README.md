# THEORA Mobile Android App

A native Kotlin & Jetpack Compose Android client for **THEORA (Cinema Stream)**. Built with modern Material 3 dark cinema aesthetics matching the desktop application, with a streamlined mobile focus.

---

## Features

- **Dark Cinema Aesthetic**: Matches THEORA's ruby-red (`#E50914`) and deep obsidian theme with glowing card borders and gradient overlays.
- **Hero Featured Carousel**: Featured trending movie/show banner with quick trailer preview and details.
- **Discover Movies & Series**:
  - Trending, Popular, and Top-Rated rows on the Home screen.
  - Dedicated **Films** screen with genre filters (Action, Adventure, Sci-Fi, Horror, Comedy, Drama, Thriller).
  - Dedicated **Series** screen with genre filters (Action & Adventure, Crime, Drama, Sci-Fi & Fantasy, Mystery).
- **Search Catalog**: Real-time search across TMDB's movie and TV show library with filter chips.
- **Rich Media Details Sheet**:
  - Full backdrop, rating, release year, runtime/seasons, certification, and genre tags.
  - Interactive **Season & Episode selector** with episode thumbnails and summaries.
  - Top Cast with avatars.
  - Recommended similar titles.
- **Watch Trailers**:
  - In-app embedded YouTube player dialog.
  - Fallback button to launch directly into the official YouTube app.
- **Stream Movies & Episodes**:
  - In-app fullscreen stream web player with hardware acceleration.
  - Direct season/episode streaming integration for TV shows.
  - Alternative web stream source search button.
- **Watchlist (My List)**:
  - Save favorite titles offline using local persistent storage.
- **Omitted Desktop Features**:
  - As requested, no local file sorting, no duplicate scanner, and no local disk file management; pure cloud/TMDB media discovery.

---

## Project Structure

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/theora/android/
│   │   │   ├── MainActivity.kt               # Root Activity with edge-to-edge Compose
│   │   │   ├── data/
│   │   │   │   └── TmdbApi.kt                # Retrofit client, TMDB models & endpoints
│   │   │   └── ui/
│   │   │       ├── TheoraViewModel.kt        # State management (Home, Search, Details, Players, Watchlist)
│   │   │       └── Screens.kt                # Compose UI (Home, Movies, Series, Search, Details, Trailer/Stream Dialogs)
│   │   └── res/
│   │       └── values/
│   │           ├── colors.xml
│   │           ├── strings.xml
│   │           └── styles.xml
│   └── build.gradle.kts                      # Dependencies (Compose BOM, Retrofit, Coil, WebKit)
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties                         # Configured with TMDB API key
└── local.properties                          # Configured with local Android SDK path
```

---

## Running the App

### Option 1: Android Studio
1. Open the `android-app` folder in Android Studio.
2. Android Studio will automatically recognize the project and sync Gradle.
3. Select an emulator or connected physical Android device and click **Run** (`Shift + F10`).

### Option 2: Command Line
```powershell
cd android-app
.\gradlew assembleDebug
```
The output APK will be generated at:
`app/build/outputs/apk/debug/app-debug.apk`

> **Note on Disk Space**: Building with Gradle requires at least 2–3 GB of free space on your system drive `C:` for Gradle dependencies and Android build caches.
