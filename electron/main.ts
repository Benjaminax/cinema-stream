import { app, BrowserWindow, ipcMain, shell, dialog, protocol, net, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { exec, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseMediaFilename, cleanMediaTitle } from '../src/utils/mediaParser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VLC Media Player Manager
class MediaPlayerManager {
  private vlcPath: string | null = null;

  constructor() {
    this.vlcPath = this.findVLCPath();
  }

  findVLCPath(): string | null {
    const possiblePaths = [
      // Bundled VLC paths
      path.join(process.resourcesPath, 'vlc', 'vlc.exe'),
      path.join(__dirname, '..', 'resources', 'vlc', 'vlc.exe'),
      // System VLC paths
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
      path.join(process.env.PROGRAMFILES || '', 'VideoLAN', 'VLC', 'vlc.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'VideoLAN', 'VLC', 'vlc.exe')
    ];

    for (const vlcPath of possiblePaths) {
      if (fs.existsSync(vlcPath)) {
        console.log(`VLC found at: ${vlcPath}`);
        return vlcPath;
      }
    }
    console.warn('VLC Media Player not found');
    return null;
  }

  async playMedia(filePath: string, options: any = {}): Promise<{ success: boolean; error?: string }> {
    if (!this.vlcPath) {
      return { success: false, error: 'VLC Media Player not found. Please install VLC or check bundled installation.' };
    }

    try {
      const vlcArgs = [
        filePath,
        '--intf', 'qt',
        '--qt-start-minimized',
        '--play-and-exit'
      ];

      // Add resume from timestamp if provided
      if (options.startTime) {
        vlcArgs.push('--start-time', options.startTime.toString());
      }

      // Fullscreen option
      if (options.fullscreen) {
        vlcArgs.push('--fullscreen');
      }

      const vlcProcess = spawn(this.vlcPath, vlcArgs, {
        detached: true,
        stdio: 'ignore'
      });

      vlcProcess.unref();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

const mediaPlayer = new MediaPlayerManager();

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite#5305
// 🚧 Use `import.meta.env.VITE_SOME_KEY` instead of `process.env.VITE_SOME_KEY`
// See: https://github.com/vitejs/vite/issues/5305
// const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Register custom protocol for local media
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mediaflix',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
      corsEnabled: true
    }
  }
])

function createWindow() {
  console.log('🔧 createWindow called');

  if (!process.env.VITE_DEV_SERVER_URL && !process.env.DIST) {
    console.error('⚠️ Neither VITE_DEV_SERVER_URL nor DIST is set – aborting');
    return;
  }

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'app-portal.png'),
    title: 'CineStream',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Re-enable <webview>
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c0d10',
      symbolColor: '#e5e7ef',
      height: 36,
    },
    autoHideMenuBar: true,
  })

  // Hide default menu bar while keeping the native title bar
  win.setMenu(null)

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Force a standard Chrome User-Agent globally
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Disable some security features that might interfere with iframes in local builds
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests');
// Allow autoplay without a user gesture (improves embedded YouTube playback)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  console.log('✅ Electron ready – initializing app');
  // Handle mediaflix protocol
  protocol.handle('mediaflix', (request) => {
    try {
      const url = new URL(request.url)
      const filePath = url.searchParams.get('path')

      if (filePath) {
        const decodedPath = decodeURIComponent(filePath)

        if (fs.existsSync(decodedPath)) {
          return net.fetch(pathToFileURL(decodedPath).toString())
        } else {
          console.error('🖼️ Protocol: File not found:', decodedPath)
        }
      }
    } catch (error) {
      console.error('🖼️ Protocol: Error handling request:', error)
    }
    return new Response('File Not Found', { status: 404 })
  })

  // Fix for YouTube embeds in production - Target the partition specifically
  const youtubeSession = session.fromPartition('persist:youtube');
  youtubeSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://youtube.com/*', '*://www.youtube-nocookie.com/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };

      // Force standard headers for the embedded player
      headers['Referer'] = 'https://www.youtube.com/';
      headers['Origin'] = 'https://www.youtube.com';
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      // Clean up Electron/Sec-Ch-Ua headers
      delete headers['Sec-Ch-Ua'];
      delete headers['Sec-Ch-Ua-Mobile'];
      delete headers['Sec-Ch-Ua-Platform'];

      callback({ requestHeaders: headers });
    }
  );

  // Allow media / fullscreen / autoplay related permissions for the youtube session
  try {
    // Accept permission requests needed for YouTube playback
    // (Electron >= 14 uses setPermissionRequestHandler)
    youtubeSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Allow audio/video playback and fullscreen for embedded players
      if (permission === 'media' || permission === 'fullscreen' || permission === 'openExternal' || permission === 'clipboard-read') {
        return callback(true);
      }
      // Default deny other permissions
      return callback(false);
    });
  } catch (err) {
    console.warn('⚠️ Could not set permission handler for youtube session:', err);
  }

  console.log('✅ About to create window');
  createWindow();
})

