import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const NetworkStatusIndicator: React.FC = () => {
  const { isOnline, retry } = useNetworkStatus();

  if (isOnline) return null; // Only show when offline

  return (
    <div className="fixed top-4 right-4 z-[250] bg-red-900/90 backdrop-blur-md border border-red-600/50 rounded-xl p-3 shadow-xl">
      <div className="flex items-center gap-3">
        <WifiOff size={20} className="text-red-400 flex-shrink-0" />
        <div className="text-sm">
          <div className="text-white font-medium">No Internet</div>
          <div className="text-red-300 text-xs">Some features unavailable</div>
        </div>
        <button
          onClick={retry}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium transition-all"
        >
          Retry
        </button>
      </div>
    </div>
  );
};

export default NetworkStatusIndicator;