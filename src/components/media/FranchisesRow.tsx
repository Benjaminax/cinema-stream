import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bookmark, BookmarkCheck } from 'lucide-react';
import { Franchise, TMDBResult } from '../../types/media';
import { getImageUrl } from '../../api/tmdb';
import FranchiseModal from './FranchiseModal';
import FranchisesExplorerModal from './FranchisesExplorerModal';

interface FranchisesRowProps {
  franchises: Franchise[];
  onSelectMovie: (movie: TMDBResult) => void;
  onPlayMovie?: (movie: TMDBResult) => void;
}

const FranchisesRow: React.FC<FranchisesRowProps> = ({
  franchises,
  onSelectMovie,
  onPlayMovie
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [selectedFranchise, setSelectedFranchise] = useState<Franchise | null>(null);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('theora_bookmarked_franchises');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleBookmark = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem('theora_bookmarked_franchises', JSON.stringify(Array.from(next)));
      } catch (err) {
        console.error('Failed to save bookmark:', err);
      }
      return next;
    });
  };

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
  }, [franchises]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = rowRef.current.clientWidth * 0.75;
      const scrollTo = direction === 'left'
        ? rowRef.current.scrollLeft - scrollAmount
        : rowRef.current.scrollLeft + scrollAmount;

      rowRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
    }
  };

  if (!franchises || franchises.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 px-1 md:px-2 pt-2">
        {/* Section Header with Chevron & Explore All */}
        <div className="flex items-center justify-between px-0.5 md:px-1">
          <div
            onClick={() => setIsExplorerOpen(true)}
            className="flex items-center gap-1.5 group cursor-pointer w-fit"
            role="button"
            tabIndex={0}
            aria-label="Open all franchises explorer"
          >
            <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-gray-200 transition-colors tracking-tight font-sans">
              Featured Franchises
            </h2>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
          </div>

          <button
            onClick={() => setIsExplorerOpen(true)}
            className="text-xs text-red-500 hover:text-red-400 font-medium px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 transition-colors"
          >
            Explore All ({franchises.length})
          </button>
        </div>

        <div className="group/row relative -mx-1 md:-mx-2">
          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-0 top-0 bottom-0 z-40 w-16 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 bg-gradient-to-r from-[#0c0d10] via-[#0c0d10]/90 to-transparent"
              aria-label="Scroll left"
            >
              <div className="bg-black/70 hover:bg-black/90 border border-white/10 rounded-full p-2.5 transition transform hover:scale-110 shadow-xl">
                <ChevronLeft className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
            </button>
          )}

          {/* Horizontal Scrollable Row of Franchise Cards */}
          <div
            ref={rowRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-1 md:px-2 py-4"
          >
            {franchises.map((item) => {
              const isBookmarked = bookmarkedIds.has(item.id);
              const displayPosters = item.posters && item.posters.length > 0
                ? item.posters.slice(0, 3)
                : item.parts.map(p => p.poster_path).filter((p): p is string => Boolean(p)).slice(0, 3);

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedFranchise(item)}
                  className="flex-shrink-0 w-[420px] md:w-[470px] h-[180px] bg-[#151518]/95 hover:bg-[#19191d] border border-white/[0.08] hover:border-white/20 rounded-2xl p-5 flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.015] hover:shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
                >
                  {/* Subtle Red/Glow Hover Ambient Light */}
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-red-600/0 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  {/* Left Column: Metadata & Details */}
                  <div className="flex-1 flex flex-col justify-between h-full pr-3 z-10 min-w-0">
                    {/* Top Row: Title + Bookmark */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg md:text-xl font-bold text-white tracking-tight truncate group-hover:text-red-400 transition-colors">
                        {item.displayTitle}
                      </h3>
                      <button
                        onClick={(e) => toggleBookmark(e, item.id)}
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
                    </div>

                    {/* Middle Row: Stats Line */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium flex-wrap">
                      <span>{item.titlesCount} titles</span>
                      <span className="text-gray-600">•</span>
                      <span>{item.yearRange}</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        ★ {item.avgRating} avg
                      </span>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400/90">{item.formattedVotes}</span>
                    </div>

                    {/* Bottom Row: Tagline / Description */}
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed tracking-normal font-sans">
                      {item.tagline || item.overview}
                    </p>
                  </div>

                  {/* Right Column: Stacked / Fanned Posters Visual */}
                  <div className="relative w-40 md:w-44 h-full flex items-center justify-end flex-shrink-0">
                    {displayPosters.length > 0 ? (
                      <div className="flex items-center relative h-full">
                        {displayPosters.map((posterPath, idx) => {
                          // Determine subtle stagger/offset and z-index for overlapping fan effect
                          const zIdx = idx + 1;
                          const offsetClass = idx === 0 ? '' : idx === 1 ? '-ml-7 md:-ml-8' : '-ml-7 md:-ml-8';

                          return (
                            <div
                              key={idx}
                              style={{ zIndex: zIdx }}
                              className={`relative w-16 md:w-[72px] h-[115px] md:h-[125px] rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-gray-900 transition-all duration-300 transform group-hover:scale-105 ${offsetClass}`}
                            >
                              <img
                                src={getImageUrl(posterPath, 'w342')}
                                alt={`${item.displayTitle} poster ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-20 h-28 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-500">
                        No poster
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-0 top-0 bottom-0 z-40 w-16 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-300 bg-gradient-to-l from-[#0c0d10] via-[#0c0d10]/90 to-transparent"
              aria-label="Scroll right"
            >
              <div className="bg-black/70 hover:bg-black/90 border border-white/10 rounded-full p-2.5 transition transform hover:scale-110 shadow-xl">
                <ChevronRight className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Franchises Explorer Modal */}
      <FranchisesExplorerModal
        franchises={franchises}
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        onSelectFranchise={(franchise) => setSelectedFranchise(franchise)}
        bookmarkedIds={bookmarkedIds}
        onToggleBookmark={toggleBookmark}
      />

      {/* Full Franchise Modal */}
      {selectedFranchise && (
        <FranchiseModal
          franchise={selectedFranchise}
          isOpen={Boolean(selectedFranchise)}
          onClose={() => setSelectedFranchise(null)}
          onSelectMovie={onSelectMovie}
          onPlayMovie={onPlayMovie}
        />
      )}
    </>
  );
};

export default FranchisesRow;
