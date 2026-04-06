import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
  openFile: (filePath: string, startTime?: number) => ipcRenderer.invoke('open-file', filePath, startTime),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openTrailerWindow: (url: string, title: string) => ipcRenderer.invoke('open-trailer-window', { url, title }),
  playMediaVLC: (options: { filePath: string; startTime?: number; fullscreen?: boolean }) => ipcRenderer.invoke('play-media-vlc', options),
  getVLCStatus: () => ipcRenderer.invoke('get-vlc-status'),
  sendVLCCommand: (command: string, value?: string) => ipcRenderer.invoke('send-vlc-command', { command, value }),
  stopVLC: () => ipcRenderer.invoke('stop-vlc'),
  getVideosPath: () => ipcRenderer.invoke('get-videos-path'),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  getUserName: () => ipcRenderer.invoke('get-user-name'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  sortFiles: (options: any) => ipcRenderer.invoke('sort-files', options),
  moveToTrash: (filePath: string) => ipcRenderer.invoke('move-to-trash', filePath),
  openTrashFolder: () => ipcRenderer.invoke('open-trash-folder'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  getTrailerPreloadPath: () => ipcRenderer.invoke('get-trailer-preload-path'),
  computeFileHash: (filePath: string, options?: { mode?: 'quick' | 'full' }) => ipcRenderer.invoke('compute-file-hash', { filePath, options }),
  // Fetch news via main process (avoids CORS / origin issues in packaged builds)
  fetchNews: (query: string) => ipcRenderer.invoke('fetch-news', query),
  saveLibraryCache: (data: any) => ipcRenderer.invoke('save-library-cache', data),
  loadLibraryCache: () => ipcRenderer.invoke('load-library-cache'),
  // EME/Widevine capability check (useful to detect missing Widevine in packaged builds)
  isEMESupported: () => (typeof (navigator as any).requestMediaKeySystemAccess === 'function'),
  downloadImage: (url: string, fileName: string, options?: { overwrite?: boolean }) => ipcRenderer.invoke('download-image', { url, fileName, options }),
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => ipcRenderer.on(channel, callback),
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => ipcRenderer.removeListener(channel, callback)
}

console.log('🔌 Preload script loaded, exposing electronAPI:', api);

// Always expose the API for now to test
try {
  contextBridge.exposeInMainWorld('electronAPI', api)
  console.log('✅ Successfully exposed electronAPI via contextBridge');
} catch (error) {
  console.error('❌ Failed to expose electronAPI via contextBridge:', error);
  // Fallback
  // @ts-ignore
  window.electronAPI = api;
  console.log('⚠️ Exposed electronAPI directly to window');
}
