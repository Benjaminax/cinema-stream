import React from 'react';
import { TMDBResult } from '../../types/media';
import { getImageUrl } from '../../api/tmdb';

// Use Vite-safe asset URLs so packaged file:// apps load them correctly
const PLACEHOLDER = new URL('/placeholder.png', import.meta.url).href;
const PLACEHOLDER_BACKDROP = new URL('/placeholder-backdrop.png', import.meta.url).href;

interface MediaCardProps {
  item: TMDBResult;
  onClick: (item: TMDBResult) => void;
  onPlay?: (item: TMDBResult) => void;
  className?: string;
  aspect?: 'poster' | 'backdrop';
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, className, aspect = 'poster' }) => {
  // Handle null/undefined values safely
  if (!item) {
    return null;
  }

  const title = item.title || item.name || 'Unknown';

  const isBackdrop = aspect === 'backdrop';
  const displayImage = isBackdrop
    ? (item.backdrop_path || item.still_path)
    : (item.poster_path);

  const localImage = isBackdrop
    ? (item.local_backdrop_path || item.local_still_path)
    : (item.local_poster_path);

  return (
    <div
      className={`relative cursor-pointer transition-all duration-500 ease-out hover:scale-105 hover:z-10 will-change-transform ${className || ''}`}
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
            target.src = isBackdrop ? PLACEHOLDER_BACKDROP : PLACEHOLDER;
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

    </div>
  );
};

export default MediaCard;