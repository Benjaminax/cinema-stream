import React, { useState } from 'react';
import Sidebar from './Sidebar';
const RecentlyWatched = React.lazy(() => import('../../pages/RecentlyWatched'));


type TabKey = 'home' | 'series' | 'movies' | 'popular' | 'search' | 'settings' | 'recent' | 'mylist';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabKey;
  setActiveTab: React.Dispatch<React.SetStateAction<TabKey>>;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab
}) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isExpanded={isSidebarExpanded}
        toggleSidebar={toggleSidebar}
      />
      <div
        className={`transition-all duration-300 overflow-y-auto scrollbar-custom ${isSidebarExpanded ? 'ml-72' : 'ml-24'
          }`}
      >
        {activeTab === 'recent' ? (
          // Lazy load the RecentlyWatched page
          <React.Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
            <RecentlyWatched />
          </React.Suspense>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default Layout;