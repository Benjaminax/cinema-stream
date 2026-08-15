const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');

// VLC bundling script for Windows with auto-download fallback
class VLCBundler {
  constructor() {
    this.vlcSourcePath = path.join('C:', 'Program Files', 'VideoLAN', 'VLC');
    this.resourcesDir = path.join(__dirname, '..', 'resources');
    this.vlcDestPath = path.join(this.resourcesDir, 'vlc');
    this.tmpDir = path.join(__dirname, '..', 'tmp');
    // Default portable VLC zip URL (configurable via VLC_URL env)
    this.defaultVlcUrl = process.env.VLC_URL || 'https://get.videolan.org/vlc/3.0.18/win64/vlc-3.0.18-win64.zip';
    this.tmpZip = path.join(this.tmpDir, 'vlc.zip');
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async copyDirectory(source, destination) {
    await this.ensureDirectoryExists(destination);
    const items = await fs.promises.readdir(source, { withFileTypes: true });
    for (const item of items) {
      const sourcePath = path.join(source, item.name);
      const destPath = path.join(destination, item.name);
      if (item.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        try {
          await fs.promises.copyFile(sourcePath, destPath);
        } catch (err) {
          console.warn(`Warning: Could not copy ${sourcePath}: ${err.message}`);
        }
      }
    }
  }

  async downloadAndExtractVLC(vlcUrl) {
    await this.ensureDirectoryExists(this.tmpDir);
    console.log('Downloading VLC from', vlcUrl);

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(this.tmpZip);
      https.get(vlcUrl, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`Failed to download VLC: ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    });

    console.log('Extracting VLC zip to resources/vlc');
    const zip = new AdmZip(this.tmpZip);
    await this.ensureDirectoryExists(this.vlcDestPath);
    zip.extractAllTo(this.vlcDestPath, true);

    // Some zips include a top-level folder. If so, move contents up
    const entries = await fs.promises.readdir(this.vlcDestPath);
    if (entries.length === 1) {
      const single = path.join(this.vlcDestPath, entries[0]);
      try {
        const stat = await fs.promises.stat(single);
        if (stat.isDirectory()) {
          const innerItems = await fs.promises.readdir(single);
          for (const name of innerItems) {
            const src = path.join(single, name);
            const dest = path.join(this.vlcDestPath, name);
            await fs.promises.rename(src, dest);
          }
          // remove the now-empty directory
          await fs.promises.rmdir(single);
        }
      } catch (err) {
        // ignore
      }
    }

    // cleanup tmp zip
    try { await fs.promises.unlink(this.tmpZip); } catch (e) { /* ignore */ }
  }

  async bundleVLC() {
    console.log('Starting VLC bundling process...');
    try {
      // If already present and non-empty, skip
      if (fs.existsSync(this.vlcDestPath) && fs.readdirSync(this.vlcDestPath).length > 0) {
        console.log('resources/vlc already exists and is non-empty — skipping download/copy.');
        return;
      }

      await this.ensureDirectoryExists(this.resourcesDir);

      // Try to copy from Program Files if available
      if (fs.existsSync(this.vlcSourcePath)) {
        console.log('Found VLC installation, copying files from', this.vlcSourcePath);
        await this.copyDirectory(this.vlcSourcePath, this.vlcDestPath);
        console.log('VLC bundled successfully from system installation!');
        return;
      }

      // Attempt to download portable VLC ZIP
      const vlcUrl = process.env.VLC_URL || this.defaultVlcUrl;
      try {
        await this.downloadAndExtractVLC(vlcUrl);
        console.log('VLC downloaded and extracted to resources/vlc');
        return;
      } catch (err) {
        console.warn('Auto-download of VLC failed:', err.message || err);
      }

      // Last resort: create placeholder and instruct user
      console.log('VLC not found and auto-download failed. Please place VLC files in: resources/vlc/');
      await this.ensureDirectoryExists(this.vlcDestPath);
      const readmeContent = `VLC Media Player Bundle Directory\n\nPlease place VLC files here for bundling with the application.\n\nRequired files:\n- vlc.exe\n- libvlc.dll\n- libvlccore.dll\n- plugins/ (entire directory)\n- locale/ (entire directory)\n\nDownload VLC from: https://www.videolan.org/vlc/ or set VLC_URL environment variable to a portable zip URL.`;
      await fs.promises.writeFile(path.join(this.vlcDestPath, 'README.txt'), readmeContent);
    } catch (error) {
      console.error('Error bundling VLC:', error);
      throw error;
    }
  }
}

// Run the bundling process when invoked directly
if (require.main === module) {
  (async () => {
    const bundler = new VLCBundler();
    try {
      await bundler.bundleVLC();
      console.log('VLC bundling completed successfully!');
    } catch (err) {
      console.error('VLC bundling failed:', err);
      process.exit(1);
    }
  })();
}

module.exports = VLCBundler;