import { updateRecentlyWatchedProgress } from './recentlyWatched';

export const initPlaybackTracker = () => {
    if (window.electronAPI && typeof window.electronAPI.on === 'function') {
        window.electronAPI.on('playback-progress', (_event: any, data: { path: string; time: number; length: number; state?: string; position?: number }) => {
            console.log('🔄 Playback progress received:', data);

            // Only update progress if media is actually playing or paused
            if (!data.state || data.state === 'playing' || data.state === 'paused') {
                // If watched > 95%, mark as finished (set progress to 0 or very small)
                const isFinished = data.length > 0 && data.time > data.length * 0.95;
                updateRecentlyWatchedProgress(data.path, isFinished ? 0 : data.time, data.length);
            }

            // Emit a custom event for other components to listen to
            window.dispatchEvent(new CustomEvent('vlc-playback-progress', {
                detail: data
            }));
        });
        
        console.log('✅ VLC Playback Tracker initialized with enhanced progress monitoring');
    } else {
        console.warn('⚠️ ElectronAPI not available - VLC tracking disabled');
    }
};