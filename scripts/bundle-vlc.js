const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// VLC bundling script for Windows
class VLCBundler {
  constructor() {
    this.vlcSourcePath = path.join('C:', 'Program Files', 'VideoLAN', 'VLC');
    this.resourcesDir = path.join(__dirname, '..', 'resources');
    this.vlcDestPath = path.join(this.resourcesDir, 'vlc');
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
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
          console.log(`Copied: ${item.name}`);
        } catch (error) {
          console.warn(`Warning: Could not copy ${item.name}: ${error.message}`);
        }
      }
    }
  }

  async downloadPortableVLC() {
    console.log('Downloading VLC Portable...');
    
    // You can implement VLC download logic here
    // For now, we'll assume VLC is installed on the system
    console.log('Please ensure VLC is installed on your system or place VLC files in resources/vlc/');
  }

  async bundleVLC() {
    console.log('Starting VLC bundling process...');
    
    try {
      // Check if VLC is already bundled
      if (fs.existsSync(this.vlcDestPath)) {
        console.log('VLC already bundled. Skipping...');
        return;
      }

      await this.ensureDirectoryExists(this.resourcesDir);

      // Check if VLC is installed
      if (fs.existsSync(this.vlcSourcePath)) {
        console.log('Found VLC installation, copying files...');
        await this.copyDirectory(this.vlcSourcePath, this.vlcDestPath);
        console.log('VLC bundled successfully!');
      } else {
        console.log('VLC not found in standard installation path.');
        console.log('Please manually place VLC files in: resources/vlc/');
        console.log('Or install VLC from: https://www.videolan.org/vlc/');
        
        // Create placeholder directory
        await this.ensureDirectoryExists(this.vlcDestPath);
        
        // Create a README file
        const readmeContent = `VLC Media Player Bundle Directory
        
Please place VLC files here for bundling with the application.

Required files:
- vlc.exe
- libvlc.dll
- libvlccore.dll
- plugins/ (entire directory)
- locale/ (entire directory)

Download VLC from: https://www.videolan.org/vlc/
Or get the portable version from: https://portableapps.com/apps/music_video/vlc_portable`;
        
        await fs.promises.writeFile(
          path.join(this.vlcDestPath, 'README.txt'),
          readmeContent
        );
      }
    } catch (error) {
      console.error('Error bundling VLC:', error);
      throw error;
    }
  }
}

// Run the bundling process
if (require.main === module) {
  const bundler = new VLCBundler();
  bundler.bundleVLC()
    .then(() => {
      console.log('VLC bundling completed successfully!');
    })
    .catch((error) => {
      console.error('VLC bundling failed:', error);
      process.exit(1);
    });
}

module.exports = VLCBundler;