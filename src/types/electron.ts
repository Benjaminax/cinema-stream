declare global {
  interface ElectronAPI {
    scanDirectory: (dirPath: string) => Promise<import('../utils/localMedia').LocalMediaFile[]>;
    openFile: (filePath: string, startTime?: number) => Promise<{ success: boolean; error?: string }>;
    playMediaVLC: (options: { filePath: string; startTime?: number; fullscreen?: boolean }) => Promise<{ success: boolean; error?: string }>;
    getVLCStatus: () => Promise<{ connected: boolean; state?: string; time?: number; length?: number; position?: number; volume?: number; currentMedia?: string; message?: string }>;
    sendVLCCommand: (command: string, value?: string) => Promise<{ success: boolean; error?: string }>;
    stopVLC: () => Promise<{ success: boolean; error?: string }>;
    getVideosPath: () => Promise<string>;
    getDownloadsPath: () => Promise<{ downloads: string; telegram: string }>;
    getUserName: () => Promise<string>;
    selectFolder: () => Promise<string | null>;
    deleteFile: (filePath: string) => Promise<boolean>;
    getAppDataPath: () => Promise<string>;
    sortFiles: (options: any) => Promise<any>;
    moveToTrash: (filePath: string) => Promise<{ success: boolean; dest?: string; error?: string; warning?: string }>;
    openTrashFolder: () => Promise<boolean>;
    saveLibraryCache: (data: any) => Promise<boolean>;
    loadLibraryCache: () => Promise<any>;
    downloadImage: (url: string, fileName: string, options?: { overwrite?: boolean }) => Promise<string | null>;
    openExternal: (url: string) => Promise<void>;
    openTrailerWindow: (options: { url: string; title: string }) => Promise<void>;
    getTrailerPreloadPath: () => Promise<string>;
    getFileStats: (filePath: string) => Promise<{ mtimeMs?: number; birthtimeMs?: number; size?: number }>;
    computeFileHash: (filePath: string, options?: { mode?: 'quick' | 'full' }) => Promise<{ hash: string | null; method?: string; error?: string }>;
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export { };