// IPC handlers for file system operations
ipcMain.handle('scan-directory', async (event, dirPath: string) => {
  // Convert forward slashes back to backslashes for Windows
  const normalizedPath = dirPath.replace(/\//g, '\\');
  try {
    const files = await scanDirectoryForVideos(normalizedPath);
    return files;
  } catch (error) {
    console.error('📁 Main process: Error scanning directory:', error);
    return [];
  }
});

ipcMain.handle('open-file', async (event, filePath: string) => {
  console.log('📂 Main process: Opening file:', filePath);
  try {
    await shell.openPath(filePath);
  } catch (error) {
    console.error('📂 Main process: Error opening file:', error);
  }
});

ipcMain.handle('open-external', async (event, url: string) => {
  console.log('🌐 Main process: Opening external URL:', url);
  try {
    await shell.openExternal(url);
  } catch (error) {
    console.error('🌐 Main process: Error opening external URL:', error);
  }
});

// VLC Media Player IPC handler
ipcMain.handle('play-media-vlc', async (event, { filePath, startTime, fullscreen }: { filePath: string; startTime?: number; fullscreen?: boolean }) => {
  console.log('🎮 Main process: Playing media with VLC:', filePath);
  try {
    const result = await mediaPlayer.playMedia(filePath, { startTime, fullscreen });
    return result;
  } catch (error: any) {
    console.error('🎮 Main process: Error playing media with VLC:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-trailer-window', async (event, { url, title }: { url: string; title: string }) => {
  console.log('🎬 Main process: Opening trailer window:', url);
  try {
    const trailerWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      title: title || 'Trailer',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        // Use the dedicated YouTube partition so our request headers and
        // permission handler defined above are used for the embedded player.
        partition: 'persist:youtube',
      },
    });

    // Set User-Agent to look like Chrome
    trailerWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    trailerWindow.loadURL(url);
    trailerWindow.setMenu(null);
  } catch (error) {
    console.error('🎬 Main process: Error opening trailer window:', error);
  }
});
// IPC handler to delete a file (used by DuplicateScanner)
ipcMain.handle('delete-file', async (event, filePath: string) => {
  console.log(' Main process: Deleting file:', filePath);
  try {
    const normalizedPath = filePath.replace(/\//g, '\\');
    await fs.promises.unlink(normalizedPath);
    console.log(' Successfully deleted:', normalizedPath);
    return true;
  } catch (error) {
    console.error(' Error deleting file:', filePath, error);
    return false;
  }
});


ipcMain.handle('get-videos-path', async () => {
  // Try to get the Videos folder path
  const homeDir = app.getPath('home');
  const videosPath = path.join(homeDir, 'Videos');
  console.log('🏠 Main process: Videos path:', videosPath);
  // Convert backslashes to forward slashes for consistency
  return videosPath.replace(/\\/g, '/');
});

ipcMain.handle('get-downloads-path', async () => {
  const homeDir = app.getPath('home');
  const downloadsPath = path.join(homeDir, 'Downloads');
  const telegramDesktopPath = path.join(downloadsPath, 'Telegram Desktop');
  return {
    downloads: downloadsPath.replace(/\\/g, '/'),
    telegram: telegramDesktopPath.replace(/\\/g, '/'),
  };
});

ipcMain.handle('get-app-data-path', async () => {
  return app.getPath('userData').replace(/\\/g, '/');
});

ipcMain.handle('save-library-cache', async (event, data: any) => {
  try {
    const userDataPath = app.getPath('userData');
    const cachePath = path.join(userDataPath, 'library_cache.json');
    await fs.promises.writeFile(cachePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving library cache:', error);
    return false;
  }
});

ipcMain.handle('load-library-cache', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const cachePath = path.join(userDataPath, 'library_cache.json');
    if (!fs.existsSync(cachePath)) return null;
    const data = await fs.promises.readFile(cachePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading library cache:', error);
    return null;
  }
});

ipcMain.handle('download-image', async (event, { url, fileName }: { url: string; fileName: string }) => {
  try {
    const userDataPath = app.getPath('userData');
    const cacheDir = path.join(userDataPath, 'image_cache');
    if (!fs.existsSync(cacheDir)) {
      await fs.promises.mkdir(cacheDir, { recursive: true });
    }

    const filePath = path.join(cacheDir, fileName);
    if (fs.existsSync(filePath)) {
      return filePath.replace(/\\/g, '/');
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(buffer));

    return filePath.replace(/\\/g, '/');
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
});

ipcMain.handle('get-user-name', async () => {
  try {
    const username = os.userInfo().username;

    // On Windows, try to get the Full Name using 'net user'
    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        exec(`net user ${username}`, (error, stdout) => {
          if (error) {
            resolve(username);
            return;
          }

          // Parse "Full Name" from the output
          const lines = stdout.split('\n');
          const fullNameLine = lines.find(line => line.includes('Full Name'));

          if (fullNameLine) {
            const fullName = fullNameLine.split(/ {2,}/)[1]?.trim();
            if (fullName && fullName.length > 0) {
              resolve(fullName);
              return;
            }
          }
          resolve(username);
        });
      });
    }

    return username;
  } catch (error) {
    console.error('Error getting username:', error);
    return 'User';
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: 'Select Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0].replace(/\\/g, '/');
  }
  return null;
});

