import { app, BrowserWindow, ipcMain, shell, dialog, protocol, net, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { exec, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseMediaFilename, cleanMediaTitle } from '../src/utils/mediaParser.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// VLC Media Player Manager with Advanced Tracking
class MediaPlayerManager {
  private vlcPath: string | null = null;
  private vlcProcess: any = null;
  private httpPassword: string = 'vlcpass123';
  private httpPort: number = 8080;
  private trackingInterval: NodeJS.Timeout | null = null;
  private currentMediaPath: string | null = null;
  private isTracking: boolean = false;

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

  private async findAvailablePort(): Promise<number> {
    const net = require('net');
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => {
          resolve(port);
        });
      });
      server.on('error', reject);
    });
  }

  async playMedia(filePath: string, options: any = {}): Promise<{ success: boolean; error?: string }> {
    if (!this.vlcPath) {
      return { success: false, error: 'VLC Media Player not found. Please install VLC or check bundled installation.' };
    }

    try {
      // Find available port for HTTP interface
      this.httpPort = await this.findAvailablePort();
      
      const vlcArgs = [
        filePath,
        '--intf', 'http',
        '--http-password', this.httpPassword,
        '--http-port', this.httpPort.toString(),
        '--extraintf', 'qt',
        '--qt-start-minimized'
      ];

      // Add resume from timestamp if provided
      if (options.startTime) {
        vlcArgs.push('--start-time', options.startTime.toString());
      }

      // Fullscreen option
      if (options.fullscreen) {
        vlcArgs.push('--fullscreen');
      }

      // Kill existing VLC process if running
      if (this.vlcProcess) {
        this.stopTracking();
        try {
          this.vlcProcess.kill();
        } catch (e) {
          console.log('Previous VLC process already terminated');
        }
      }

      console.log(`🎮 Starting VLC with HTTP interface on port ${this.httpPort}`);
      
      this.vlcProcess = spawn(this.vlcPath, vlcArgs, {
        detached: false,
        stdio: 'pipe'
      });

      this.currentMediaPath = filePath;
      
      // Start tracking after a delay to allow VLC to initialize
      setTimeout(() => {
        this.startTracking();
      }, 3000);

      // Handle VLC process events
      this.vlcProcess.on('close', (code: number) => {
        console.log(`🎮 VLC process exited with code ${code}`);
        this.stopTracking();
        this.vlcProcess = null;
        this.currentMediaPath = null;
      });

      this.vlcProcess.on('error', (error: Error) => {
        console.error('🎮 VLC process error:', error);
        this.stopTracking();
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async makeVLCRequest(command: string): Promise<any> {
    try {
      const http = require('http');
      const auth = Buffer.from(`:${this.httpPassword}`).toString('base64');
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: this.httpPort,
          path: `/requests/${command}`,
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`
          },
          timeout: 5000
        };

        const req = http.request(options, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (e) {
              resolve(null);
            }
          });
        });

        req.on('error', (err: Error) => {
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('VLC HTTP request timeout'));
        });

        req.end();
      });
    } catch (error) {
      throw error;
    }
  }

  private startTracking(): void {
    if (this.isTracking || !this.vlcProcess) return;
    
    console.log('🔄 Starting VLC playback tracking');
    this.isTracking = true;
    
    this.trackingInterval = setInterval(async () => {
      try {
        const status = await this.makeVLCRequest('status.json');
        if (status && this.currentMediaPath) {
          const currentTime = status.time || 0;
          const totalLength = status.length || 0;
          const state = status.state || 'unknown';

          // Send progress update to renderer
          if (win && currentTime >= 0 && totalLength > 0) {
            win.webContents.send('playback-progress', {
              path: this.currentMediaPath,
              time: currentTime,
              length: totalLength,
              state: state,
              position: status.position || 0
            });
          }

          // If playback has ended, stop tracking
          if (state === 'stopped' || (totalLength > 0 && currentTime >= totalLength * 0.99)) {
            console.log('🎬 Playback completed, stopping tracking');
            this.stopTracking();
          }
        }
      } catch (error) {
        // If we can't connect to VLC HTTP interface, it might have closed
        console.log('VLC HTTP interface not available, stopping tracking');
        this.stopTracking();
      }
    }, 2000); // Update every 2 seconds
  }

  private stopTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    this.isTracking = false;
    console.log('🔄 Stopped VLC playback tracking');
  }

  async getVLCStatus(): Promise<any> {
    if (!this.vlcProcess) {
      return { connected: false, message: 'VLC not running' };
    }

    try {
      const status = await this.makeVLCRequest('status.json');
      if (status) {
        return {
          connected: true,
          state: status.state || 'unknown',
          time: status.time || 0,
          length: status.length || 0,
          position: status.position || 0,
          volume: status.volume || 0,
          currentMedia: this.currentMediaPath
        };
      }
    } catch (error) {
      console.error('Failed to get VLC status:', error);
    }
    
    return { connected: false, message: 'Unable to connect to VLC' };
  }

  async sendVLCCommand(command: string, value?: string): Promise<boolean> {
    if (!this.vlcProcess) return false;

    try {
      let commandUrl = `status.json?command=${command}`;
      if (value !== undefined) {
        commandUrl += `&val=${encodeURIComponent(value)}`;
      }
      
      await this.makeVLCRequest(commandUrl);
      return true;
    } catch (error) {
      console.error(`Failed to send VLC command ${command}:`, error);
      return false;
    }
  }

  stopVLC(): void {
    this.stopTracking();
    if (this.vlcProcess) {
      try {
        this.vlcProcess.kill();
      } catch (e) {
        console.log('VLC process already terminated');
      }
      this.vlcProcess = null;
    }
    this.currentMediaPath = null;
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
  },
  // Secure local app protocol so embeds see a proper origin instead of file://
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true
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

  // Apply a modern desktop Chrome user-agent to the window to avoid YouTube blocking
  const forcedUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  try {
    win.webContents.setUserAgent(forcedUA);
  } catch (err) {
    console.warn('Unable to set webContents userAgent:', err);
  }

  // Hide default menu bar while keeping the native title bar
  win.setMenu(null)

  // Test active push message to Renderer-process and check EME support in renderer.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())

    // Probe EME (requestMediaKeySystemAccess) availability in the renderer and log —
    // useful to detect missing Widevine in packaged builds which often cause 152/153 errors.
    win?.webContents.executeJavaScript('!!(navigator.requestMediaKeySystemAccess)').then((hasEME) => {
      console.log('🔍 Renderer EME available:', hasEME);
      if (!hasEME && app.isPackaged) {
        console.warn('⚠️ EME (Widevine) not available in packaged app — this can cause YouTube error 152/153');
      }
    }).catch(err => console.warn('EME probe failed:', err));
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // Serve production files over a secure `app://` protocol to provide a valid origin
    const distPath = process.env.DIST || path.join(__dirname, '../dist');
    try {
      protocol.registerFileProtocol('app', (request, callback) => {
        const url = new URL(request.url);
        let pathname = decodeURIComponent(url.pathname);
        // Trim leading slashes
        pathname = pathname.replace(/^\/+/, '');
        const filePath = path.join(distPath, pathname || 'index.html');
        callback({ path: filePath });
      });
      win.loadURL('app://./index.html');
    } catch (err) {
      console.error('Failed to register app protocol, falling back to loadFile:', err);
      win.loadFile(path.join(process.env.DIST || '', 'index.html'));
    }
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Force a standard Chrome User-Agent globally (use recent Chrome version to avoid player blocking)
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Enable Widevine CDM so DRM-protected streams (YouTube/HTML5) can play when available.
// Note: packaging must include platform Widevine libraries for full DRM support.
app.commandLine.appendSwitch('enable-widevine-cdm');

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
    { urls: ['*://*.youtube.com/*', '*://youtube.com/*', '*://www.youtube-nocookie.com/*', '*://*.ytimg.com/*', '*://*.googlevideo.com/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };

      // Force standard headers for the embedded player
      headers['Referer'] = 'https://www.youtube.com/';
      headers['Origin'] = 'https://www.youtube.com';
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      // Ensure the referrer policy is strict-origin-when-cross-origin
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

      // Clean up Electron/Sec-Ch-Ua headers
      delete headers['Sec-Ch-Ua'];
      delete headers['Sec-Ch-Ua-Mobile'];
      delete headers['Sec-Ch-Ua-Platform'];

      callback({ requestHeaders: headers });
    }
  );

  // --- ALSO: apply the same header fixes to the default session so inline iframes (modal) work in packaged EXE ---
  try {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.youtube.com/*', '*://youtube.com/*', '*://www.youtube-nocookie.com/*', '*://*.ytimg.com/*', '*://*.googlevideo.com/*'] },
      (details, callback) => {
        const headers = { ...details.requestHeaders };
        headers['Referer'] = 'https://www.youtube.com/';
        headers['Origin'] = 'https://www.youtube.com';
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
        delete headers['Sec-Ch-Ua'];
        delete headers['Sec-Ch-Ua-Mobile'];
        delete headers['Sec-Ch-Ua-Platform'];
        callback({ requestHeaders: headers });
      }
    );
    console.log('✅ Default session patched for YouTube header fixes');
  } catch (err) {
    console.warn('⚠️ Could not patch default session for YouTube headers:', err);
  }

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

  // Also set a permissive handler on the default session for in-modal iframes
  try {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'fullscreen' || permission === 'openExternal' || permission === 'media' || permission === 'clipboard-read') {
        return callback(true);
      }
      return callback(false);
    });
    console.log('✅ Default session permission handler installed');
  } catch (err) {
    console.warn('⚠️ Could not install default session permission handler:', err);
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

ipcMain.handle('open-file', async (event, filePath: string, startTime?: number) => {
  console.log('📂 Main process: Opening file with VLC:', filePath, startTime ? `(start time: ${startTime}s)` : '');
  try {
    // Use VLC media player with tracking for video files
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.mpg', '.mpeg'];
    const fileExt = path.extname(filePath).toLowerCase();
    
    if (videoExtensions.includes(fileExt)) {
      // Use VLC for video files with tracking capabilities
      const result = await mediaPlayer.playMedia(filePath, { startTime, fullscreen: true });
      return result;
    } else {
      // Use default handler for non-video files
      await shell.openPath(filePath);
      return { success: true };
    }
  } catch (error: any) {
    console.error('📂 Main process: Error opening file:', error);
    return { success: false, error: error.message };
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

// VLC Status IPC handler
ipcMain.handle('get-vlc-status', async () => {
  try {
    const status = await mediaPlayer.getVLCStatus();
    return status;
  } catch (error: any) {
    console.error('🎮 Main process: Error getting VLC status:', error);
    return { connected: false, message: error.message };
  }
});

// VLC Command IPC handler
ipcMain.handle('send-vlc-command', async (event, { command, value }: { command: string; value?: string }) => {
  try {
    const success = await mediaPlayer.sendVLCCommand(command, value);
    console.log(`🎮 VLC command sent: ${command}${value ? `=${value}` : ''}, success: ${success}`);
    return { success };
  } catch (error: any) {
    console.error('🎮 Main process: Error sending VLC command:', error);
    return { success: false, error: error.message };
  }
});

// Stop VLC IPC handler
ipcMain.handle('stop-vlc', async () => {
  try {
    mediaPlayer.stopVLC();
    console.log('🎮 VLC stopped successfully');
    return { success: true };
  } catch (error: any) {
    console.error('🎮 Main process: Error stopping VLC:', error);
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

    // If loading a YouTube URL directly, pass extra headers to ensure correct Referer + Referrer-Policy
    if (/youtube\.com|youtube-nocookie\.com/.test(url)) {
      const extraHeaders = 'Referer: https://www.youtube.com/\r\nReferrer-Policy: strict-origin-when-cross-origin\r\nOrigin: https://www.youtube.com\r\n';
      trailerWindow.loadURL(url, { extraHeaders });
    } else {
      trailerWindow.loadURL(url);
    }

    trailerWindow.setMenu(null);
  } catch (error) {
    console.error('🎬 Main process: Error opening trailer window:', error);
  }
});

// Return the absolute path to the trailer webview preload script so the renderer can attach it to <webview>
ipcMain.handle('get-trailer-preload-path', async () => {
  try {
    const preloadPath = path.join(__dirname, 'trailer-preload.js');
    if (fs.existsSync(preloadPath)) return preloadPath;
    console.warn('Trailer preload not found at', preloadPath);
    return '';
  } catch (err) {
    console.error('Error returning trailer preload path:', err);
    return '';
  }
});

// Quickly compute a SHA-1 hash for a file (quick mode reads first+last 1MB, full mode reads entire file)
ipcMain.handle('compute-file-hash', async (event, { filePath, options }: { filePath: string; options?: { mode?: 'quick' | 'full' } }) => {
  try {
    const mode = options?.mode || 'quick';
    const stat = await fs.promises.stat(filePath);
    const size = stat.size || 0;
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha1');

    if (mode === 'full' || size <= 2 * 1024 * 1024) {
      // small files or explicit full mode: hash the entire file
      const stream = fs.createReadStream(filePath);
      for await (const chunk of stream) hash.update(chunk);
      return { hash: hash.digest('hex'), method: 'full' };
    }

    // quick: read first and last 1MB and hash them (fast, reliable for duplicates)
    const chunkSize = 1024 * 1024; // 1MB
    const fd = await fs.promises.open(filePath, 'r');
    try {
      const bufs: Buffer[] = [];
      const firstLen = Math.min(chunkSize, size);
      const firstBuf = Buffer.alloc(firstLen);
      await fd.read(firstBuf, 0, firstLen, 0);
      bufs.push(firstBuf);

      if (size > chunkSize) {
        const lastLen = Math.min(chunkSize, size - chunkSize);
        const lastBuf = Buffer.alloc(lastLen);
        const lastPos = Math.max(0, size - lastLen);
        await fd.read(lastBuf, 0, lastLen, lastPos);
        bufs.push(lastBuf);
      }

      for (const b of bufs) hash.update(b);
      return { hash: hash.digest('hex'), method: 'quick' };
    } finally {
      await fd.close();
    }
  } catch (err) {
    console.error('Error computing file hash:', err);
    return { hash: null, error: String(err) };
  }
});
// Fetch news via main process to avoid CORS / origin issues in packaged apps
ipcMain.handle('fetch-news', async (event, query: string) => {
  const NEWS_API_KEY = process.env.NEWS_API_KEY || 'f0de56da99d04da99f846ad839959950';
  const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

  try {
    const url = `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${NEWS_API_KEY}`;
    console.log('🌐 Main process: proxying news request for', query);
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.warn('News API returned', res.status);
      return { status: 'error', statusCode: res.status, articles: [] };
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error fetching news in main process:', err);
    return { status: 'error', statusCode: 500, articles: [] };
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

ipcMain.handle('download-image', async (event, { url, fileName, options }: { url: string; fileName: string; options?: { overwrite?: boolean } }) => {
  try {
    const userDataPath = app.getPath('userData');
    const cacheDir = path.join(userDataPath, 'image_cache');
    if (!fs.existsSync(cacheDir)) {
      await fs.promises.mkdir(cacheDir, { recursive: true });
    }

    const filePath = path.join(cacheDir, fileName);

    // If file exists and overwrite is not requested, return it
    if (fs.existsSync(filePath) && !options?.overwrite) {
      return filePath.replace(/\\/g, '/');
    }

    // Attempt to fetch the image and write/overwrite the cache file
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
  const visitedDirs = new Set<string>();
  const seenFiles = new Set<string>();

  async function scanRecursive(currentPath: string) {
    try {
      const resolvedPath = path.resolve(currentPath);
      if (visitedDirs.has(resolvedPath)) return;
      visitedDirs.add(resolvedPath);

      const items = await fs.promises.readdir(resolvedPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(resolvedPath, item.name);

        try {
          if (item.isDirectory()) {
            // Recursively scan subdirectory
            await scanRecursive(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (mediaExtensions.includes(ext) && !seenFiles.has(fullPath)) {
              results.push(fullPath);
              seenFiles.add(fullPath);
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
  const visitedDirs = new Set<string>();
  const seenFiles = new Set<string>();

  async function scanRecursive(currentPath: string) {
    try {
      const resolvedPath = path.resolve(currentPath);
      if (visitedDirs.has(resolvedPath)) return;
      visitedDirs.add(resolvedPath);

      const items = await fs.promises.readdir(resolvedPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(resolvedPath, item.name);

        if (item.isDirectory()) {
          // Recursively scan subdirectory
          await scanRecursive(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (mediaExtensions.includes(ext) && !seenFiles.has(fullPath)) {
            results.push(fullPath);
            seenFiles.add(fullPath);
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
          // If the size is very similar, parse filenames to avoid false positives across episodes
          const existingFileName = path.basename(existingFile, path.extname(existingFile));
          const cleanedExistingTitle = cleanMediaTitle(existingFileName);

          try {
            const srcParsed = parseMediaFilename(path.basename(sourcePath));
            const existingParsed = parseMediaFilename(path.basename(existingFile));

            // If both look like series with season/episode info, only treat as duplicate when S/E match
            if (srcParsed.type === 'series' && existingParsed.type === 'series' && srcParsed.season && srcParsed.episode && existingParsed.season && existingParsed.episode) {
              if (srcParsed.season === existingParsed.season && srcParsed.episode === existingParsed.episode) {
                console.log(`⏭️ Skipping duplicate (same series S${srcParsed.season}E${srcParsed.episode}): ${fileName} matches ${path.basename(existingFile)}`);
                return true;
              } else {
                // Different episode numbers -> NOT a duplicate
                console.log(`ℹ️ Not a duplicate: same show but different episodes (${srcParsed.season}x${srcParsed.episode} vs ${existingParsed.season}x${existingParsed.episode})`);
                continue;
              }
            }
          } catch (parseErr) {
            // If parsing fails, fall back to simple name match below
            console.warn('Series parsing failed during duplicate check:', parseErr);
          }

          // Fallback: if cleaned titles match exactly, consider duplicate
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




