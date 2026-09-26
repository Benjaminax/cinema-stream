# Splash Screen, Account Profiles, Watch History Personalization & UI Fixes Plan

This plan details implementing a Netflix-style startup splash screen, Account/Profile selection, Watch History tracking with smart recommendations ("Continue Watching"), hero banner layout fixes (preventing text/button overlap), and rich Netflix-style genre rows.

## User Review Required

> [!IMPORTANT]
> - **Splash Screen**: Animated red THEORA logo splash screen on startup.
> - **Account / Profile Section**: Top bar profile avatar opening a Netflix-style profile & account management sheet.
> - **Watch History & Personalization**: Tracking watched items to build a "Continue Watching" row and tailor recommendations based on liked/watched genres.
> - **Hero Banner UI Fixes**: Repositioning badges and text above action buttons to fix overlapping.
> - **Genre Rows**: Adding dedicated genre-specific rows on Home.

## Proposed Changes

### ViewModel (`[TheoraViewModel.kt](file:///C:/Users/kojob/OneDrive/Documents/GitHub/cinema-stream/android-app/app/src/main/java/com/theora/android/ui/TheoraViewModel.kt)`)

#### [MODIFY] [TheoraViewModel.kt](file:///C:/Users/kojob/OneDrive/Documents/GitHub/cinema-stream/android-app/app/src/main/java/com/theora/android/ui/TheoraViewModel.kt)
- Add Watch History persistence in SharedPreferences.
- Add `continueWatching` and genre-tailored recommendation rows.
- Add Profile management state.

### UI & Screens (`[MainActivity.kt](file:///C:/Users/kojob/OneDrive/Documents/GitHub/cinema-stream/android-app/app/src/main/java/com/theora/android/MainActivity.kt)` & `[Screens.kt](file:///C:/Users/kojob/OneDrive/Documents/GitHub/cinema-stream/android-app/app/src/main/java/com/theora/android/ui/Screens.kt)`)

#### [MODIFY] [MainActivity.kt](file:///C:/Users/kojob/OneDrive/Documents/GitHub/cinema-stream/android-app/app/src/main/java/com/theora/android/MainActivity.kt)
- Add Splash screen composable before loading main app content.

#### [MODIFY] [Screens.kt](file:///C:/Users/kojob/OneDrive/Documents/GitHub/cinema-stream/android-app/app/src/main/java/com/theora/android/ui/Screens.kt)
- **Account Dialog / Sheet**: Profile switching and watch history viewer.
- **HeroBannerPage**: Clean layout fixing badge/button overlaps.
- **HomeScreen**: Include "Continue Watching" and personalized genre rows.

## Verification Plan

### Automated Tests
- Build verification using `./gradlew assembleDebug` to ensure compilation success.
