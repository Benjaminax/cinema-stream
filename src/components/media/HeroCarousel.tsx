import React, { useState, useEffect } from 'react';
import { Play, Info } from 'lucide-react';
import { TMDBResult } from '../../types/media';
import { getImageUrl } from '../../api/tmdb';

const PLACEHOLDER_BACKDROP = new URL('/placeholder-backdrop.png', import.meta.url).href;

interface HeroCarouselProps {
  items: TMDBResult[];
  onPlay: (item: TMDBResult) => void;
  onMoreInfo: (item: TMDBResult) => void;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({
  items,
  onPlay,
  onMoreInfo
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-rotation logic
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [items.length]);

  const currentItem = items[currentIndex];

  return (
    <div className="relative h-screen min-h-[70vh] w-full overflow-hidden">
      {/* Background Image with soft edge blends */}
      <div className="absolute inset-0">
        <img
          src={getImageUrl(currentItem?.backdrop_path, 'original')}
          alt={currentItem?.title || currentItem?.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = PLACEHOLDER_BACKDROP;
          }}
        />
        {/* Vertical fade to blend foreground content */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent" />
        {/* Side fades to soften image edges */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b0b0b_0%,transparent_20%,transparent_80%,#0b0b0b_100%)]" />
        {/* Bottom fade to reveal lower edge */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-[#0b0b0b]/40 to-[#0b0b0b]" />
      </div>

      {/* Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 bg-gradient-to-t from-gray-950/90 via-gray-950/50 to-transparent">
        <div className="max-w-2xl">
          <div className="mb-6 h-20 md:h-32 flex items-end">
            {currentItem?.logo_path ? (
              <img
                src={getImageUrl(currentItem.logo_path, 'w500')}
                alt={`${currentItem?.title || currentItem?.name} Logo`}
                className="max-h-full max-w-full object-contain filter drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-opacity duration-500"
                style={{
                  opacity: 1
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const titleElement = document.getElementById(`carousel-title-${currentIndex}`);
                  if (titleElement) titleElement.style.display = 'block';
                }}
              />
            ) : null}
            <h1
              id={`carousel-title-${currentIndex}`}
              className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter filter drop-shadow-lg"
              style={{ display: currentItem?.logo_path ? 'none' : 'block' }}
            >
              {currentItem?.title || currentItem?.name}
            </h1>
          </div>
          <p className="text-lg text-gray-200 mb-6 line-clamp-3 leading-relaxed max-w-xl font-medium drop-shadow-md">
            {currentItem?.overview}
          </p>

          {/* Cast Chips */}
          {currentItem?.credits?.cast && currentItem.credits.cast.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-8 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] filter drop-shadow-md">
              {currentItem.credits.cast.slice(0, 4).map((person, idx) => (
                <div key={person.id || idx} className="flex items-center gap-3">
                  <span className="hover:text-white transition-colors cursor-default">{person.name}</span>
                  {idx < 3 && idx < currentItem.credits!.cast.length - 1 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600/60" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => onPlay(currentItem)}
              className="flex items-center gap-2 bg-netflix-red hover:bg-netflix-red-light text-white px-8 py-3 rounded font-semibold transition"
            >
              <Play className="h-5 w-5" />
              Play
            </button>
            <button
              onClick={() => onMoreInfo(currentItem)}
              className="flex items-center gap-2 bg-gray-500/70 hover:bg-gray-500/50 text-white px-8 py-3 rounded font-semibold transition"
            >
              <Info className="h-5 w-5" />
              More Info
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Indicators */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-1 h-16 rounded-full transition-all duration-300 border-2 ${idx === currentIndex
              ? 'bg-netflix-red border-netflix-red opacity-100 w-2 shadow-lg shadow-netflix-red/50'
              : 'bg-transparent border-black opacity-60 hover:opacity-80'
              }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;