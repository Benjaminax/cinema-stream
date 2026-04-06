import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard';
import { TMDBResult } from '../../types/media';

interface MediaRowProps {
  title: string;
  items: TMDBResult[];
  onCardClick: (item: TMDBResult) => void;
  onPlay?: (item: TMDBResult) => void;
  aspect?: 'poster' | 'backdrop';
  disableEpisodePlay?: boolean; // when true, hovering Play on episode items does nothing
}

const MediaRow: React.FC<MediaRowProps> = ({ title, items, onCardClick, onPlay, aspect = 'poster', disableEpisodePlay }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Scroll detection logic
  const checkScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const currentRef = rowRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, [items]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = rowRef.current.clientWidth * 0.8;
      const scrollTo = direction === 'left'
        ? rowRef.current.scrollLeft - scrollAmount
        : rowRef.current.scrollLeft + scrollAmount;

      rowRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="space-y-2 px-1 md:px-2">
      <h2 className="text-base md:text-xl font-semibold text-white hover:text-gray-300 transition-colors cursor-default px-0.5 md:px-1">
        {title}
      </h2>

      <div className="group/row relative -mx-1 md:-mx-2">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-0 bottom-0 z-40 w-16 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 bg-gradient-to-r from-[#141414] via-[#141414]/80 to-transparent"
            aria-label="Scroll left"
          >
            <div className="bg-black/60 hover:bg-black/80 rounded-full p-2 transition scale-75 hover:scale-100">
              <ChevronLeft className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
          </button>
        )}

        {/* Scrollable Content */}
        <div
          ref={rowRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-1 md:px-2 py-6 -my-6"
        >
          {items.slice(0, 20).map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={() => onCardClick(item)}
              onPlay={(it) => {
                // If disabled and this looks like an episode, do nothing
                if (typeof (it as any).episode !== 'undefined' && (it as any).episode !== null && (typeof (it as any).episode === 'number')) {
                  if (disableEpisodePlay) return;
                }
                onPlay?.(it);
              }}
              aspect={aspect}
              className={`flex-shrink-0 ${aspect === 'backdrop' ? 'w-64 md:w-80 lg:w-96' : 'w-44 md:w-52 lg:w-60'}`}
            />
          ))}
        </div>

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-0 bottom-0 z-40 w-16 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 bg-gradient-to-l from-[#141414] via-[#141414]/80 to-transparent"
            aria-label="Scroll right"
          >
            <div className="bg-black/60 hover:bg-black/80 rounded-full p-2 transition scale-75 hover:scale-100">
              <ChevronRight className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaRow;