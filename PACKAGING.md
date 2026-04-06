Packaging CINESTREAM for Windows (Installer with bundled VLC)

Overview
- This project uses electron-builder and Vite to build the renderer and package the Electron app.
- The repository already supports bundling a portable VLC copy under `resources/vlc/` and will include it in the installer so the app can launch the bundled VLC copy.

Quick steps (recommended)
1. Ensure you have Node.js, npm, and the Visual Studio build tools (for native deps) installed.
2. Install dependencies:
   npm install

3. Provide/bundle VLC:
   - Option A (automatic from system): If VLC is installed in "C:\\Program Files\\VideoLAN\\VLC", run:
       npm run bundle-vlc
     The script will copy VLC files into `resources/vlc/`.
   - Option B (portable): Download a VLC portable build and place the extracted folder contents into `resources/vlc/` (so that `resources/vlc/vlc.exe` exists).

4. Build and package the app (creates an NSIS installer in `dist/`):
   npm run dist-with-vlc

What the build includes
- Renderer assets (the Vite `dist/` folder) are packaged via the existing build pipeline.
- Public/static assets under `public/` and `src/assets/` are included in the installer (see `build.files` in package.json).
- The `resources/vlc` folder will be copied into the installed app resources and will be found at runtime by the app (the main process checks `process.resourcesPath/vlc/vlc.exe`).

Notes & licensing
- VLC is released under the GPL; if you redistribute VLC with your app you are responsible for complying with VLC licensing terms (include COPYING, etc.). Consider adding `vlc/COPYING` into the resources if you bundle VLC.
- The bundling script is conservative: it will copy from a standard program-files location or create a placeholder README if it doesn't find VLC.

Advanced
- To change installer options (one-click vs. per-machine, icons, signing), edit the `build.nsis` and `build.win` sections in `package.json`.
- To produce portable zips instead of an NSIS installer, you can run:
    electron-builder --win portable

If you want, I can:
- Add an automated step to download the official portable VLC and verify checksums (requires selection of a VLC version).
- Add the VLC license files automatically into `resources/vlc/` when bundling.

Let me know if you'd like me to add the automatic VLC download or include license copy automation.