import React, { useEffect, useState } from 'react';
import {
  Home,
  Tv,
  Film,
  TrendingUp,
  Settings,
  Search as SearchIcon,
  User,
  Clock,
  BookmarkPlus,
  LogOut
} from 'lucide-react';

type TabKey = 'home' | 'series' | 'movies' | 'popular' | 'search' | 'settings' | 'recent' | 'mylist';

// Animated 3-line Hamburger Menu Icon with symmetrical morphing transition
const AnimatedHamburger: React.FC<{ isExpanded: boolean; onClick: () => void }> = ({ isExpanded, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl transition-all duration-300 group flex items-center justify-center focus:outline-none ${
        isExpanded
          ? 'w-10 h-10 hover:bg-white/10 text-gray-300 hover:text-white'
          : 'w-11 h-11 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 shadow-lg hover:shadow-red-950/40 text-white'
      }`}
      title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-label="Toggle navigation menu"
    >
      <div className="w-5 h-5 relative flex items-center justify-center">
        {/* Top bar */}
        <span
          className={`absolute h-0.5 w-5 rounded-full transition-all duration-300 ease-in-out ${
            isExpanded
              ? 'rotate-45 bg-red-500'
              : '-translate-y-1.5 bg-white group-hover:bg-red-400'
          }`}
        />
        {/* Middle bar */}
        <span
          className={`absolute h-0.5 rounded-full transition-all duration-200 ease-in-out ${
            isExpanded
              ? 'w-0 opacity-0 scale-x-0'
              : 'w-3.5 bg-red-500 group-hover:w-5 group-hover:bg-red-400 opacity-100'
          }`}
        />
        {/* Bottom bar */}
        <span
          className={`absolute h-0.5 w-5 rounded-full transition-all duration-300 ease-in-out ${
            isExpanded
              ? '-rotate-45 bg-red-500'
              : 'translate-y-1.5 bg-white group-hover:bg-red-400'
          }`}
        />
      </div>

      {/* Hover tooltip for collapsed state */}
      {!isExpanded && (
        <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-900 border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none drop-shadow-xl translate-x-2 group-hover:translate-x-0 duration-200">
          Expand Menu
        </div>
      )}
    </button>
  );
};

interface SidebarProps {
  activeTab: TabKey;
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>;
  isExpanded: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isExpanded,
  toggleSidebar
}) => {
  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'search' as const, label: 'Search', icon: SearchIcon },
    { id: 'series' as const, label: 'Series', icon: Tv },
    { id: 'movies' as const, label: 'Films', icon: Film },
    { id: 'popular' as const, label: 'New & Popular', icon: TrendingUp },
  ];

  const libraryItems = [
    { label: 'My List', icon: BookmarkPlus, onClick: () => setActiveTab('mylist'), show: true },
    { label: 'Recently', icon: Clock, onClick: () => setActiveTab('recent'), show: true },
    { label: 'Settings', icon: Settings, onClick: () => setActiveTab('settings'), show: true },
  ];

  const [userName, setUserName] = useState<string>('Profile');

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        if (window.electronAPI?.getUserName) {
          const name = await window.electronAPI.getUserName();
          if (name && typeof name === 'string') {
            setUserName(name);
            return;
          }
        }
        const envName = (typeof process !== 'undefined' && process.env?.USERNAME) || (typeof process !== 'undefined' && process.env?.USER);
        if (envName) {
          setUserName(envName);
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
      }
    };
    fetchUserName();
  }, []);

  return (
    <div
      className={`fixed left-0 z-[90] flex flex-col transition-all duration-300 ease-out ${isExpanded ? 'w-72' : 'w-24'}`}
      style={{
        top: 'var(--titlebar-height)',
        height: 'calc(100vh - var(--titlebar-height))',
      }}
    >
      {/* Glassmorphism Background Container */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl border-r border-white/5 shadow-[5px_0_30px_rgba(0,0,0,0.5)]"></div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col h-full overflow-y-auto scrollbar-hide py-6">

        {/* Header / Brand with Animated Hamburger */}
        <div className={`px-6 mb-8 flex items-center ${isExpanded ? 'justify-between' : 'justify-center'}`}>
          {isExpanded ? (
            <>
              <div className="flex items-center gap-3 animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-black border border-white/15 flex items-center justify-center shadow-lg shadow-red-900/30 shrink-0">
                  <img src="/logo.png" alt="THEORA Logo" className="w-full h-full object-cover" />
                </div>
                <span className="font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400">
                  THEORA
                </span>
              </div>
              <AnimatedHamburger isExpanded={isExpanded} onClick={toggleSidebar} />
            </>
          ) : (
            <AnimatedHamburger isExpanded={isExpanded} onClick={toggleSidebar} />
          )}
        </div>

        {/* Navigation Menu */}
        <div className="px-4 space-y-2 mb-8">
          {isExpanded && (
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-in fade-in slide-in-from-left-2">
              Menu
            </h3>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative w-full flex items-center group rounded-xl transition-all duration-300 ${isExpanded ? 'px-4 py-3.5 gap-4' : 'justify-center py-3.5'
                    } ${isActive ? 'bg-white/5' : 'hover:bg-white/5'}`}
                >
                  {/* Active Glow Indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-red-600 rounded-r-full shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-in fade-in duration-300"></div>
                  )}

                  <Icon
                    className={`transition-all duration-300 ${isActive
                      ? 'text-red-500 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)] scale-110'
                      : 'text-gray-400 group-hover:text-white group-hover:scale-105'
                      } ${isExpanded ? 'h-5 w-5' : 'h-6 w-6'}`}
                  />

                  {isExpanded && (
                    <span className={`font-medium text-sm transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                      }`}>
                      {item.label}
                    </span>
                  )}

                  {/* Hover tooltip for collapsed state */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-900 border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none drop-shadow-xl translate-x-2 group-hover:translate-x-0 duration-200">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Library Section */}
        <div className="px-4 space-y-2 flex-1">
          {isExpanded && (
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 animate-in fade-in slide-in-from-left-2 delay-100">
              Library
            </h3>
          )}
          <nav className="space-y-1">
            {libraryItems.filter(item => item.show).map((item, index) => {
              const Icon = item.icon;
              // Simple strict equality check might need adjustment if logic was complex, 
              // but relying on props logic from original file:
              const isActive = (item.label === 'Settings' && activeTab === 'settings')
                || (item.label === 'Recently' && activeTab === 'recent')
                || (item.label === 'My List' && activeTab === 'mylist');

              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className={`relative w-full flex items-center group rounded-xl transition-all duration-300 ${isExpanded ? 'px-4 py-3.5 gap-4' : 'justify-center py-3.5'
                    } ${isActive ? 'bg-white/5' : 'hover:bg-white/5'}`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-red-600 rounded-r-full shadow-[0_0_15px_rgba(220,38,38,0.8)]"></div>
                  )}

                  <Icon
                    className={`transition-all duration-300 ${isActive
                      ? 'text-red-500 drop-shadow-[0_0_8px_rgba(220,38,38,0.5)] scale-110'
                      : 'text-gray-400 group-hover:text-white group-hover:scale-105'
                      } ${isExpanded ? 'h-5 w-5' : 'h-6 w-6'}`}
                  />

                  {isExpanded && (
                    <span className={`font-medium text-sm transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                      }`}>
                      {item.label}
                    </span>
                  )}

                  {!isExpanded && (
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-gray-900 border border-white/10 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none drop-shadow-xl translate-x-2 group-hover:translate-x-0 duration-200">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>


        {/* User Profile */}
        <div className="p-4 mt-auto">
          <div className={`rounded-2xl bg-white/5 border border-white/5 p-3 flex items-center transition-all duration-300 hover:bg-white/10 group cursor-pointer ${isExpanded ? 'gap-3' : 'justify-center'}`}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border border-white/10 shadow-lg">
                <User className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#09090b] shadow-sm"></div>
            </div>

            {isExpanded && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-white truncate group-hover:text-red-500 transition-colors">
                  {userName}
                </p>
                <p className="text-xs text-gray-500 truncate">Premium</p>
              </div>
            )}

            {isExpanded && (
              <LogOut className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;