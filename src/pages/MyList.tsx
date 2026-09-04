import React, { useEffect, useState, useMemo } from 'react';
import { BookmarkPlus, Sparkles, Search as SearchIcon, X, SlidersHorizontal, Film, Tv } from 'lucide-react';
import { getMyList } from '../utils/myList';
import { TMDBResult, Episode } from '../types/media';
import MediaCard from '../components/media/MediaCard';
import DetailsModal from '../components/media/DetailsModal';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NoInternetConnection from '../components/offline/NoInternetConnection';
import { playMediaWithTracking } from '../utils/mediaPlayback';

const MyList: React.FC = () => {
    const [list, setList] = useState<TMDBResult[]>([]);
    const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
    const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'title'>('recent');
    const { isOnline, retry } = useNetworkStatus();

    useEffect(() => {
        const load = () => setList(getMyList());
        load();
        window.addEventListener('my-list-updated', load);
        return () => window.removeEventListener('my-list-updated', load);
    }, []);

    const handlePlay = async (item: TMDBResult | Episode) => {
        if ('file_path' in item && item.file_path) {
            const result = await playMediaWithTracking(item.file_path, {
                startTime: (item as any).progress,
                fullscreen: true,
                useVLCTracking: true
            });

            if (!result.success && window.electronAPI?.openFile) {
                window.electronAPI.openFile(item.file_path, (item as any).progress);
            }
        } else if ('local_path' in item && item.local_path) {
            // Use enhanced media playback with VLC tracking
            const result = await playMediaWithTracking(item.local_path, {
                fullscreen: true,
                useVLCTracking: true
            });
            
            if (!result.success && window.electronAPI?.openFile) {
                // Fallback to basic openFile
                window.electronAPI.openFile(item.local_path);
            }
        } else {
            const isEpisode = 'season' in item && 'episode' in item;
            const title = isEpisode
                ? ((item as any).seriesTitle || selectedItem?.name || selectedItem?.title || item.title || '')
                : ((item as TMDBResult).title || (item as TMDBResult).name || '');
            const searchUrl = `https://yflix.to/browser?keyword=${title.trim().replace(/\s+/g, '+')}`;
            if (window.electronAPI?.openYFlixWindow) {
                window.electronAPI.openYFlixWindow(searchUrl, title);
            } else if (window.electronAPI?.openExternal) {
                window.electronAPI.openExternal(searchUrl);
            } else {
                window.open(searchUrl, '_blank');
            }
        }
    };

    const moviesCount = useMemo(
        () => list.filter(item => item.media_type === 'movie' || (!item.media_type && !item.name && item.title)).length,
        [list]
    );

    const tvCount = useMemo(
        () => list.filter(item => item.media_type === 'tv' || (!item.media_type && Boolean(item.name))).length,
        [list]
    );

    const filteredList = useMemo(() => {
        let result = [...list];

        // Filter by type
        if (filterType !== 'all') {
            result = result.filter(item => {
                if (filterType === 'movie') {
                    return item.media_type === 'movie' || (!item.media_type && !item.name && item.title);
                }
                return item.media_type === 'tv' || (!item.media_type && Boolean(item.name));
            });
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(item => {
                const title = (item.title || item.name || '').toLowerCase();
                const originalTitle = (item.original_title || item.original_name || '').toLowerCase();
                const overview = (item.overview || '').toLowerCase();
                return title.includes(q) || originalTitle.includes(q) || overview.includes(q);
            });
        }

        // Sort
        if (sortBy === 'rating') {
            result.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        } else if (sortBy === 'title') {
            result.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
        }

        return result;
    }, [list, filterType, searchQuery, sortBy]);

    // Show offline page if not connected
    if (!isOnline) {
        return <NoInternetConnection onRetry={retry} />;
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-red-900/15 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-purple-900/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 p-6 md:p-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-600/30 rounded-2xl blur-xl"></div>
                            <div className="relative w-16 h-16 bg-gradient-to-br from-red-600 to-red-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-900/40">
                                <BookmarkPlus className="h-8 w-8 text-white" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text">
                                My List
                            </h1>
                            <p className="text-gray-400 mt-1 text-sm md:text-base flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                                {list.length} {list.length === 1 ? 'title' : 'titles'} in your personal collection
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search & Filter Toolbar */}
                {list.length > 0 && (
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-white/[0.03] border border-white/[0.08] p-4 rounded-2xl backdrop-blur-md">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search your saved titles..."
                                className="w-full pl-10 pr-10 py-2.5 bg-white/5 hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/10 focus:border-red-500/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Filter Chips & Sorting */}
                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
                            {/* Filter Tabs */}
                            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        filterType === 'all'
                                            ? 'bg-red-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    All ({list.length})
                                </button>
                                <button
                                    onClick={() => setFilterType('movie')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        filterType === 'movie'
                                            ? 'bg-red-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <Film className="w-3.5 h-3.5" />
                                    Movies ({moviesCount})
                                </button>
                                <button
                                    onClick={() => setFilterType('tv')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                        filterType === 'tv'
                                            ? 'bg-red-600 text-white shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <Tv className="w-3.5 h-3.5" />
                                    Series ({tvCount})
                                </button>
                            </div>

                            {/* Sort Selector */}
                            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-gray-400">
                                <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-transparent text-gray-200 focus:outline-none cursor-pointer py-1 text-xs"
                                >
                                    <option value="recent" className="bg-[#121215] text-white">Recently Added</option>
                                    <option value="rating" className="bg-[#121215] text-white">Highest Rated</option>
                                    <option value="title" className="bg-[#121215] text-white">Title (A-Z)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {list.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-500">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-red-600/20 rounded-full blur-3xl"></div>
                            <div className="relative w-32 h-32 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                                <BookmarkPlus className="h-14 w-14 text-gray-600" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-3">Your Collection Awaits</h3>
                        <p className="text-gray-400 text-lg text-center max-w-md leading-relaxed mb-6">
                            Start building your personal library by adding movies and shows you love
                        </p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                            <Sparkles className="h-4 w-4 text-red-500" />
                            <span>Click the bookmark icon on any title to add it here</span>
                        </div>
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                            <SearchIcon className="h-7 w-7 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">No Matching Titles</h3>
                        <p className="text-gray-400 text-sm max-w-sm text-center mb-6">
                            No titles in your list match "{searchQuery}"
                            {filterType !== 'all' ? ` in ${filterType === 'movie' ? 'Movies' : 'TV Shows'}` : ''}.
                        </p>
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setFilterType('all');
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-red-900/40"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        {filteredList.map((item, index) => (
                            <div
                                key={item.id}
                                className="animate-in fade-in zoom-in duration-500"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <MediaCard
                                    item={item}
                                    onClick={(item) => {
                                        setSelectedItem(item);
                                        setIsModalOpen(true);
                                    }}
                                    onPlay={handlePlay}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <DetailsModal
                    item={selectedItem}
                    isOpen={isModalOpen}
                    onClose={() => {
                        setSelectedItem(null);
                        setIsModalOpen(false);
                    }}
                    onPlay={handlePlay}
                    onPlayEpisode={handlePlay}
                    forceFetchEpisodes={true}
                />
            </div>
        </div>
    );
};

export default MyList;
