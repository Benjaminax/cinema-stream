import React, { useEffect, useState } from 'react';
import { getRecentlyWatched, removeRecentlyWatched, clearRecentlyWatched, addRecentlyWatched } from '../utils/recentlyWatched';
import { Play, Trash2, Clock, ChevronRight, History } from 'lucide-react';

const RecentlyWatched: React.FC = () => {
  const [items, setItems] = useState(() => getRecentlyWatched());

  useEffect(() => {
    const handler = () => setItems(getRecentlyWatched());
    window.addEventListener('recently-watched-updated', handler as EventListener);
    return () => window.removeEventListener('recently-watched-updated', handler as EventListener);
  }, []);


  const onPlay = async (it: any) => {
    try {
      if (window.electronAPI?.openFile) {
        // Update timestamp and move to top immediately
        addRecentlyWatched(it);
        await window.electronAPI.openFile(it.path, it.progress);
      }
    } catch (e) {
      console.error('Error opening file from RecentlyWatched:', e);
    }
  };

  const formatPlaybackTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const onRemove = (p: string | number) => {
    if (confirm('Remove this item from your history?')) {
      removeRecentlyWatched(p);
      setItems(getRecentlyWatched());
    }
  };

  const onClear = () => {
    if (confirm('Clear your entire viewing history? This cannot be undone.')) {
      clearRecentlyWatched();
      setItems([]);
    }
  };

  const formatDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden pb-20">
      {/* Dynamic Ambient Background Glow */}
      <div className="fixed top-0 left-0 w-full h-[600px] bg-gradient-to-b from-red-900/10 to-transparent pointer-events-none z-0" />
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Content Container */}
      <div className="relative z-10">

        {/* Header Section */}
        <div className="px-6 md:px-12 pt-10 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 flex items-center justify-center rounded-xl shadow-lg shadow-red-900/40">
              <History className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic">Recently Watched</h1>
              <p className="text-gray-400 text-sm font-medium tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                {items.length} titles in history
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="px-5 py-2.5 bg-white/5 hover:bg-red-600/10 border border-white/10 hover:border-red-600/50 rounded-full text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-500 transition-all duration-300"
            >
              Clear All
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-6 group">
              <Clock className="h-10 w-10 text-gray-600 group-hover:text-netflix-red transition-colors duration-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your history is clear.</h2>
            <p className="text-gray-500 max-w-sm text-center">Watch movies and series to see them appear here for quick access.</p>
          </div>
        ) : (
          <div className="px-6 md:px-12 space-y-3 max-w-5xl mx-auto pb-20">
            {items.map((it, idx) => (
              <div
                key={it.path}
                className="group relative bg-[#141414]/40 hover:bg-[#1f1f1f]/80 backdrop-blur-md border border-white/5 hover:border-netflix-red/30 rounded-xl p-3 transition-all duration-300 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Visual Accent */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 group-hover:h-8 bg-netflix-red rounded-r-full transition-all duration-300" />

                {/* Poster / Thumbnail - Smaller */}
                <div
                  className={`relative flex-shrink-0 rounded-lg overflow-hidden shadow-xl shadow-black/60 group-hover:scale-105 transition-transform duration-500 cursor-pointer ${it.type === 'episode' ? 'aspect-video w-24 md:w-32' : 'aspect-[2/3] w-16 md:w-20'
                    }`}
                  onClick={() => onPlay(it)}
                >
                  <img
                    src={it.still_path || it.poster_path || '/placeholder.png'}
                    alt={it.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />

                  {/* Hover Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-8 h-8 bg-netflix-red rounded-full flex items-center justify-center shadow-lg shadow-netflix-red/40">
                      <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />
                    </div>
                  </div>
                </div>

                {/* Content Info - Smaller Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-1.5 py-0.5 bg-netflix-red text-white text-[8px] font-black uppercase tracking-tighter rounded shadow-sm">
                      {it.type}
                    </span>
                    {it.season && it.episode && (
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-1.5 py-0.5 bg-white/5 rounded border border-white/5">
                        S{it.season} E{it.episode}
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 ml-auto md:ml-0">
                      <Clock className="h-2.5 w-2.5 text-netflix-red" />
                      {formatDate(it.at)}
                    </span>
                  </div>

                  <h3
                    className="text-lg md:text-xl font-black italic uppercase tracking-tighter leading-tight group-hover:text-netflix-red transition-colors duration-300 truncate cursor-pointer"
                    onClick={() => onPlay(it)}
                  >
                    {it.title}
                  </h3>

                  {it.progress !== undefined && it.duration !== undefined && it.duration > 0 && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-netflix-red shadow-[0_0_8px_rgba(229,9,20,0.6)]"
                          style={{ width: `${Math.min(100, (it.progress / it.duration) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-gray-500 tabular-nums">
                        {formatPlaybackTime(it.progress)} / {formatPlaybackTime(it.duration)}
                      </span>
                    </div>
                  )}

                  <div className="mt-1 text-[9px] font-mono text-gray-600 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block max-w-sm">
                    {it.path}
                  </div>
                </div>

                {/* Actions - Smaller Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPlay(it)}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg font-black uppercase tracking-tighter transition-all active:scale-95 shadow-lg shadow-black/20 text-xs"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{it.progress ? `Resume at ${formatPlaybackTime(it.progress)}` : 'Resume'}</span>
                  </button>

                  <button
                    onClick={() => onRemove(it.path)}
                    className="p-2.5 bg-white/5 hover:bg-netflix-red/20 text-gray-500 hover:text-netflix-red border border-white/10 hover:border-netflix-red/50 rounded-lg transition-all group/delete"
                    title="Remove from history"
                  >
                    <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Decorative Chevron */}
                <div className="hidden lg:block opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-1 group-hover:translate-x-0">
                  <ChevronRight className="h-5 w-5 text-netflix-red/50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentlyWatched;