// IPC handler for sorting files
ipcMain.handle('sort-files', async (event, options) => {
  console.log('🔄 Main process: Starting file sorting with options:', options);
  try {
    const results = await sortFiles(event, options);
    console.log('✅ Main process: File sorting completed:', results);
    return results;
  } catch (error) {
    console.error('❌ Main process: Error during file sorting:', error);
    return { moved: 0, skipped: 0, errors: [error instanceof Error ? error.message : String(error)] };
  }
});

// IPC handler for moving files to trash
ipcMain.handle('move-to-trash', async (event, filePath: string) => {
  console.log('🗑️ Main process: Moving file to recycle bin:', filePath);
  try {
    const normalizedPath = filePath.replace(/\//g, '\\');

    // Ensure the path exists before trying to move to trash
    if (!fs.existsSync(normalizedPath)) {
      console.error('❌ File does not exist:', normalizedPath);
      return { success: false, error: 'File does not exist' };
    }

    // Try shell.trashItem first (Electron's built-in method)
    try {
      await shell.trashItem(normalizedPath);
      console.log('✅ Successfully moved to recycle bin using shell.trashItem:', normalizedPath);
      return { success: true };
    } catch (shellError) {
      console.warn('⚠️ shell.trashItem failed, trying alternative method:', shellError);

      // Fallback: Use Windows PowerShell to move to recycle bin
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);

      try {
        // Use PowerShell to move file to recycle bin
        const psCommand = `powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${normalizedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;
        await execAsync(psCommand);
        console.log('✅ Successfully moved to recycle bin using PowerShell:', normalizedPath);
        return { success: true };
      } catch (psError) {
        console.warn('⚠️ PowerShell method failed, trying direct delete:', psError);

        // Last resort: Try to delete the file directly (not recommended but better than failing)
        try {
          fs.unlinkSync(normalizedPath);
          console.log('✅ File deleted directly (not moved to recycle bin):', normalizedPath);
          return { success: true, warning: 'File was deleted instead of moved to recycle bin' };
        } catch (deleteError) {
          console.error('❌ All methods failed to remove file:', normalizedPath, deleteError);
          return { success: false, error: `Failed to move to recycle bin: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}` };
        }
      }
    }
  } catch (error) {
    console.error('❌ Error moving file to recycle bin:', filePath, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// IPC handler for opening trash folder
ipcMain.handle('open-trash-folder', async () => {
  console.log('🗂️ Main process: Opening system recycle bin');
  try {
    // On Windows, open the recycle bin
    await shell.openPath('shell:RecycleBinFolder');
    console.log('✅ Successfully opened system recycle bin');
    return true;
  } catch (error) {
    console.error('❌ Error opening recycle bin:', error);
    return false;
  }
});

// Helper function to scan directory for video files and directories
async function scanDirectoryForVideos(dirPath: string): Promise<any[]> {
  console.log('scanDirectoryForVideos called with:', dirPath);
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
  const results: any[] = [];

  async function scanRecursive(currentPath: string) {
    try {
      console.log('Scanning directory:', currentPath);
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });
      console.log('Found', items.length, 'items in', currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);

        try {
          if (item.isDirectory()) {
            // Include directories in results
            const stats = await fs.promises.stat(fullPath);
            results.push({
              name: item.name,
              path: fullPath,
              size: 0, // Directories don't have a size
              modified: stats.mtime,
              type: 'directory'
            });
            // Recursively scan subdirectory
            await scanRecursive(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (videoExtensions.includes(ext)) {
              const stats = await fs.promises.stat(fullPath);
              console.log('📄 Found video file:', fullPath, 'Size:', stats.size);
              results.push({
                name: item.name,
                path: fullPath,
                size: stats.size,
                modified: stats.mtime,
                type: 'file'
              });
            }
          }
        } catch (fileError) {
          console.warn(`Skipping file/directory due to error (lock/permission): ${fullPath}`, fileError);
        }
      }
    } catch (error) {
      console.error(`Error scanning ${currentPath}:`, error);
    }
  }

  await scanRecursive(dirPath);
  console.log('Total results found:', results.length);

  // Check for duplicate paths
  const pathCount = new Map<string, number>();
  for (const result of results) {
    if (result.type === 'file') {
      pathCount.set(result.path, (pathCount.get(result.path) || 0) + 1);
    }
  }

  const duplicates = Array.from(pathCount.entries()).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('⚠️ Found duplicate file paths in scan results:', duplicates);
  }

  return results;
}

// File sorting functionality
interface SortOptions {
  downloadsFolders: string[];
  moviesFolder: string;
  seriesFolder: string;
  mediaExtensions: string[];
}

interface SortResults {
  moved: number;
  skipped: number;
  errors: string[];
}

async function sortFiles(event: any, options: SortOptions): Promise<SortResults> {
  const { downloadsFolders, moviesFolder, seriesFolder, mediaExtensions } = options;
  const results: SortResults = { moved: 0, skipped: 0, errors: [] };

  console.log('🎯 Starting file sorting process');

  // Validate paths
  for (const folder of downloadsFolders) {
    if (!fs.existsSync(folder)) {
      results.errors.push(`Downloads folder does not exist: ${folder}`);
      return results;
    }
  }

  if (!fs.existsSync(moviesFolder)) {
    try {
      await fs.promises.mkdir(moviesFolder, { recursive: true });
    } catch (error) {
      results.errors.push(`Cannot create movies folder: ${error instanceof Error ? error.message : String(error)}`);
      return results;
    }
  }

  if (!fs.existsSync(seriesFolder)) {
    try {
      await fs.promises.mkdir(seriesFolder, { recursive: true });
    } catch (error) {
      results.errors.push(`Cannot create series folder: ${error instanceof Error ? error.message : String(error)}`);
      return results;
    }
  }

  // Collect all media files from downloads folders
  const allFiles: string[] = [];
  for (const downloadsFolder of downloadsFolders) {
    try {
      const files = await scanDirectoryForMediaFiles(downloadsFolder, mediaExtensions);
      allFiles.push(...files);
      console.log(`📁 Found ${files.length} media files in ${downloadsFolder}`);
    } catch (error) {
      results.errors.push(`Error scanning ${downloadsFolder}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`📊 Total media files to process: ${allFiles.length}`);

  // Send initial progress
  event.sender.send('sorting-progress', {
    current: 0,
    total: allFiles.length,
    status: 'Starting file organization...'
  });

  // Process each file
  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    const fileName = path.basename(filePath);

    try {
      // Parse the media file using unified parser
      const parsed = parseMediaFilename(fileName);
      let destinationPath: string;
      let isSeries = false;

      if (parsed.type === 'series' && parsed.season) {
        // It's a series episode
        isSeries = true;
        const seasonFolder = path.join(seriesFolder, parsed.title, `Season ${parsed.season}`);
        await fs.promises.mkdir(seasonFolder, { recursive: true });
        destinationPath = path.join(seasonFolder, fileName);
        console.log(`📺 Series: ${parsed.title} S${parsed.season}E${parsed.episode}`);
      } else {
        // It's a movie
        const movieTitle = parsed.title;
        destinationPath = path.join(moviesFolder, fileName);
        console.log(`🎬 Movie: ${movieTitle}`);
      }

      // Check for duplicates
      if (await isPotentialDuplicate(filePath, destinationPath, isSeries ? seriesFolder : moviesFolder)) {
        console.log(`⏭️ Skipping duplicate: ${fileName}`);
        results.skipped++;
      } else {
        // Generate unique filename if needed
        const uniquePath = await getUniqueFilename(destinationPath);

        // Move the file
        await fs.promises.rename(filePath, uniquePath);
        console.log(`✅ Moved: ${fileName} -> ${uniquePath}`);
        results.moved++;
      }

    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
      results.errors.push(`Error processing ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Update progress
    event.sender.send('sorting-progress', {
      current: i + 1,
      total: allFiles.length,
      status: `Processing: ${fileName}`
    });
  }

  // Send final progress
  event.sender.send('sorting-progress', {
    current: allFiles.length,
    total: allFiles.length,
    status: 'File organization completed!'
  });

  return results;
}

// Helper function to recursively scan directory for media files
async function scanDirectoryForMediaFiles(dirPath: string, mediaExtensions: string[]): Promise<string[]> {
  const results: string[] = [];

  async function scanRecursive(currentPath: string) {
    try {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);

        try {
          if (item.isDirectory()) {
            // Recursively scan subdirectory
            await scanRecursive(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (mediaExtensions.includes(ext)) {
              results.push(fullPath);
            }
          }
        } catch (fileError) {
          // Skip individual files that can't be accessed
          console.warn(`Skipping file in organizer scan: ${fullPath}`, fileError);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${currentPath}:`, error);
    }
  }

  await scanRecursive(dirPath);
  return results;
}

// Helper function to recursively scan directory for media files (for duplicate checking)
async function scanDirectoryForMediaFilesRecursive(dirPath: string, mediaExtensions: string[]): Promise<string[]> {
  const results: string[] = [];

  async function scanRecursive(currentPath: string) {
    try {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
          // Recursively scan subdirectory
          await scanRecursive(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (mediaExtensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
      console.warn(`Could not scan directory ${currentPath}:`, error instanceof Error ? error.message : String(error));
    }
  }

  await scanRecursive(dirPath);
  return results;
}



// Check if file is a potential duplicate
async function isPotentialDuplicate(sourcePath: string, destPath: string, libraryFolder: string): Promise<boolean> {
  const fileName = path.basename(sourcePath);
  try {
    const sourceStats = await fs.promises.stat(sourcePath);
    const sourceSize = sourceStats.size;

    // 1. Check if the exact destination file already exists
    if (fs.existsSync(destPath)) {
      const destStats = await fs.promises.stat(destPath);
      const destSize = destStats.size;

      // Compare file sizes (with 20% tolerance for exact name match)
      const sizeDiff = Math.abs(sourceSize - destSize) / Math.max(sourceSize, destSize);
      if (sizeDiff <= 0.2) {
        console.log(`⏭️ Skipping duplicate (path exists, similar size): ${fileName}`);
        return true;
      }
      console.log(`ℹ️ Destination exists but size is different (${Math.round(sizeDiff * 100)}% diff). Will create unique name.`);
    }

    // 2. Check for potential duplicates in the library folder based on name AND size
    // We only do this deeper scan if the library folder is different from the source folder
    const sourceDir = path.dirname(sourcePath);
    if (sourceDir === libraryFolder) {
      return false; // Already in library, let the caller handle it if needed
    }

    const cleanedSourceTitle = cleanMediaTitle(path.basename(sourcePath, path.extname(sourcePath)));
    const existingFiles = await scanDirectoryForMediaFilesRecursive(libraryFolder, ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']);

    for (const existingFile of existingFiles) {
      try {
        // Skip if it's the same file path (shouldn't happen but good safety)
        if (existingFile === sourcePath) continue;

        const existingStats = await fs.promises.stat(existingFile);
        const existingSize = existingStats.size;

        // Compare file sizes (with 10% tolerance for non-exact name match)
        const sizeDiff = Math.abs(sourceSize - existingSize) / Math.max(sourceSize, existingSize);

        if (sizeDiff <= 0.1) {
          // If the size is very similar, check if the name is also similar
          const existingFileName = path.basename(existingFile, path.extname(existingFile));
          const cleanedExistingTitle = cleanMediaTitle(existingFileName);

          if (cleanedSourceTitle.toLowerCase() === cleanedExistingTitle.toLowerCase()) {
            console.log(`⏭️ Skipping duplicate (found similar in library): ${fileName} matches ${path.basename(existingFile)}`);
            return true;
          }
        }
      } catch (error) {
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ Error checking for duplicates for ${fileName}:`, error);
    return false;
  }
}

// Generate unique filename if destination already exists
async function getUniqueFilename(destPath: string): Promise<string> {
  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const baseName = path.basename(destPath, ext);

  let counter = 1;
  let uniquePath = destPath;

  while (fs.existsSync(uniquePath)) {
    uniquePath = path.join(dir, `${baseName}_${counter}${ext}`);
    counter++;
  }

  return uniquePath;
}




