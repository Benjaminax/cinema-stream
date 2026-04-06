import React, { useState, useEffect, useMemo } from 'react';
import { Tv, RefreshCw, Search, Filter, X, ChevronDown } from 'lucide-react';
import { TMDBResult } from '../types/media';
import { LocalMediaFile } from '../utils/localMedia';
import { searchMedia, getImageUrl, getBackdropUrl, getIMDbRating, getDetails } from '../api/tmdb';
import DetailsModal from '../components/media/DetailsModal';
import { libraryCache } from '../utils/libraryCache';
import { addRecentlyWatched, getRecentlyWatched, getResumeItemByParent, normalizePath } from '../utils/recentlyWatched';
import { playMediaWithTracking } from '../utils/mediaPlayback';
import { GENRE_NAME_MAP } from '../utils/genrePreferences';
import '../types/electron';

// All available genres for filtering from master map
const ALL_GENRES = Object.entries(GENRE_NAME_MAP)
    .filter(([id]) => parseInt(id) >= 10749 || [16, 35, 80, 99, 18, 9648, 37].includes(parseInt(id)))
    .map(([id, name]) => ({ id: parseInt(id), name }));

type SortOption = 'title' | 'rating';

function convertGenreIdsToGenres(genreIds: number[]): Array<{ id: number, name: string }> {
    return genreIds.map(id => ({ id, name: GENRE_NAME_MAP[id] })).filter(g => g.name);
}

