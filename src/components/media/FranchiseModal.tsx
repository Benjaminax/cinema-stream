import React from 'react';
import { X, Play, Info, Star, Film, Calendar, ThumbsUp } from 'lucide-react';
import { Franchise, TMDBResult } from '../../types/media';
import { getImageUrl } from '../../api/tmdb';

interface FranchiseModalProps {
  franchise: Franchise | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectMovie: (movie: TMDBResult) => void;
  onPlayMovie?: (movie: TMDBResult) => void;
}

const FranchiseModal: React.FC<FranchiseModalProps> = ({
  franchise,
  isOpen,
  onClose,
  onSelectMovie,
  onPlayMovie
}) => {
  if (!isOpen || !franchise) return null;

  const sortedParts = [...franchise.parts].sort((a, b) => {
    const yearA = a.release_date || '9999';
    const yearB = b.release_date || '9999';
    return yearA.localeCompare(yearB);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#121215] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero Header with Franchise Backdrop */}
        <div className="relative h-64 md:h-72 w-full flex-shrink-0">
          {franchise.backdrop_path ? (
            <img
              src={getImageUrl(franchise.backdrop_path, 'original')}
              alt={franchise.displayTitle}
              className="w-full h-full object-cover object-center"
            />
          ) : franchise.poster_path ? (
            <img
              src={getImageUrl(franchise.poster_path, 'w780')}
              alt={franchise.displayTitle}
              className="w-full h-full object-cover object-center opacity-40"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-950/40 via-gray-900 to-black" />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121215] via-[#121215]/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white transition-all duration-200 hover:scale-105 z-20"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Info */}
          <div className="absolute bottom-6 left-6 right-6 z-10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-500">
              <Film className="w-4 h-4" />
              <span>Featured Franchise Collection</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {franchise.displayTitle}
            </h1>
            <p className="text-sm md:text-base text-gray-300 font-sans font-normal max-w-2xl line-clamp-2 leading-relaxed">
              {franchise.tagline || franchise.overview}
            </p>

            {/* Quick Stats Pills */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-medium text-gray-300">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md flex items-center gap-1.5 border border-white/5">
                <Film className="w-3.5 h-3.5 text-red-500" />
                {franchise.titlesCount} Titles
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md flex items-center gap-1.5 border border-white/5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                {franchise.yearRange}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md flex items-center gap-1.5 border border-white/5 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                {franchise.avgRating} Avg Rating
              </span>
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md flex items-center gap-1.5 border border-white/5 text-gray-400">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                {franchise.formattedVotes}
              </span>
            </div>
          </div>
        </div>

        {/* Overview & Movie List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-custom">
          {franchise.overview && franchise.overview !== franchise.tagline && (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-xs md:text-sm text-gray-300 leading-relaxed">
              {franchise.overview}
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>Franchise Titles</span>
              <span className="text-xs text-gray-500 font-normal">({sortedParts.length} movies)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedParts.map((movie) => {
                const year = movie.release_date?.substring(0, 4) || 'TBA';
                const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

                return (
                  <div
                    key={movie.id}
                    className="flex gap-4 p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all duration-300 group cursor-pointer"
                    onClick={() => {
                      onClose();
                      onSelectMovie(movie);
                    }}
                  >
                    {/* Poster */}
                    <div className="relative w-20 h-28 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-gray-900">
                      {movie.poster_path ? (
                        <img
                          src={getImageUrl(movie.poster_path, 'w342')}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                          No Poster
                        </div>
                      )}
                    </div>

                    {/* Movie Info */}
                    <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                      <div>
                        <h3 className="text-sm md:text-base font-bold text-white truncate group-hover:text-red-400 transition-colors">
                          {movie.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <span>{year}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-400 font-medium">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {rating}
                          </span>
                        </div>
                        {movie.overview && (
                          <p className="text-xs text-gray-400 line-clamp-2 mt-2 leading-relaxed">
                            {movie.overview}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            if (onPlayMovie) {
                              onPlayMovie(movie);
                            } else {
                              onSelectMovie(movie);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Watch
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onSelectMovie(movie);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-medium flex items-center gap-1 transition-colors"
                        >
                          <Info className="w-3 h-3" />
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FranchiseModal;
