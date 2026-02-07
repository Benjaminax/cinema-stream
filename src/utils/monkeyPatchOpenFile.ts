import { addRecentlyWatched, getRecentlyWatched, getResumeItemByParent, normalizePath } from './recentlyWatched';
import { libraryCache } from './libraryCache';

// Safely wrap the global openFile API so that any call to open a file
// records a simple recently-watched entry (uses filename as title).
export const patchOpenFile = () => {
  try {
    const api: any = (window as any).electronAPI;
    if (!api || !api.openFile) return;

    const original = api.openFile.bind(api);

    api.openFile = async (filePath: string, startTime?: number) => {
      try {
        const history = getRecentlyWatched();
        const normalizedInputPath = normalizePath(filePath);
        let existing = history.find(h => h.path === normalizedInputPath);
        let finalPath = filePath;

        // 1. Scan for resume point (Check exact match or parent show directory)
        if (!existing) {
          const resumeItem = getResumeItemByParent(filePath);
          if (resumeItem) {
            console.log('📂 Series directory detected, resuming last episode:', resumeItem.title);
            finalPath = resumeItem.path;
            existing = resumeItem;
          }
        }

        // 2. Determine Resume Time
        let resumeTime = startTime;
        if (resumeTime === undefined && existing && existing.progress) {
          console.log('🔄 Auto-resuming', finalPath, 'from', existing.progress);
          resumeTime = existing.progress;
        }

        // 3. Ensure History Entry Exists (BEFORE opening)
        try {
          if (existing && existing.poster_path && finalPath === filePath) {
            // Just refresh/touch the existing entry (only if path matches exactly)
            addRecentlyWatched(existing);
          } else {
            // Try to find full metadata in library cache
            await libraryCache.load();
            const cachedMovie = libraryCache.getMovie(finalPath);

            // For series, we might need a more complex lookup since key is often a dir
            // but let's try a simple title-based extraction first
            const fileName = finalPath.split(/[/\\]/).pop() || finalPath;
            const isEpisode = /s\d+e\d+/i.test(fileName) || /\d+x\d+/.test(fileName);

            let season, episode;
            if (isEpisode) {
              const match = fileName.match(/s(\d+)e(\d+)/i) || fileName.match(/(\d+)x(\d+)/);
              if (match) { season = parseInt(match[1]); episode = parseInt(match[2]); }
            }

            if (cachedMovie) {
              addRecentlyWatched({
                id: cachedMovie.id,
                title: cachedMovie.title || cachedMovie.name || fileName,
                type: 'movie',
                path: finalPath,
                poster_path: cachedMovie.local_poster_path || (cachedMovie.poster_path ? `https://image.tmdb.org/t/p/w500${cachedMovie.poster_path}` : undefined),
                backdrop_path: cachedMovie.local_backdrop_path || (cachedMovie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${cachedMovie.backdrop_path}` : undefined)
              });
            } else {
              // Try to find if this file belongs to a cached series
              const cachedSeries = libraryCache.getSeriesByFilePath(finalPath);

              if (cachedSeries) {
                const title = fileName
                  .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i, '')
                  .replace(/[._-]+/g, ' ')
                  .trim();

                // Try to find if this specific episode is cached
                const cachedEpisode = season !== undefined && episode !== undefined
                  ? libraryCache.getEpisode(cachedSeries.local_path!, season, episode)
                  : null;

                addRecentlyWatched({
                  id: cachedSeries.id,
                  title: `${cachedSeries.name || cachedSeries.title} - ${title}`,
                  type: 'episode',
                  path: finalPath,
                  season,
                  episode,
                  poster_path: cachedSeries.local_poster_path || (cachedSeries.poster_path ? `https://image.tmdb.org/t/p/w500${cachedSeries.poster_path}` : undefined),
                  backdrop_path: cachedSeries.local_backdrop_path || (cachedSeries.backdrop_path ? `https://image.tmdb.org/t/p/w1280${cachedSeries.backdrop_path}` : undefined),
                  still_path: cachedEpisode?.local_still_path || (cachedEpisode?.still_path ? `https://image.tmdb.org/t/p/w780${cachedEpisode.still_path}` : undefined)
                });
              } else {
                // Create a basic entry if not found in cache
                const title = fileName
                  .replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i, '')
                  .replace(/[._-]+/g, ' ')
                  .trim();

                addRecentlyWatched({
                  id: finalPath,
                  title,
                  type: isEpisode ? 'episode' : 'other',
                  path: finalPath,
                  season,
                  episode
                });
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ Patch error during pre-add:', e);
        }

        // 3. Call original behavior (VLC or shell)
        await original(finalPath, resumeTime);
      } catch (err) {
        console.error('Error invoking openFile:', err);
      }
    };
  } catch (e) {
    console.error('Failed to patch openFile:', e);
  }
};

// auto-run on import
patchOpenFile();
