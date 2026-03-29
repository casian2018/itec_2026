"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  initiateSpotifyAuth,
  getPlaybackState,
  togglePlayback,
  skipToNext,
  skipToPrevious,
  setVolume,
  seekToPosition,
  setRepeatMode,
  setShuffle,
  isAuthenticated,
  disconnectSpotify,
  type SpotifyPlaybackState,
} from "@/lib/spotify";

interface SpotifyPlayerState {
  isConnected: boolean;
  isExpanded: boolean;
  playbackState: SpotifyPlaybackState | null;
  volume: number;
  showConnect: boolean;
  isLoading: boolean;
  error: string | null;
}

export function SpotifyPlayer() {
  const [state, setState] = useState<SpotifyPlayerState>({
    isConnected: false,
    isExpanded: false,
    playbackState: null,
    volume: 50,
    showConnect: false,
    isLoading: false,
    error: null,
  });

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlaybackState = useCallback(async () => {
    try {
      const playbackState = await getPlaybackState();
      setState((prev) => ({
        ...prev,
        playbackState,
        volume: playbackState?.device?.volume_percent ?? prev.volume,
        error: null,
      }));
    } catch (err) {
      console.error("Failed to fetch playback state:", err);
    }
  }, []);

  const startPolling = useCallback(() => {
    // Poll immediately
    fetchPlaybackState();

    // Then poll every 5 seconds
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(fetchPlaybackState, 5000);
  }, [fetchPlaybackState]);



  // Check if already authenticated on mount
  useEffect(() => {
    if (isAuthenticated()) {
      // Use setTimeout to avoid calling setState synchronously in effect
      setTimeout(() => {
        setState((prev) => ({ ...prev, isConnected: true }));
        startPolling();
      }, 0);
    }
  }, [startPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleConnect = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    initiateSpotifyAuth();
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnectSpotify();
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setState({
      isConnected: false,
      isExpanded: false,
      playbackState: null,
      volume: 50,
      showConnect: false,
      isLoading: false,
      error: null,
    });
  }, []);

  const handleTogglePlayPause = useCallback(async () => {
    if (!state.playbackState) return;
    
    const success = await togglePlayback(state.playbackState.is_playing);
    if (success) {
      setState((prev) => ({
        ...prev,
        playbackState: prev.playbackState
          ? { ...prev.playbackState, is_playing: !prev.playbackState.is_playing }
          : null,
      }));
    }
  }, [state.playbackState]);

  const handleSkipNext = useCallback(async () => {
    const success = await skipToNext();
    if (success) {
      // Fetch updated state after a short delay
      setTimeout(fetchPlaybackState, 500);
    }
  }, [fetchPlaybackState]);

  const handleSkipPrevious = useCallback(async () => {
    const success = await skipToPrevious();
    if (success) {
      // Fetch updated state after a short delay
      setTimeout(fetchPlaybackState, 500);
    }
  }, [fetchPlaybackState]);

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setState((prev) => ({ ...prev, volume: newVolume }));
    await setVolume(newVolume);
  }, []);

  const handleSeek = useCallback(async (positionMs: number) => {
    if (!state.playbackState?.item) return;
    
    const success = await seekToPosition(positionMs);
    if (success) {
      setState((prev) => ({
        ...prev,
        playbackState: prev.playbackState
          ? { ...prev.playbackState, progress_ms: positionMs }
          : null,
      }));
    }
  }, [state.playbackState]);

  const handleToggleRepeat = useCallback(async () => {
    if (!state.playbackState) return;
    
    const currentMode = state.playbackState.repeat_state;
    const nextMode = currentMode === "off" ? "context" : currentMode === "context" ? "track" : "off";
    
    const success = await setRepeatMode(nextMode);
    if (success) {
      setState((prev) => ({
        ...prev,
        playbackState: prev.playbackState
          ? { ...prev.playbackState, repeat_state: nextMode }
          : null,
      }));
    }
  }, [state.playbackState]);

  const handleToggleShuffle = useCallback(async () => {
    if (!state.playbackState) return;
    
    const newState = !state.playbackState.shuffle_state;
    const success = await setShuffle(newState);
    if (success) {
      setState((prev) => ({
        ...prev,
        playbackState: prev.playbackState
          ? { ...prev.playbackState, shuffle_state: newState }
          : null,
      }));
    }
  }, [state.playbackState]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentTrack = state.playbackState?.item;
  const isPlaying = state.playbackState?.is_playing ?? false;
  const progressMs = state.playbackState?.progress_ms ?? 0;
  const durationMs = currentTrack?.duration_ms ?? 0;

  if (!state.isConnected) {
    return (
      <div className="relative">
        <button
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[#1DB954] hover:bg-[#1DB954]/10 rounded transition-colors"
          onClick={() => setState((prev) => ({ ...prev, showConnect: !prev.showConnect }))}
          disabled={state.isLoading}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          {state.isLoading ? "Connecting..." : "Connect Spotify"}
        </button>

        {state.showConnect && (
          <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#1a1b26] border border-[#3C3C3C] rounded-lg shadow-lg z-50 min-w-[220px]">
            <div className="text-[11px] text-[#a8abbe] mb-2 font-medium">
              Connect to Spotify
            </div>
            <p className="text-[10px] text-[#626880] mb-3">
              Connect your Spotify account to see what is playing while you code.
            </p>
            {state.error && (
              <div className="mb-3 p-2 bg-[#e05c6a]/10 border border-[#e05c6a]/20 rounded text-[10px] text-[#e05c6a]">
                {state.error}
              </div>
            )}
            <button
              className="w-full px-3 py-2 text-[11px] bg-[#1DB954] text-white rounded hover:bg-[#1ed760] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleConnect}
              disabled={state.isLoading}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              {state.isLoading ? "Connecting..." : "Connect with Spotify"}
            </button>
            <p className="text-[9px] text-[#626880] mt-2 text-center">
              Requires Spotify Premium
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Collapsed view */}
      {!state.isExpanded && currentTrack && (
        <button
          className="flex items-center gap-2 px-2 py-1 hover:bg-[#3C3C3C]/30 rounded transition-colors"
          onClick={() => setState((prev) => ({ ...prev, isExpanded: true }))}
        >
          <div className="relative w-4 h-4 flex-shrink-0">
            <Image
              src={currentTrack.album.images[0]?.url ?? ""}
              alt={currentTrack.album.name}
              width={16}
              height={16}
              className="w-full h-full rounded-sm object-cover"
            />
            {isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-sm">
                <div className="flex gap-0.5">
                  <div className="w-0.5 h-2 bg-[#1DB954] animate-pulse" />
                  <div className="w-0.5 h-3 bg-[#1DB954] animate-pulse delay-75" />
                  <div className="w-0.5 h-1.5 bg-[#1DB954] animate-pulse delay-150" />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] text-[#CCCCCC] truncate max-w-[100px]">
              {currentTrack.name}
            </span>
            <span className="text-[9px] text-[#626880] truncate max-w-[100px]">
              {currentTrack.artists.map((a) => a.name).join(", ")}
            </span>
          </div>
        </button>
      )}

      {/* Expanded view */}
      {state.isExpanded && currentTrack && (
        <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#1a1b26] border border-[#3C3C3C] rounded-lg shadow-lg z-50 w-[280px]">
          <div className="flex items-start gap-3">
            {/* Album art */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <Image
                src={currentTrack.album.images[0]?.url ?? ""}
                alt={currentTrack.album.name}
                width={64}
                height={64}
                className="w-full h-full rounded object-cover"
              />
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-[#1DB954] animate-pulse" />
                    <div className="w-1 h-6 bg-[#1DB954] animate-pulse delay-75" />
                    <div className="w-1 h-3 bg-[#1DB954] animate-pulse delay-150" />
                  </div>
                </div>
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-[#CCCCCC] font-medium truncate">
                {currentTrack.name}
              </div>
              <div className="text-[10px] text-[#626880] truncate">
                {currentTrack.artists.map((a) => a.name).join(", ")}
              </div>
              <div className="text-[9px] text-[#626880] truncate">
                {currentTrack.album.name}
              </div>

              {/* Progress bar */}
              <div className="mt-2">
                <div 
                  className="h-1 bg-[#3C3C3C] rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent = (e.clientX - rect.left) / rect.width;
                    handleSeek(Math.floor(percent * durationMs));
                  }}
                >
                  <div
                    className="h-full bg-[#1DB954] transition-all duration-1000"
                    style={{
                      width: `${(progressMs / durationMs) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-[#626880]">
                  <span>{formatTime(progressMs)}</span>
                  <span>{formatTime(durationMs)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-[#3C3C3C]">
            <button
              className={`p-1.5 transition-colors ${
                state.playbackState?.shuffle_state
                  ? "text-[#1DB954]"
                  : "text-[#626880] hover:text-[#CCCCCC]"
              }`}
              onClick={handleToggleShuffle}
              title="Shuffle"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
              </svg>
            </button>

            <button
              className="p-1.5 text-[#626880] hover:text-[#CCCCCC] transition-colors"
              onClick={handleSkipPrevious}
              title="Previous"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              className="p-2 bg-[#1DB954] rounded-full hover:scale-105 transition-transform"
              onClick={handleTogglePlayPause}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              className="p-1.5 text-[#626880] hover:text-[#CCCCCC] transition-colors"
              onClick={handleSkipNext}
              title="Next"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            <button
              className={`p-1.5 transition-colors ${
                state.playbackState?.repeat_state !== "off"
                  ? "text-[#1DB954]"
                  : "text-[#626880] hover:text-[#CCCCCC]"
              }`}
              onClick={handleToggleRepeat}
              title={`Repeat: ${state.playbackState?.repeat_state ?? "off"}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
              </svg>
            </button>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#3C3C3C]">
            <svg className="w-3 h-3 text-[#626880]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              value={state.volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="flex-1 h-1 bg-[#3C3C3C] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#1DB954] [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-[9px] text-[#626880] w-6 text-right">{state.volume}%</span>
          </div>

          {/* Close button */}
          <button
            className="absolute top-2 right-2 p-1 text-[#626880] hover:text-[#CCCCCC] transition-colors"
            onClick={() => setState((prev) => ({ ...prev, isExpanded: false }))}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>

          {/* Disconnect button */}
          <button
            className="mt-3 w-full px-2 py-1 text-[10px] text-[#e05c6a] hover:bg-[#e05c6a]/10 rounded transition-colors"
            onClick={handleDisconnect}
          >
            Disconnect Spotify
          </button>
        </div>
      )}

      {/* No track playing */}
      {state.isExpanded && !currentTrack && (
        <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#1a1b26] border border-[#3C3C3C] rounded-lg shadow-lg z-50 w-[280px]">
          <div className="text-[11px] text-[#a8abbe] mb-2 font-medium">
            No track playing
          </div>
          <p className="text-[10px] text-[#626880] mb-3">
            Start playing a song on Spotify to see it here.
          </p>
          <button
            className="mt-3 w-full px-2 py-1 text-[10px] text-[#e05c6a] hover:bg-[#e05c6a]/10 rounded transition-colors"
            onClick={handleDisconnect}
          >
            Disconnect Spotify
          </button>
        </div>
      )}
    </div>
  );
}
