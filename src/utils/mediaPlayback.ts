/**
 * Enhanced media playback utilities with VLC tracking support
 */

export interface PlayMediaOptions {
  startTime?: number;
  fullscreen?: boolean;
  useVLCTracking?: boolean;
}

export interface PlayMediaResult {
  success: boolean;
  error?: string;
  method?: 'vlc' | 'system';
}

/**
 * Play media file with automatic VLC tracking for supported formats
 */
export const playMediaWithTracking = async (
  filePath: string, 
  options: PlayMediaOptions = {}
): Promise<PlayMediaResult> => {
  if (!window.electronAPI) {
    return { success: false, error: 'ElectronAPI not available' };
  }

  const { startTime, fullscreen = true, useVLCTracking = true } = options;
  
  // Video file extensions that support VLC tracking
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.mpg', '.mpeg', '.m2ts', '.3gp', '.f4v'];
  const fileExt = getFileExtension(filePath);
  
  const isVideoFile = videoExtensions.includes(fileExt);
  
  try {
    if (isVideoFile && useVLCTracking && window.electronAPI.playMediaVLC) {
      // Use VLC with tracking for video files
      console.log('🎬 Playing video with VLC tracking:', filePath);
      const result = await window.electronAPI.playMediaVLC({
        filePath,
        startTime,
        fullscreen
      });
      return { ...result, method: 'vlc' };
    } else if (window.electronAPI.openFile) {
      // Fallback to system handler or basic VLC
      console.log('🎵 Playing media with system handler:', filePath);
      const result = await window.electronAPI.openFile(filePath, startTime);
      return { ...result, method: 'system' };
    } else {
      return { success: false, error: 'No playback method available' };
    }
  } catch (error) {
    console.error('Failed to play media:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Get file extension from file path
 */
const getFileExtension = (filePath: string): string => {
  const lastDotIndex = filePath.lastIndexOf('.');
  return lastDotIndex !== -1 ? filePath.substring(lastDotIndex).toLowerCase() : '';
};

/**
 * Check if a file is a video file based on its extension
 */
export const isVideoFile = (filePath: string): boolean => {
  const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.mpg', '.mpeg', '.m2ts', '.3gp', '.f4v'];
  const fileExt = getFileExtension(filePath);
  return videoExtensions.includes(fileExt);
};

/**
 * Get a human-readable filename from a full path
 */
export const getFileName = (filePath: string): string => {
  if (!filePath) return 'Unknown File';
  return filePath.split(/[\\\\/]/).pop() || 'Unknown File';
};

/**
 * Format seconds into HH:MM:SS or MM:SS format
 */
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Create a promise that resolves when VLC starts playing
 */
export const waitForVLCPlayback = (timeoutMs: number = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    let resolved = false;
    
    // Listen for playback progress event
    const handleProgress = (event: CustomEvent) => {
      if (!resolved && event.detail?.state === 'playing') {
        resolved = true;
        resolve(true);
        window.removeEventListener('vlc-playback-progress', handleProgress as any);
      }
    };
    
    window.addEventListener('vlc-playback-progress', handleProgress as any);
    
    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
        window.removeEventListener('vlc-playback-progress', handleProgress as any);
      }
    }, timeoutMs);
  });
};

/**
 * Enhanced media session with tracking capabilities
 */
export class MediaSession {
  private static instance: MediaSession | null = null;
  private currentMedia: string | null = null;
  private startTime: number = 0;
  private isPlaying: boolean = false;
  
  static getInstance(): MediaSession {
    if (!MediaSession.instance) {
      MediaSession.instance = new MediaSession();
    }
    return MediaSession.instance;
  }
  
  async playMedia(filePath: string, options: PlayMediaOptions = {}): Promise<PlayMediaResult> {
    this.currentMedia = filePath;
    this.startTime = Date.now();
    this.isPlaying = true;
    
    const result = await playMediaWithTracking(filePath, options);
    
    if (!result.success) {
      this.isPlaying = false;
    }
    
    return result;
  }
  
  stopMedia(): void {
    this.currentMedia = null;
    this.isPlaying = false;
    
    // Attempt to stop VLC if available
    if (window.electronAPI?.stopVLC) {
      window.electronAPI.stopVLC().catch(console.error);
    }
  }
  
  getCurrentMedia(): string | null {
    return this.currentMedia;
  }
  
  getIsPlaying(): boolean {
    return this.isPlaying;
  }
  
  getPlaybackDuration(): number {
    return this.isPlaying ? Date.now() - this.startTime : 0;
  }
}

/**
 * Get the next episode in the series sequence
 * Handles intra-season (E1 -> E2) and inter-season transitions (S1E8 -> S2E1)
 */
export const getNextEpisode = (
  current: { season?: number; episode?: number },
  allEpisodes: Array<{ season?: number; episode?: number }>
): any | null => {
  if (!current.season || !current.episode || !allEpisodes || allEpisodes.length === 0) {
    return null;
  }

  // Sort episodes by season then episode number
  const sorted = [...allEpisodes].sort((a, b) => {
    if (a.season !== b.season) {
      return (a.season || 0) - (b.season || 0);
    }
    return (a.episode || 0) - (b.episode || 0);
  });

  // Find the index of the current episode
  const currentIndex = sorted.findIndex(
    ep => ep.season === current.season && ep.episode === current.episode
  );

  // If not found or it's the last episode
  if (currentIndex === -1 || currentIndex === sorted.length - 1) {
    return null;
  }

  // Return the next episode in the sorted list
  return sorted[currentIndex + 1];
};

// Export singleton instance
export const mediaSession = MediaSession.getInstance();