import { TMDBResult } from '../types/media';
import { normalizePath } from './recentlyWatched';

interface EpisodeCacheEntry {
    season: number;
    episode: number;
    overview?: string;
    runtime?: number;
    air_date?: string;
    tmdb_id?: number;
    still_path?: string | null;
    local_still_path?: string;
    title?: string;
}

interface CacheData {
    movies: Record<string, TMDBResult>; // key is file path
    series: Record<string, TMDBResult>; // key is directory path
    episodes: Record<string, EpisodeCacheEntry>; // key is seriesPath + season/episode
    version: number;
}

const CACHE_VERSION = 3;

class LibraryCache {
    private data: CacheData = {
        movies: {},
        series: {},
        episodes: {},
        version: CACHE_VERSION
    };
    private isLoaded = false;

    async load() {
        if (this.isLoaded) return;

        if (window.electronAPI?.loadLibraryCache) {
            const cached = await window.electronAPI.loadLibraryCache();
            if (cached && cached.version === CACHE_VERSION) {
                this.data = cached;
            }
        }
        this.isLoaded = true;
    }

    async save() {
        if (window.electronAPI?.saveLibraryCache) {
            await window.electronAPI.saveLibraryCache(this.data);
        }
    }

    private buildEpisodeKey(seriesPath: string, season: number, episode: number) {
        return `${normalizePath(seriesPath)}::S${season}E${episode}`;
    }

    getMovie(path: string): TMDBResult | null {
        return this.data.movies[normalizePath(path)] || null;
    }

    getSeries(path: string): TMDBResult | null {
        return this.data.series[normalizePath(path)] || null;
    }

    getSeriesByFilePath(filePath: string): TMDBResult | null {
        const normalized = normalizePath(filePath);
        const entry = Object.entries(this.data.series).find(([dirPath]) => normalized.startsWith(normalizePath(dirPath)));
        return entry ? entry[1] : null;
    }

    getEpisode(seriesPath: string, season: number, episode: number): EpisodeCacheEntry | null {
        const key = this.buildEpisodeKey(seriesPath, season, episode);
        return this.data.episodes[key] || null;
    }

    async setMovie(path: string, result: TMDBResult) {
        const normalized = normalizePath(path);
        const enrichedResult = await this.cacheImages(result);
        this.data.movies[normalized] = enrichedResult;
        await this.save();
    }

    async setSeries(path: string, result: TMDBResult) {
        const normalized = normalizePath(path);
        const enrichedResult = await this.cacheImages(result);
        this.data.series[normalized] = enrichedResult;
        await this.save();
    }

    async updateMetadata(id: number, type: 'movie' | 'series', metadata: Partial<TMDBResult>) {
        // Find by ID since path might not be available or consistent
        const list = type === 'movie' ? this.data.movies : this.data.series;
        const entry = Object.entries(list).find(([_, item]) => item.id === id);

        if (entry) {
            const [path, item] = entry;
            list[path] = { ...item, ...metadata };
            await this.save();
        }
    }

    async setEpisode(seriesPath: string, season: number, episode: number, data: EpisodeCacheEntry): Promise<EpisodeCacheEntry> {
        const key = this.buildEpisodeKey(seriesPath, season, episode);
        const enriched = await this.cacheEpisodeStill(data);
        const finalEntry = { ...data, ...enriched, season, episode };
        this.data.episodes[key] = finalEntry;
        await this.save();
        return finalEntry;
    }

    /**
     * Checks if a cached result is missing local images and tries to fetch them
     */
    async ensureImagesCached(path: string, type: 'movie' | 'series'): Promise<TMDBResult | null> {
        const list = type === 'movie' ? this.data.movies : this.data.series;
        const item = list[path];
        if (!item) return null;

        const needsPoster = item.poster_path && (!item.local_poster_path || item.local_poster_path.startsWith('file://'));
        const needsBackdrop = item.backdrop_path && (!item.local_backdrop_path || item.local_backdrop_path.startsWith('file://'));

        if (needsPoster || needsBackdrop) {
            console.log(`♻️ Retrying image cache for: ${item.title || item.name}`);
            const updated = await this.cacheImages(item);
            list[path] = updated;
            await this.save();
            return updated;
        }

        return item;
    }

    private async cacheImages(result: TMDBResult): Promise<TMDBResult> {
        const updated = { ...result };

        if (window.electronAPI?.downloadImage) {
            // Cache poster if missing local path or using old file:// protocol
            if (result.poster_path && (!result.local_poster_path || result.local_poster_path.startsWith('file://'))) {
                const posterUrl = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
                const fileName = `poster_${result.id}_w500.jpg`;
                console.log(`🖼️ Downloading poster for ${result.title || result.name}: ${posterUrl}`);
                const localPath = await window.electronAPI.downloadImage(posterUrl, fileName);
                if (localPath) {
                    updated.local_poster_path = `mediaflix://load?path=${encodeURIComponent(localPath)}`;
                    console.log(`✅ Cached poster: ${updated.local_poster_path}`);
                }
            }

            // Cache backdrop if missing local path or using old file:// protocol
            if (result.backdrop_path && (!result.local_backdrop_path || result.local_backdrop_path.startsWith('file://'))) {
                const backdropUrl = `https://image.tmdb.org/t/p/w1280${result.backdrop_path}`;
                const fileName = `backdrop_${result.id}_w1280.jpg`;
                console.log(`🖼️ Downloading backdrop for ${result.title || result.name}: ${backdropUrl}`);
                const localPath = await window.electronAPI.downloadImage(backdropUrl, fileName);
                if (localPath) {
                    updated.local_backdrop_path = `mediaflix://load?path=${encodeURIComponent(localPath)}`;
                    console.log(`✅ Cached backdrop: ${updated.local_backdrop_path}`);
                }
            }
        }

        return updated;
    }

    private async cacheEpisodeStill(entry: EpisodeCacheEntry): Promise<EpisodeCacheEntry> {
        const updated: EpisodeCacheEntry = { ...entry };

        if (window.electronAPI?.downloadImage && entry.still_path) {
            const needsStill = !entry.local_still_path || entry.local_still_path.startsWith('file://');
            if (needsStill) {
                const safeEpisodeId = entry.tmdb_id ?? `${entry.season}-${entry.episode}`;
                const stillUrl = `https://image.tmdb.org/t/p/w780${entry.still_path}`;
                const fileName = `episode_${safeEpisodeId}_s${entry.season}e${entry.episode}_w780.jpg`;
                try {
                    const localPath = await window.electronAPI.downloadImage(stillUrl, fileName);
                    if (localPath) {
                        updated.local_still_path = `mediaflix://load?path=${encodeURIComponent(localPath)}`;
                    }
                } catch (error) {
                    console.warn('Failed to cache episode still:', error);
                }
            }
        }

        return updated;
    }

    clearMovies() {
        this.data.movies = {};
        this.save();
    }

    clearSeries() {
        this.data.series = {};
        // Also clear episodes when clearing series
        this.data.episodes = {};
        this.save();
    }

    clear() {
        this.data = {
            movies: {},
            series: {},
            episodes: {},
            version: CACHE_VERSION
        };
        this.save();
    }
}

export const libraryCache = new LibraryCache();
