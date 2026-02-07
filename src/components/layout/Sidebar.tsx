import React, { useEffect, useState } from 'react';
import {
  Home,
  Tv,
  Film,
  TrendingUp,
  Settings,
  ChevronLeft,
  Search as SearchIcon,
  User,
  Clock,
  BookmarkPlus,
  LogOut,
  Play
} from 'lucide-react';

type TabKey = 'home' | 'series' | 'movies' | 'popular' | 'search' | 'settings' | 'recent' | 'mylist';

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

        {/* Header / Brand */}
        <div className={`px-6 mb-10 flex items-center ${isExpanded ? 'justify-between' : 'justify-center'}`}>
          {isExpanded ? (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/40">
                <Play className="w-4 h-4 text-white fill-current" />
              </div>
              <span className="font-bold text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
                CINESTREAM
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/40 hover:scale-105 transition-transform duration-300 cursor-pointer" onClick={toggleSidebar}>
              <Play className="w-5 h-5 text-white fill-current" />
            </div>
          )}

          {isExpanded && (
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
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