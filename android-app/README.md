# THEORA Android app

This is a native Kotlin/Jetpack Compose Android client for the Cinema/THEORA app.

## Open in Android Studio

Open the `android-app` folder. Android Studio will sync the Gradle project and install
the required Android SDK components.

Copy `gradle.properties.example` to `gradle.properties` and provide a TMDB key.
The real `gradle.properties` file is ignored by Git so the key is not committed:

```properties
TMDB_API_KEY=your_tmdb_api_key
```

The app currently provides a native dark-themed home screen with trending titles,
TMDB search, poster loading, and error/offline states. The desktop Electron/VLC
implementation is unchanged. Android local-file playback should be added with the
Storage Access Framework and Media3 rather than bundling VLC.
