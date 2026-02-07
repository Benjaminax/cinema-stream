import React, { useState } from 'react';
import { Play, Info, Star, BookmarkPlus, Check } from 'lucide-react';
import { TMDBResult } from '../../types/media';
import { getImageUrl } from '../../api/tmdb';
import { addToMyList, removeFromMyList, isInMyList } from '../../utils/myList';

interface MediaCardProps {
  item: TMDBResult;
  onClick: (item: TMDBResult) => void;
  onPlay?: (item: TMDBResult) => void;
  className?: string;
  aspect?: 'poster' | 'backdrop';
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, onPlay, className, aspect = 'poster' }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Handle null/undefined values safely
  if (!item) {
    return null;
  }

  const title = item.title || item.name || 'Unknown';
  const releaseDate = item.release_date || item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const voteAverage = item.vote_average ?? 0;
  const overview = item.overview || 'No description available';

  const isBackdrop = aspect === 'backdrop';
  const displayImage = isBackdrop
    ? (item.backdrop_path || item.still_path)
    : (item.poster_path);

  const localImage = isBackdrop
    ? (item.local_backdrop_path || item.local_still_path)
    : (item.local_poster_path);

  return (
    <div
      className={`relative cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10 ${className || ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(item)}
    >
      {/* Poster or Backdrop Image */}
      <div className={`${isBackdrop ? 'aspect-video' : 'aspect-[2/3]'} rounded-lg overflow-hidden bg-gray-800 shadow-lg shadow-black/40 relative`}>
        <img
          src={localImage || (isBackdrop
            ? (getImageUrl(displayImage || null, 'w780'))
            : getImageUrl(displayImage || null, 'w500'))
          }
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = isBackdrop ? '/placeholder-backdrop.png' : '/placeholder.png';
          }}
        />
        {/* Episode Info Badge (Only for backdrop mode episodes) */}
        {isBackdrop && (item as any).episode && (
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
            S{(item as any).season} E{(item as any).episode}
          </div>
        )}
        {/* Bottom gradient to reveal edge softly */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent via-black/30 to-black" />
      </div>

      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm rounded-lg p-3 md:p-4 flex flex-col justify-between h-full">
          <div className="flex-1 overflow-hidden space-y-2">
            <h3 className="text-white font-semibold text-sm md:text-base line-clamp-2">
              {title}
            </h3>

            <div className="flex items-center gap-2 text-xs text-gray-300">
              {year && <span className="font-medium">{year}</span>}
              {voteAverage > 0 && (
                <>
                  <span className="text-gray-500">•</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{voteAverage.toFixed(1)}</span>
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-gray-400 line-clamp-3">
              {overview}
            </p>
          </div>

          {/* Button Group - Fixed positioning at bottom */}
          <div className="flex gap-2 pt-3 mt-auto shrink-0 w-full">
            {/* Play Button */}
            {onPlay && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(item);
                }}
                className="flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-2 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all shadow-lg shadow-red-900/30 flex-1 min-w-0 truncate"
              >
                <Play className="h-3 w-3 fill-current shrink-0" />
                <span className="truncate">Play</span>
              </button>
            )}

            {/* My List Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isInMyList(item.id)) {
                  removeFromMyList(item.id);
                } else {
                  addToMyList(item);
                }
                // Force re-render of this component
                setIsHovered(false);
                setTimeout(() => setIsHovered(true), 10);
              }}
              className={`flex items-center justify-center w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-md border-2 transition-all ${isInMyList(item.id)
                ? 'bg-white text-black border-white'
                : 'bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/50'
                }`}
              title={isInMyList(item.id) ? "Remove from List" : "Add to List"}
            >
              {isInMyList(item.id) ? (
                <Check className="h-4 w-4" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
            </button>

            {/* Info Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick(item);
              }}
              className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-md bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 hover:border-white/50 transition-all"
              title="More Info"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaCard;