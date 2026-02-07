import { updateRecentlyWatchedProgress } from './recentlyWatched';

export const initPlaybackTracker = () => {
    if (window.electronAPI && typeof window.electronAPI.on === 'function') {
        window.electronAPI.on('playback-progress', (_event: any, data: { path: string; time: number; length: number }) => {
            console.log('🔄 Playback progress received:', data);

            // If watched > 95%, mark as finished (set progress to 0 or very small)
            const isFinished = data.length > 0 && data.time > data.length * 0.95;
            updateRecentlyWatchedProgress(data.path, isFinished ? 0 : data.time, data.length);
        });
    }
};
