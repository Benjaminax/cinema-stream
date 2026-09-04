import React, { useState, useMemo } from 'react';
import { X, Search, Star, Film, Calendar, SlidersHorizontal, Bookmark, BookmarkCheck } from 'lucide-react';
import { Franchise } from '../../types/media';
import { getImageUrl } from '../../api/tmdb';

interface FranchisesExplorerModalProps {
  franchises: Franchise[];
  isOpen: boolean;
  onClose: () => void;
  onSelectFranchise: (franchise: Franchise) => void;
  bookmarkedIds?: Set<number>;
  onToggleBookmark?: (e: React.MouseEvent, id: number) => void;
}

const AVAILABLE_GENRES = [
  'All',
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Family',
  'Fantasy',
  'Horror',
  'Sci-Fi',
  'Thriller',
];

type SortOption = 'popular' | 'rating' | 'titles' | 'title_asc';

const FranchisesExplorerModal: React.FC<FranchisesExplorerModalProps> = ({
  franchises,
  isOpen,
  onClose,
  onSelectFranchise,
  bookmarkedIds,
  onToggleBookmark
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  const filteredFranchises = useMemo(() => {
    let list = [...franchises];

    // Filter by genre
    if (selectedGenre !== 'All') {
      list = list.filter((f) => {
        if (!f.genres || f.genres.length === 0) return true;
        return f.genres.some((g) => g.toLowerCase() === selectedGenre.toLowerCase());
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.displayTitle.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          (f.tagline && f.tagline.toLowerCase().includes(q)) ||
          (f.overview && f.overview.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      switch (sortBy) {
        case 'rating': {
          const rA = parseFloat(a.avgRating) || 0;
          const rB = parseFloat(b.avgRating) || 0;
          return rB - rA;
        }
        case 'titles':
          return b.titlesCount - a.titlesCount;
        case 'title_asc':
          return a.displayTitle.localeCompare(b.displayTitle);
        case 'popular':
        default:
          return (b.totalVotes || 0) - (a.totalVotes || 0);
      }
    });

    return list;
  }, [franchises, selectedGenre, searchQuery, sortBy]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] bg-[#0d0e12] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-6 md:p-8 border-b border-white/10 bg-gradient-to-r from-red-950/20 via-transparent to-transparent flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-500 mb-1">
                <Film className="w-4 h-4" />
                <span>Cinematic Universes</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                All Featured Franchises
              </h1>
              <p className="text-xs md:text-sm text-gray-400 mt-1">
                Explore iconic film sagas, trilogies, and multi-part franchises ({franchises.length} collections)
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 hover:text-white transition-all hover:scale-105 flex-shrink-0"
              aria-label="Close franchises modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls: Search and Sort */}
          <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search franchises by name or story..."
                className="w-full pl-10 pr-10 py-2.5 bg-white/5 hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/10 focus:border-red-500/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Sort:
              </span>
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                {[
                  { id: 'popular', label: 'Popular' },
                  { id: 'rating', label: 'Rating' },
                  { id: 'titles', label: 'Titles' },
                  { id: 'title_asc', label: 'A-Z' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id as SortOption)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      sortBy === s.id
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Genre Filter Chips */}
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {AVAILABLE_GENRES.map((genre) => {
              const isActive = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 border ${
                    isActive
                      ? 'bg-white text-black border-white shadow-md'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body: Franchises Grid */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-custom">
          {filteredFranchises.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Film className="w-7 h-7 text-gray-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">No Franchises Found</h3>
              <p className="text-xs md:text-sm text-gray-400 max-w-sm mx-auto">
                We couldn't find any franchise matching "{searchQuery}" in {selectedGenre}.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGenre('All');
                }}
                className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFranchises.map((item) => {
                const isBookmarked = bookmarkedIds ? bookmarkedIds.has(item.id) : false;
                const displayPosters =
                  item.posters && item.posters.length > 0
                    ? item.posters.slice(0, 3)
                    : item.parts
                        .map((p) => p.poster_path)
                        .filter((p): p is string => Boolean(p))
                        .slice(0, 3);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onClose();
                      onSelectFranchise(item);
                    }}
                    className="group bg-[#15161b] hover:bg-[#1a1b22] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] relative overflow-hidden"
                  >
                    {/* Top Row: Title, Bookmark & Genres */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-bold text-white tracking-tight truncate group-hover:text-red-400 transition-colors">
                            {item.displayTitle}
                          </h3>
                          {item.genres && item.genres.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {item.genres.slice(0, 3).map((g) => (
                                <span
                                  key={g}
                                  className="text-[10px] uppercase font-semibold tracking-wider text-red-400/90 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded-full"
                                >
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {onToggleBookmark && (
                          <button
                            onClick={(e) => onToggleBookmark(e, item.id)}
                            className={`p-1.5 rounded-full border transition-all duration-200 flex-shrink-0 ${
                              isBookmarked
                                ? 'bg-red-600/20 border-red-500/50 text-red-500'
                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                            }`}
                            title={isBookmarked ? 'Remove bookmark' : 'Bookmark franchise'}
                            aria-label="Bookmark franchise"
                          >
                            {isBookmarked ? (
                              <BookmarkCheck className="w-4 h-4 fill-current" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Tagline / Overview */}
                      <p className="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed font-normal">
                        {item.tagline || item.overview}
                      </p>
                    </div>

                    {/* Bottom Row: Fanned Posters & Stats */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                      {/* Stats */}
                      <div className="space-y-1 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5 text-red-500" />
                          <span className="font-semibold text-white">{item.titlesCount} Titles</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-400" />
                          <span>{item.yearRange}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{item.avgRating} avg</span>
                        </div>
                      </div>

                      {/* Overlapping Poster Stack */}
                      <div className="relative flex items-center h-20 w-28 justify-end flex-shrink-0">
                        {displayPosters.map((p, idx) => (
                          <div
                            key={idx}
                            style={{ zIndex: idx + 1 }}
                            className={`relative w-12 h-[72px] rounded-lg overflow-hidden shadow-lg border border-white/10 bg-gray-900 group-hover:scale-105 transition-transform duration-300 ${
                              idx === 0 ? '' : '-ml-6'
                            }`}
                          >
                            <img
                              src={getImageUrl(p, 'w185')}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FranchisesExplorerModal;
