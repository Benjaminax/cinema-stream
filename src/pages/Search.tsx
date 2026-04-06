import React, { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import MediaCard from '../components/media/MediaCard';
import DetailsModal from '../components/media/DetailsModal';
import { TMDBResult, Episode } from '../types/media';
import { searchMedia, getImageUrl } from '../api/tmdb';
import { addRecentlyWatched } from '../utils/recentlyWatched';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NoInternetConnection from '../components/offline/NoInternetConnection';
import { playMediaWithTracking } from '../utils/mediaPlayback';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchType, setSearchType] = useState<'movie' | 'tv' | 'multi'>('multi');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [autoPlayTrailer, setAutoPlayTrailer] = useState(false);
  const { isOnline, retry } = useNetworkStatus();

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentSearches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate that all items are strings
          const validSearches = parsed.filter(search => typeof search === 'string' && search.trim());
          if (validSearches.length > 0) {
            setRecentSearches(validSearches);
          }
        }
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('recentSearches');
      } catch (clearError) {
        console.error('Error clearing corrupted recent searches:', clearError);
      }
    }
  }, []);

  // Save search to recent searches
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery || typeof searchQuery !== 'string') return;

    try {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery || trimmedQuery.length > 100) return; // Prevent extremely long searches

      setRecentSearches(prev => {
        try {
          // Remove if already exists, then add to beginning
          const filtered = prev.filter(search => search !== trimmedQuery);
          const updated = [trimmedQuery, ...filtered].slice(0, 10); // Keep only 10 recent searches
          localStorage.setItem('recentSearches', JSON.stringify(updated));
          return updated;
        } catch (error) {
          console.error('Error updating recent searches:', error);
          return prev; // Return previous state if update fails
        }
      });
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }, []);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (!isOnline) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await searchMedia(searchQuery, searchType === 'multi' ? undefined : searchType);

      // Ensure we have valid results
      if (searchResults && searchResults.results && Array.isArray(searchResults.results)) {
        setResults(searchResults.results);
        // Save to recent searches
        // Save to recent searches removed from here (moved to explicit actions)
      } else {
        console.warn('Invalid search results format:', searchResults);
        setResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchType]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch(query);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [query, handleSearch]);

  const handleCardClick = (item: TMDBResult) => {
    if (!item) return;
    saveRecentSearch(query); // Save search when result is clicked
    setSelectedItem(item);
    setAutoPlayTrailer(false); // Don't auto-play trailer for "more info" clicks
    setIsModalOpen(true);
  };

  const handlePlay = async (item: TMDBResult | Episode) => {
    if (!item) return;
    saveRecentSearch(query); // Save search when played

    // Check if it's an episode with a file path
    if ('file_path' in item && item.file_path) {
      // Play the episode file directly
      const seriesTitle = (item as any).seriesTitle || (selectedItem?.name || selectedItem?.title || 'Unknown Series');

      addRecentlyWatched({
        id: item.file_path,
        title: `${seriesTitle} - ${item.title}`,
        type: 'episode',
        path: item.file_path,
        season: item.season,
        episode: item.episode,
        poster_path: selectedItem?.local_poster_path || (selectedItem?.poster_path ? getImageUrl(selectedItem.poster_path, 'w500') : undefined),
        backdrop_path: selectedItem?.local_backdrop_path || (selectedItem?.backdrop_path ? getImageUrl(selectedItem.backdrop_path, 'original') : undefined),
        still_path: (item as any).local_still_path || (item as any).still_path
      });

      // Use enhanced media playback for episodes
      const result = await playMediaWithTracking(item.file_path, {
        startTime: (item as any).progress,
        fullscreen: true,
        useVLCTracking: true
      });
      
      if (!result.success && window.electronAPI?.openFile) {
        // Fallback to basic openFile
        window.electronAPI.openFile(item.file_path, (item as any).progress);
      }
    } else if ('local_path' in item && item.local_path) {
      // For series/movies with local path, add to recently watched and open
      const posterPath = item.local_poster_path || (item.poster_path ? getImageUrl(item.poster_path, 'w500') : undefined);
      const backdropPath = item.local_backdrop_path || (item.backdrop_path ? getImageUrl(item.backdrop_path, 'original') : undefined);

      addRecentlyWatched({
        id: item.id,
        title: item.title || item.name || 'Unknown',
        type: (item.first_air_date || item.media_type === 'tv') ? 'tv' : 'movie',
        path: item.local_path,
        poster_path: posterPath,
        backdrop_path: backdropPath
      });

      // Use enhanced media playback for local content
      const result = await playMediaWithTracking(item.local_path, {
        startTime: (item as any).progress,
        fullscreen: true,
        useVLCTracking: true
      });
      
      if (!result.success && window.electronAPI?.openFile) {
        // Fallback to basic openFile
        window.electronAPI.openFile(item.local_path, (item as any).progress);
      }
    } else {
      const isEpisode = 'season' in item && 'episode' in item;
      const title = isEpisode
        ? ((item as any).seriesTitle || selectedItem?.name || selectedItem?.title || item.title || '')
        : ((item as TMDBResult).title || (item as TMDBResult).name || '');
      const searchUrl = `https://yflix.to/browser?keyword=${title.trim().replace(/\s+/g, '+')}`;
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(searchUrl);
      } else {
        window.open(searchUrl, '_blank');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setAutoPlayTrailer(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  const handleRecentSearchClick = async (searchTerm: string) => {
    if (!searchTerm || typeof searchTerm !== 'string') return;
    setQuery(searchTerm);
    setShowRecentSearches(false);
    await handleSearch(searchTerm);
  };

  const clearRecentSearches = useCallback(() => {
    try {
      setRecentSearches([]);
      localStorage.removeItem('recentSearches');
    } catch (error) {
      console.error('Error clearing recent searches:', error);
      // Still try to clear the state even if localStorage fails
      setRecentSearches([]);
    }
  }, []);

  return (
    <>
      {!isOnline ? (
        <NoInternetConnection onRetry={retry} />
      ) : (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-red-900/20 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Content */}
      <div className="relative z-10 px-6 md:px-10 py-8 flex flex-col items-center min-h-screen">

        {/* Compact Search Section */}
        <div className={`w-full max-w-3xl transition-all duration-500 flex flex-col items-center ${results.length > 0 ? 'mt-0 mb-8' : 'mt-[12vh]'}`}>
          <h1 className={`text-3xl md:text-4xl font-bold mb-6 tracking-tight text-center transition-all duration-500 ${results.length > 0 ? 'scale-75 opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100'}`}>
            Find your next story
          </h1>

          {/* Compact Search Bar */}
          <div className="w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-red-900 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-700 group-focus-within:opacity-60"></div>
            <div className="relative bg-[#0a0a0a] rounded-xl border border-white/10 shadow-xl overflow-hidden flex items-center">
              <SearchIcon className={`absolute left-4 h-5 w-5 transition-colors ${query ? 'text-red-500' : 'text-gray-500'}`} />
              <input
                type="text"
                value={query || ''}
                onChange={(e) => {
                  try {
                    setQuery(e.target.value);
                  } catch (error) {
                    console.error('Error updating query:', error);
                  }
                }}
                onFocus={() => {
                  try {
                    setShowRecentSearches(true);
                  } catch (error) {
                    console.error('Error showing recent searches:', error);
                  }
                }}
                onBlur={() => setTimeout(() => {
                  try {
                    setShowRecentSearches(false);
                  } catch (error) {
                    console.error('Error hiding recent searches:', error);
                  }
                }, 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(query);
                    saveRecentSearch(query);
                    setShowRecentSearches(false); // Hide the dropdown
                  }
                }}
                placeholder="Movies, TV shows, genres..."
                className="w-full bg-transparent text-white text-base py-3.5 pl-12 pr-12 placeholder-gray-600 focus:outline-none font-medium"
              />
              {query && (
                <button
                  onClick={() => {
                    try {
                      clearSearch();
                    } catch (error) {
                      console.error('Error clearing search:', error);
                    }
                  }}
                  className="absolute right-6 p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Recent Searches Dropdown */}
            {showRecentSearches && recentSearches && recentSearches.length > 0 && !query && (
              <div className="absolute top-full left-0 right-0 mt-4 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Recent</span>
                  <button
                    onMouseDown={() => {
                      try {
                        clearRecentSearches();
                      } catch (error) {
                        console.error('Error clearing recent searches:', error);
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Clear History
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {recentSearches
                    .filter(search => search && typeof search === 'string' && search.trim())
                    .map((search, index) => (
                      <button
                        key={`${search}-${index}`}
                        onMouseDown={() => {
                          try {
                            handleRecentSearchClick(search);
                          } catch (error) {
                            console.error('Error handling recent search click:', error);
                          }
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-white/5 transition-colors flex items-center gap-4 group"
                      >
                        <SearchIcon className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors" />
                        <span className="text-gray-300 group-hover:text-white text-lg">{search}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex gap-4 mt-8">
            {[
              { id: 'multi', label: 'All Results' },
              { id: 'movie', label: 'Movies' },
              { id: 'tv', label: 'TV Shows' }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  try {
                    setSearchType(type.id as 'multi' | 'movie' | 'tv');
                  } catch (error) {
                    console.error('Error setting search type:', error);
                  }
                }}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border ${searchType === type.id
                  ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                  : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
                  }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        <div className="w-full max-w-[2000px] mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-0 animate-in fade-in duration-700 fill-mode-forwards">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-6 text-gray-400 text-lg animate-pulse">Searching the database...</p>
            </div>
          ) : results && results.length > 0 ? (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h2 className="text-xl font-semibold mb-6 text-white/90 pl-2 border-l-4 border-red-600">
                Results found for "<span className="text-white">{query}</span>"
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {results
                  .filter(item => item && (item.id || item.title || item.name))
                  .map((item, index) => (
                    <div key={item.id || Math.random()} className="animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${index * 30}ms` }}>
                      <MediaCard
                        item={item}
                        onClick={(item) => {
                          try {
                            handleCardClick(item);
                          } catch (error) {
                            console.error('Error handling card click:', error);
                          }
                        }}
                        onPlay={(item) => {
                          try {
                            handlePlay(item);
                          } catch (error) {
                            console.error('Error handling play:', error);
                          }
                        }}
                        className="w-full"
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : query && !loading ? (
            <div className="text-center py-16 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <SearchIcon className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No matches found</h3>
              <p className="text-gray-400 text-sm">We couldn't find anything matching "{query}"</p>
            </div>
          ) : null}
        </div>
      </div>

      <DetailsModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => {
          try {
            handleCloseModal();
          } catch (error) {
            console.error('Error closing modal:', error);
          }
        }}
        autoPlayTrailer={autoPlayTrailer}
        onPlay={(item) => {
          try {
            handlePlay(item);
          } catch (error) {
            console.error('Error handling play from modal:', error);
          }
        }}
        onPlayEpisode={(ep) => {
          try {
            handlePlay(ep);
          } catch (error) {
            console.error('Error handling play episode from modal:', error);
          }
        }}
        forceFetchEpisodes={true}
      />
        </div>
      )}
    </>
  );
};

export default Search;