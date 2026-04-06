import { useState, useEffect, useCallback } from 'react';

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

interface VLCCommandResult {
  success: boolean;
  error?: string;
}

export const useVLCControl = () => {
  const [status, setStatus] = useState<VLCStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);

  const getStatus = useCallback(async (): Promise<VLCStatus> => {
    if (!window.electronAPI?.getVLCStatus) {
      return { connected: false, message: 'ElectronAPI not available' };
    }

    try {
      const vlcStatus = await window.electronAPI.getVLCStatus();
      setStatus(vlcStatus);
      return vlcStatus;
    } catch (error) {
      console.error('Failed to get VLC status:', error);
      const errorStatus = { connected: false, message: 'Connection error' };
      setStatus(errorStatus);
      return errorStatus;
    }
  }, []);

  const sendCommand = useCallback(async (command: string, value?: string): Promise<VLCCommandResult> => {
    if (!window.electronAPI?.sendVLCCommand) {
      return { success: false, error: 'ElectronAPI not available' };
    }

    try {
      setIsLoading(true);
      const result = await window.electronAPI.sendVLCCommand(command, value);

      if (result.success) {
        // Refresh status after successful command
        setTimeout(getStatus, 500);
      }

      return result;
    } catch (error) {
      console.error(`Failed to send VLC command ${command}:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      setIsLoading(false);
    }
  }, [getStatus]);

  const playMedia = useCallback(async (filePath: string, options: { startTime?: number; fullscreen?: boolean } = {}): Promise<{ success: boolean; error?: string }> => {
    if (!window.electronAPI?.playMediaVLC) {
      return { success: false, error: 'ElectronAPI not available' };
    }

    try {
      const result = await window.electronAPI.playMediaVLC({
        filePath,
        ...options,
      });

      if (result.success) {
        // Start monitoring status
        setTimeout(getStatus, 2000);
      }

      return result;
    } catch (error) {
      console.error('Failed to play media with VLC:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, [getStatus]);

  const stopVLC = useCallback(async (): Promise<VLCCommandResult> => {
    if (!window.electronAPI?.stopVLC) {
      return { success: false, error: 'ElectronAPI not available' };
    }

    try {
      const result = await window.electronAPI.stopVLC();

      if (result.success) {
        setStatus({ connected: false });
      }

      return result;
    } catch (error) {
      console.error('Failed to stop VLC:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, []);

  // Convenience methods for common commands
  const play = useCallback(() => sendCommand('pl_play'), [sendCommand]);
  const pause = useCallback(() => sendCommand('pl_pause'), [sendCommand]);
  const stop = useCallback(() => sendCommand('pl_stop'), [sendCommand]);
  const togglePlayPause = useCallback(() => {
    return status.state === 'playing' ? pause() : play();
  }, [status.state, play, pause]);

  const seek = useCallback((position: number) => {
    return sendCommand('seek', `${Math.round(position)}%`);
  }, [sendCommand]);

  const setVolume = useCallback((volume: number) => {
    return sendCommand('volume', volume.toString());
  }, [sendCommand]);

  const toggleMute = useCallback(() => {
    return setVolume(status.volume === 0 ? 100 : 0);
  }, [status.volume, setVolume]);

  // Auto-refresh status periodically when connected
  useEffect(() => {
    if (!status.connected) return;

    const interval = setInterval(getStatus, 5000);
    return () => clearInterval(interval);
  }, [status.connected, getStatus]);

  return {
    status,
    isLoading,
    getStatus,
    sendCommand,
    playMedia,
    stopVLC,
    // Convenience methods
    play,
    pause,
    stop,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
  };
};