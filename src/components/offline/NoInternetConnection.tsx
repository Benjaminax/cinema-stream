import React from 'react';
import { WifiOff, RotateCcw } from 'lucide-react';

interface NoInternetConnectionProps {
  onRetry: () => void;
  isConnecting?: boolean;
}

const NoInternetConnection: React.FC<NoInternetConnectionProps> = ({
  onRetry,
  isConnecting = false
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-black to-[#1a0a0a] flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-md">
        {/* Animated WiFi Off Icon */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-red-600/10 rounded-full animate-pulse" />
          </div>
          <div className="relative z-10 flex items-center justify-center">
            <WifiOff size={80} className="text-red-500 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-5xl font-black text-white tracking-tight">
            No Internet Connection
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed">
            This content requires an internet connection. Please check your network and try again.
          </p>
        </div>

        {/* Retry Button */}
        <div className="flex justify-center">
          <button
            onClick={onRetry}
            disabled={isConnecting}
            className="group relative flex items-center justify-center gap-3 px-12 py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-xl font-bold text-lg transition-all disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-2xl disabled:transform-none min-w-[200px]"
          >
          {isConnecting ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent" />
              Connecting...
            </>
          ) : (
            <>
              <RotateCcw size={24} className="group-hover:rotate-180 transition-transform duration-500" />
              Try Again
            </>
          )}
        </button>
        </div>

        {/* Subtle branding */}
        <p className="text-sm text-gray-600 mt-8">
          CINESTREAM • Entertainment Platform
        </p>
      </div>
    </div>
  );
};

export default NoInternetConnection;