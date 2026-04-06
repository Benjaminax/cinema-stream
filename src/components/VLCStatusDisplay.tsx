import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, RotateCcw, Monitor } from 'lucide-react';

interface VLCStatus {
  connected: boolean;
  state?: string;
  time?: number;
  length?: number;
  position?: number;
  volume?: number;
  currentMedia?: string;
  message?: string;
}

interface VLCProgressEvent {
  path: string;
  time: number;
  length: number;
  state: string;
  position: number;
}

const VLCStatusDisplay: React.FC = () => {
  const [vlcStatus, setVlcStatus] = useState<VLCStatus>({ connected: false });
  const [isVisible, setIsVisible] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const statusInterval = useRef<number | null>(null);
  const lastProgressUpdate = useRef<number>(0);

  const checkVLCStatus = useCallback(async () => {
    if (!window.electronAPI?.getVLCStatus) return;

    try {
      const status = await window.electronAPI.getVLCStatus();

      // Only update if no recent progress event (to avoid conflicts)
      const timeSinceLastProgress = Date.now() - lastProgressUpdate.current;
      if (timeSinceLastProgress > 10000) {
        setVlcStatus(status);

        if (status.connected && status.state && status.state !== 'stopped') {
          setIsVisible(true);
        } else if (!status.connected) {
          setIsVisible(false);
          setShowControls(false);
        }
      }
    } catch (error) {
      console.error('Failed to get VLC status:', error);
      setVlcStatus({ connected: false, message: 'Connection error' });
    }
  }, []);

  useEffect(() => {
    // Listen for playback progress events
    const handlePlaybackProgress = (_event: any, data: VLCProgressEvent) => {
      console.log('🔄 VLC Progress update:', data);
      lastProgressUpdate.current = Date.now();
      
      setVlcStatus({
        connected: true,
        state: data.state,
        time: data.time,
        length: data.length,
        position: data.position,
        currentMedia: data.path
      });
      
      // Show component when playback starts
      if (data.state === 'playing' || data.state === 'paused') {
        setIsVisible(true);
      }
      
      // Hide if stopped or ended
      if (data.state === 'stopped' || data.state === 'ended') {
        setTimeout(() => {
          setIsVisible(false);
          setShowControls(false);
        }, 3000);
      }
    };

    if (window.electronAPI?.on) {
      window.electronAPI.on('playback-progress', handlePlaybackProgress);
    }

    // Periodic status check (less frequent than progress updates)
    statusInterval.current = window.setInterval(() => {
      checkVLCStatus();
    }, 5000);

    return () => {
      if (window.electronAPI?.removeListener) {
        window.electronAPI.removeListener('playback-progress', handlePlaybackProgress);
      }
      if (statusInterval.current) {
        window.clearInterval(statusInterval.current);
      }
    };
  }, [checkVLCStatus]);

  const sendVLCCommand = async (command: string, value?: string) => {
    if (!window.electronAPI?.sendVLCCommand) return;

    try {
      setIsLoading(true);
      const result = await window.electronAPI.sendVLCCommand(command, value);
      
      if (result.success) {
        // Refresh status after command
        setTimeout(checkVLCStatus, 500);
      } else {
        console.error('VLC command failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to send VLC command:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileName = (path?: string): string => {
    if (!path) return 'Unknown Media';
    return path.split(/[\\/]/).pop() || 'Unknown Media';
  };

  const handlePlayPause = () => {
    if (vlcStatus.state === 'playing') {
      sendVLCCommand('pl_pause');
    } else {
      sendVLCCommand('pl_play');
    }
  };

  const handleStop = () => {
    sendVLCCommand('pl_stop');
  };

  const handleSeek = (position: number) => {
    sendVLCCommand('seek', `${Math.round(position)}%`);
  };

  const handleVolumeChange = (volume: number) => {
    sendVLCCommand('volume', volume.toString());
  };

  const handleStopVLC = async () => {
    if (!window.electronAPI?.stopVLC) return;

    try {
      await window.electronAPI.stopVLC();
      setVlcStatus({ connected: false });
      setIsVisible(false);
      setShowControls(false);
    } catch (error) {
      console.error('Failed to stop VLC:', error);
    }
  };

  if (!isVisible || !vlcStatus.connected) {
    return null;
  }

  const progressPercentage = vlcStatus.length && vlcStatus.time 
    ? (vlcStatus.time / vlcStatus.length) * 100 
    : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className="bg-black/90 backdrop-blur-sm text-white rounded-lg shadow-2xl border border-white/10 min-w-80 transition-all duration-300"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-sm">VLC Player</span>
            <div className={`w-2 h-2 rounded-full ${
              vlcStatus.state === 'playing' ? 'bg-green-400' : 
              vlcStatus.state === 'paused' ? 'bg-yellow-400' : 'bg-gray-400'
            }`} />
          </div>
          <button
            onClick={handleStopVLC}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Close VLC"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        {/* Media Info */}
        <div className="p-3 space-y-2">
          <div className="text-xs text-gray-300 truncate" title={vlcStatus.currentMedia}>
            {getFileName(vlcStatus.currentMedia)}
          </div>
          
          {/* Progress Bar */}
          {vlcStatus.length && vlcStatus.time !== undefined && (
            <div className="space-y-1">
              <div 
                className="w-full h-1.5 bg-gray-700 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percentage = (clickX / rect.width) * 100;
                  handleSeek(percentage);
                }}
              >
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(vlcStatus.time)}</span>
                <span>{formatTime(vlcStatus.length)}</span>
              </div>
            </div>
          )}

          {/* Controls */}
          {showControls && (
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePlayPause}
                  disabled={isLoading}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                  title={vlcStatus.state === 'playing' ? 'Pause' : 'Play'}
                >
                  {vlcStatus.state === 'playing' ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                
                <button
                  onClick={handleStop}
                  disabled={isLoading}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSeek(0)}
                  disabled={isLoading}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Restart"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleVolumeChange(vlcStatus.volume === 0 ? 100 : 0)}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  title={vlcStatus.volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {vlcStatus.volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={vlcStatus.volume ?? 50}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className="w-16 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer vlc-slider"
                  title={`Volume: ${vlcStatus.volume ?? 50}%`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VLCStatusDisplay;