const LocalSeries: React.FC = () => {
    const [series, setSeries] = useState<TMDBResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [videosPath, setVideosPath] = useState<string>('');

    // Filter/Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
    const [sortBy, setSortBy] = useState<SortOption>('title');
    const [showFilters, setShowFilters] = useState(false);

    // Helper function to check if a directory name looks like a season folder
    const isSeasonDirectory = (name: string): boolean => {
        const seasonPatterns = [
            /^season\s*\d+$/i,
            /^s\d+$/i,
            /^sea(?:son)?\s*\d+$/i,
            /^series\s*\d+$/i,
            /^volume\s*\d+$/i,
            /^vol\s*\d+$/i,
            /^t\s*\d+$/i, // Tome / Saison
            /^book\s*\d+$/i
        ];
        return seasonPatterns.some((re) => re.test(name.trim()));
    }; 

    useEffect(() => {
        const init = async () => {
            await libraryCache.load();
            await loadLocalSeries();
        };
        init();
    }, []);

    const loadLocalSeries = async (force = false) => {
        try {
            if (!window.electronAPI) {
                console.error('Electron API not available');
                return;
            }

            const isOnline = typeof window !== 'undefined' ? (window.navigator?.onLine ?? true) : true;

            if (force) {
                if (!isOnline) {
                    console.log('🔄 Forced refresh requested but offline — skipping cache clearing and image re-fetch. Will only rescan folders.');
                } else {
                    console.log('🔄 Forced refresh: clearing series cache');
                    libraryCache.clearSeries();
                }
            }

            setLoading(true);

            const vPath = await window.electronAPI.getVideosPath();
            setVideosPath(vPath);
            const seriesFolderPath = `${vPath}/Series`;

            let files: LocalMediaFile[] = [];
            try {
                files = await window.electronAPI.scanDirectory(seriesFolderPath);
            } catch (error) {
                console.error('Failed to scan series directory:', error);
                setSeries([]);
                setLoading(false);
                return;
            }

            const seriesDirectories = files
                .filter(file => file.type === 'directory')
                .filter(dir => !isSeasonDirectory(dir.name));

            const seriesPromises = seriesDirectories.map(async (seriesDir) => {
                try {
                    // Check cache first
                    const cached = libraryCache.getSeries(seriesDir.path);
                    if (cached) {
                        console.log('📦 Found series in cache:', seriesDir.name);
                        // Call setSeries and allow image fetch only when online. Force image refresh if requested.
                        await libraryCache.setSeries(seriesDir.path, cached, { allowImageFetch: isOnline, forceImageRefresh: force && isOnline });
                        return { ...cached };
                    }

                    // If offline, skip TMDB lookups and return a minimal local entry
                    if (!isOnline) {
                        console.log('📴 Offline - skipping TMDB lookup for series:', seriesDir.name);
                        return {
                            id: Date.now(),
                            name: seriesDir.name,
                            local_path: seriesDir.path,
                            modified_date: seriesDir.modified
                        } as TMDBResult;
                    }

                    // Search TMDB if not cached
                    const searchResults = await searchMedia(seriesDir.name, 'tv');
                    const tmdbSeries = searchResults.results?.[0];

                    if (tmdbSeries) {
                        const genres = tmdbSeries.genre_ids ? convertGenreIdsToGenres(tmdbSeries.genre_ids) : [];
                        let imdbData = null;
                        let tmdbEpisodeRuntime = null;
                        try {
                            const details = await getDetails('tv', tmdbSeries.id);
                            if (details.imdb_id) {
                                const rating = await getIMDbRating(details.imdb_id);
                                if (rating) {
                                    imdbData = { rating: parseFloat(rating), votes: 0 };
                                }
                            }
                            if (details.episode_run_time && details.episode_run_time.length > 0) {
                                tmdbEpisodeRuntime = details.episode_run_time[0];
                            }
                        } catch (error) {
                            console.error('Error fetching details:', error);
                        }

                        const seriesData = {
                            ...tmdbSeries,
                            genres,
                            imdb_rating: imdbData?.rating,
                            imdb_votes: undefined,
                            local_path: seriesDir.path,
                            duration: tmdbEpisodeRuntime || undefined,
                            modified_date: seriesDir.modified
                        };

                        // Save to cache (only fetch images when online). If the user requested a refresh, force image refresh as well.
                        await libraryCache.setSeries(seriesDir.path, seriesData, { allowImageFetch: isOnline, forceImageRefresh: force && isOnline });

                        return seriesData;
                    }
                } catch (error) {
                    console.error('Error processing series:', seriesDir.name, error);
                }
                return null;
            });

            const seriesResults = await Promise.all(seriesPromises);
            const validSeries = seriesResults.filter(series => series !== null) as TMDBResult[];

            // Group by TMDB ID to avoid duplicates (e.g. multiple season folders resolving to same show)
            const groupedSeries = new Map<number, TMDBResult>();
            for (const seriesItem of validSeries) {
                if (groupedSeries.has(seriesItem.id)) {
                    const existing = groupedSeries.get(seriesItem.id)!;
                    if (!existing.local_paths) existing.local_paths = [existing.local_path!];
                    if (seriesItem.local_path && !existing.local_paths.includes(seriesItem.local_path)) {
                        existing.local_paths.push(seriesItem.local_path);
                    }
                } else {
                    seriesItem.local_paths = [seriesItem.local_path!];
                    groupedSeries.set(seriesItem.id, seriesItem);
                }
            }

                        // Ensure all series are re-cached to trigger image caching
                        const allowFetch = typeof window !== 'undefined' ? (window.navigator?.onLine ?? true) : true;
                        await Promise.all(Array.from(groupedSeries.values())
                            .filter(s => typeof s.local_path === 'string')
                            .map(s => libraryCache.setSeries(s.local_path as string, s, { allowImageFetch: allowFetch })));

                        // Reload series from cache and update state so UI gets updated image paths
                        const updatedSeries = Object.values(libraryCache["data"]?.series || {});
                        setSeries(updatedSeries);
        } catch (error) {
            console.error('Error loading local series:', error);
            setSeries([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const availableGenres = useMemo(() => {
        const genreSet = new Set<number>();
        series.forEach(s => {
            s.genre_ids?.forEach(id => genreSet.add(id));
            s.genres?.forEach(g => genreSet.add(g.id));
        });
        return ALL_GENRES.filter(g => genreSet.has(g.id));
    }, [series]);

    const filteredSeries = useMemo(() => {
        let result = [...series];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                (s.name?.toLowerCase().includes(query)) ||
                (s.original_name?.toLowerCase().includes(query))
            );
        }

        if (selectedGenres.length > 0) {
            result = result.filter(s => {
                const sGenreIds = s.genre_ids || s.genres?.map(g => g.id) || [];
                return selectedGenres.some(id => sGenreIds.includes(id));
            });
        }

        result.sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return (a.name || '').localeCompare(b.name || '');
                case 'rating':
                    return (b.vote_average || 0) - (a.vote_average || 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [series, searchQuery, selectedGenres, sortBy]);

    const toggleGenre = (genreId: number) => {
        setSelectedGenres(prev =>
            prev.includes(genreId) ? prev.filter(id => id !== genreId) : [...prev, genreId]
        );
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedGenres([]);
        setSortBy('title');
    };

    if (loading) {
        return (
            <div className="p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                        <Tv className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">My Series</h1>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                        <div className="text-white">Scanning for series...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-red-900/10 rounded-full blur-[100px] pointer-events-none z-0" />

            <div className="p-6 md:p-8 relative z-10">
                <div className="max-w-[2400px] mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-end justify-between gap-4 mb-8 relative">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-600/30 rounded-2xl blur-xl"></div>
                                <div className="relative w-16 h-16 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/40">
                                    <Tv className="h-8 w-8 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-5xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                                    My Series
                                </h1>
                                <p className="text-gray-400 mt-2 text-lg flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                                    {series.length} titles in library
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-xs font-semibold text-gray-400 bg-white/5 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
                                {filteredSeries.length} shown
                            </div>
                            <button
                                onClick={() => loadLocalSeries(true)}
                                className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 group backdrop-blur-sm"
                                title="Refresh Library (Force Re-scan)"
                            >
                                <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-700" />
                            </button>
                        </div>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="sticky top-[80px] z-30 transition-all duration-300">
                        <div className="absolute inset-0 bg-red-900/5 blur-xl -z-10 rounded-3xl"></div>
                        <div className="bg-[#0f0f0f]/80 rounded-2xl border border-white/10 p-2 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row gap-3">
                            {/* Search */}
                            <div className="flex-1 relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none"></div>
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within:text-red-500 transition-colors" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search collection..."
                                    className="w-full pl-12 pr-10 py-3.5 bg-transparent border-transparent rounded-xl text-white placeholder-gray-500 focus:outline-none focus:bg-white/5 transition-all font-medium"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex gap-2">
                                <div className="relative min-w-[140px]">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        className="w-full h-full appearance-none pl-4 pr-10 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white focus:outline-none cursor-pointer text-sm font-medium transition-colors"
                                    >
                                        <option value="title" className="bg-gray-900">Title A-Z</option>
                                        <option value="rating" className="bg-gray-900">Rating</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>

                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`px-5 rounded-xl border flex items-center gap-2 font-medium whitespace-nowrap transition-all text-sm ${showFilters || selectedGenres.length > 0
                                        ? 'bg-red-600/20 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <Filter className="h-4 w-4" />
                                    <span>Filters</span>
                                    {selectedGenres.length > 0 && (
                                        <span className="w-5 h-5 flex items-center justify-center bg-red-500 text-white text-[10px] rounded-full ml-1 font-bold">
                                            {selectedGenres.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Expanded Filters */}
                        {showFilters && (
                            <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-gray-400 text-sm font-medium">Filter by Genre</h3>
                                    {(selectedGenres.length > 0) && (
                                        <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300">
                                            Clear all
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availableGenres.map(genre => (
                                        <button
                                            key={genre.id}
                                            onClick={() => toggleGenre(genre.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedGenres.includes(genre.id)
                                                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                                }`}
                                        >
                                            {genre.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {series.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-96 text-center">
                            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-6">
                                <Tv className="h-8 w-8 text-gray-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">No series found</h2>
                            <p className="text-gray-400 mb-6 max-w-md">
                                Create a "Series" folder in your Videos directory and place your TV series folders there.
                            </p>
                            <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5 mb-6">
                                <code className="text-green-400 font-mono text-sm">
                                    {videosPath}/Series
                                </code>
                            </div>
                            <button
                                onClick={() => loadLocalSeries(true)}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors flex items-center gap-2 font-medium"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Refresh
                            </button>
                        </div>
                    ) : filteredSeries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <Search className="h-12 w-12 text-gray-600 mb-4" />
                            <h2 className="text-xl font-semibold text-white mb-2">No matches found</h2>
                            <button
                                onClick={clearFilters}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Clear filters
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6 pb-20">
                            {filteredSeries.map((seriesItem) => (
                                <div
                                    key={seriesItem.id}
                                    className="bg-[#18181b] rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300 cursor-pointer group shadow-lg ring-1 ring-white/5 hover:ring-red-500/50 flex flex-col"
                                    onClick={() => {
                                        setSelectedItem(seriesItem);
                                        setIsModalOpen(true);
                                    }}
                                >
                                    {/* Series poster */}
                                    <div className="aspect-[2/3] relative overflow-hidden bg-gray-900">
                                        {seriesItem.local_poster_path || seriesItem.poster_path ? (
                                            <img
                                                src={seriesItem.local_poster_path || getImageUrl(seriesItem.poster_path, 'w500')}
                                                alt={seriesItem.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                                <Tv className="h-12 w-12 text-gray-700 mb-2" />
                                                <p className="text-sm text-gray-500 font-medium line-clamp-2">
                                                    {seriesItem.name}
                                                </p>
                                            </div>
                                        )}

                                        {/* Rating Badge (Top Right) */}
                                        {seriesItem.vote_average > 0 && (
                                            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg text-xs text-yellow-500 font-bold border border-white/10 flex items-center gap-1">
                                                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                {seriesItem.vote_average.toFixed(1)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Series info */}
                                    <div className="p-4 flex flex-col flex-1">
                                        <h3 className="text-white font-bold text-base md:text-lg mb-2 leading-snug" title={seriesItem.name}>
                                            {seriesItem.name}
                                        </h3>

                                        <div className="flex items-center justify-between mb-3 text-sm text-gray-400 font-medium">
                                            <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                                                {seriesItem.first_air_date ? new Date(seriesItem.first_air_date).getFullYear() : 'Unknown'}
                                            </span>

                                            {/* Rating fallback */}
                                            {seriesItem.vote_average > 0 && (
                                                <span className="bg-gray-900/50 px-1.5 py-0.5 rounded text-gray-500 border border-white/5 text-xs font-bold">
                                                    {seriesItem.vote_average.toFixed(1)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Genres */}
                                        {seriesItem.genres && seriesItem.genres.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-auto">
                                                {seriesItem.genres.slice(0, 2).map(genre => (
                                                    <span
                                                        key={genre.id}
                                                        className="px-3 py-1 bg-gray-800 rounded-full text-[10px] font-semibold text-gray-400 uppercase tracking-wide border border-white/5"
                                                    >
                                                        {genre.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <DetailsModal
                        item={selectedItem}
                        isOpen={isModalOpen}
                        onClose={() => {
                            setIsModalOpen(false);
                            setSelectedItem(null);
                        }}
                        onPlay={async (series) => {
                            if (series.local_path) {
                                // Find most recently watched item in this series folder
                                const resumeItem = getResumeItemByParent(series.local_path);

                                if (resumeItem) {
                                    const resumeProgress = resumeItem.progress ?? 0;
                                    console.log('📌 Resuming series from last episode:', resumeItem.title, 'at', resumeProgress);

                                    // Write tracking immediately on play click
                                    addRecentlyWatched({
                                        ...resumeItem,
                                        progress: resumeProgress
                                    });
                                    
                                    // Use enhanced media playback for series resumption
                                    const result = await playMediaWithTracking(resumeItem.path, {
                                        startTime: resumeProgress,
                                        fullscreen: true,
                                        useVLCTracking: true
                                    });
                                    
                                    if (!result.success && window.electronAPI?.openFile) {
                                        // Fallback to basic openFile
                                        window.electronAPI.openFile(resumeItem.path, resumeProgress);
                                    }
                                } else {
                                    // Fallback: Just open the folder or try to find first episode (folder opening is default)
                                    if (window.electronAPI?.openFile) {
                                        window.electronAPI.openFile(series.local_path);
                                    }
                                }
                            }
                        }}
                        onPlayEpisode={async (episode) => {
                            if (episode.path) {
                                const normalizedPath = normalizePath(episode.path);
                                const existingResume = getRecentlyWatched().find(item => item.path === normalizedPath);
                                const resumeProgress = existingResume?.progress ?? episode.progress ?? 0;

                                // Determine poster path
                                const posterPath = selectedItem?.local_poster_path || (selectedItem?.poster_path ? getImageUrl(selectedItem.poster_path, 'w500') : undefined);
                                const backdropPath = selectedItem?.local_backdrop_path || (selectedItem?.backdrop_path ? getBackdropUrl(selectedItem.backdrop_path, 'w1280') : undefined);
                                const stillPath = episode.local_still_path || (episode.still_path ? getBackdropUrl(episode.still_path, 'w780') : undefined);

                                // Add to recently watched with series context
                                addRecentlyWatched({
                                    id: episode.path,
                                    title: `${selectedItem?.name || selectedItem?.title} - ${episode.title}`,
                                    type: 'episode',
                                    path: episode.path,
                                    season: episode.season,
                                    episode: episode.episode,
                                    poster_path: posterPath,
                                    backdrop_path: backdropPath,
                                    still_path: stillPath,
                                    progress: resumeProgress
                                });

                                // Use enhanced media playback for episodes
                                const result = await playMediaWithTracking(episode.path, {
                                    startTime: resumeProgress,
                                    fullscreen: true,
                                    useVLCTracking: true
                                });
                                
                                if (!result.success && window.electronAPI?.openFile) {
                                    // Fallback to basic openFile
                                    window.electronAPI.openFile(episode.path, resumeProgress);
                                }
                            }
                        }}
                        hideSimilar={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default LocalSeries;
