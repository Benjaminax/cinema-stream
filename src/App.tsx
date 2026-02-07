import { useState } from 'react';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Series from './pages/Series';
import Movies from './pages/Movies';
import Popular from './pages/Popular';
import Search from './pages/Search';
import Settings from './pages/Settings';
import MyList from './pages/MyList';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalOverlays from './components/GlobalOverlays';
import { initPlaybackTracker } from './utils/playbackTracker';

type TabType = 'home' | 'series' | 'movies' | 'popular' | 'search' | 'settings' | 'recent' | 'mylist';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');

  useState(() => {
    initPlaybackTracker();
  });

  const renderContent = () => {
    console.log('🎬 App renderContent called with activeTab:', activeTab);
    switch (activeTab) {
      case 'home':
        return <Home isActive={activeTab === 'home'} />;
      case 'search':
        return (
          <ErrorBoundary>
            <Search key="search" />
          </ErrorBoundary>
        );
      case 'series':
        return <Series key="series" />;
      case 'movies':
        console.log('🎬 Rendering Movies component');
        return <Movies key="movies" />;
      case 'popular':
        return (
          <ErrorBoundary>
            <Popular key="popular" />
          </ErrorBoundary>
        );
      case 'settings':
        return <Settings key="settings" />;
      case 'mylist':
        return <MyList key="mylist" />;
      default:
        return <Home isActive={false} />;
    }
  };

  return (
    <>
      <div className="app-titlebar" />
      <div className="relative" style={{ paddingTop: 'var(--titlebar-height)' }}>
        <Layout
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        >
          {renderContent()}
        </Layout>
        <GlobalOverlays />
      </div>
    </>
  );
}

export default App;



