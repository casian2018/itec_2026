"use client";

import { useState, useEffect, useCallback } from "react";

interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number;
  progress: number;
  isPlaying: boolean;
}

export function SpotifyPlayer() {
  const [isConnected, setIsConnected] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [volume, setVolume] = useState(50);
  const [showConnect, setShowConnect] = useState(false);

  // Simulate Spotify connection (in real implementation, this would use Spotify Web Playback SDK)
  const connectSpotify = useCallback(() => {
    // In a real implementation, this would:
    // 1. Redirect to Spotify OAuth
    // 2. Get access token
    // 3. Initialize Web Playback SDK
    // 4. Connect to Spotify player
    
    // For now, simulate a connected state with mock data
    setIsConnected(true);
    setShowConnect(false);
    setCurrentTrack({
      name: "Lofi Coding Beats",
      artist: "ChillHop Music",
      album: "Focus Flow",
      albumArt: "https://i.scdn.co/image/ab67616d0000b273e8b066f70c206551210d902b",
      duration: 180,
      progress: 45,
      isPlaying: true,
    });
  }, []);

  const disconnectSpotify = useCallback(() => {
    setIsConnected(false);
    setCurrentTrack(null);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (currentTrack) {
      setCurrentTrack({
        ...currentTrack,
        isPlaying: !currentTrack.isPlaying,
      });
    }
  }, [currentTrack]);

  const skipNext = useCallback(() => {
    // In real implementation, this would call Spotify API
    console.log("Skip to next track");
  }, []);

  const skipPrevious = useCallback(() => {
    // In real implementation, this would call Spotify API
    console.log("Skip to previous track");
  }, []);

  // Simulate progress update
  useEffect(() => {
    if (!currentTrack?.isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTrack((prev) => {
        if (!prev) return null;
        const newProgress = prev.progress + 1;
        if (newProgress >= prev.duration) {
          return { ...prev, progress: 0 };
        }
        return { ...prev, progress: newProgress };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTrack?.isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[#1DB954] hover:bg-[#1DB954]/10 rounded transition-colors"
          onClick={() => setShowConnect(!showConnect)}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Connect Spotify
        </button>

        {showConnect && (
          <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#1a1b26] border border-[#3C3C3C] rounded-lg shadow-lg z-50 min-w-[220px]">
            <div className="text-[11px] text-[#a8abbe] mb-2 font-medium">
              Connect to Spotify
            </div>
            <p className="text-[10px] text-[#626880] mb-3">
              Connect your Spotify account to see what&apos;s playing while you code.
            </p>
            <button
              className="w-full px-3 py-2 text-[11px] bg-[#1DB954] text-white rounded hover:bg-[#1ed760] transition-colors flex items-center justify-center gap-2"
              onClick={connectSpotify}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Connect with Spotify
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
      {!isExpanded && currentTrack && (
        <button
          className="flex items-center gap-2 px-2 py-1 hover:bg-[#3C3C3C]/30 rounded transition-colors"
          onClick={() => setIsExpanded(true)}
        >
          <div className="relative w-4 h-4 flex-shrink-0">
            <img
              src={currentTrack.albumArt}
              alt={currentTrack.album}
              className="w-full h-full rounded-sm object-cover"
            />
            {currentTrack.isPlaying && (
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
              {currentTrack.artist}
            </span>
          </div>
        </button>
      )}

      {/* Expanded view */}
      {isExpanded && currentTrack && (
        <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#1a1b26] border border-[#3C3C3C] rounded-lg shadow-lg z-50 w-[280px]">
          <div className="flex items-start gap-3">
            {/* Album art */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <img
                src={currentTrack.albumArt}
                alt={currentTrack.album}
                className="w-full h-full rounded object-cover"
              />
              {currentTrack.isPlaying && (
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
                {currentTrack.artist}
              </div>
              <div className="text-[9px] text-[#626880] truncate">
                {currentTrack.album}
              </div>

              {/* Progress bar */}
              <div className="mt-2">
                <div className="h-1 bg-[#3C3C3C] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1DB954] transition-all duration-1000"
                    style={{
                      width: `${(currentTrack.progress / currentTrack.duration) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-[#626880]">
                  <span>{formatTime(currentTrack.progress)}</span>
                  <span>{formatTime(currentTrack.duration)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-[#3C3C3C]">
            <button
              className="p-1.5 text-[#626880] hover:text-[#CCCCCC] transition-colors"
              onClick={skipPrevious}
              title="Previous"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              className="p-2 bg-[#1DB954] rounded-full hover:scale-105 transition-transform"
              onClick={togglePlayPause}
              title={currentTrack.isPlaying ? "Pause" : "Play"}
            >
              {currentTrack.isPlaying ? (
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
              onClick={skipNext}
              title="Next"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
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
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="flex-1 h-1 bg-[#3C3C3C] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#1DB954] [&::-webkit-slider-thumb]:rounded-full"
            />
            <span className="text-[9px] text-[#626880] w-6 text-right">{volume}%</span>
          </div>

          {/* Close button */}
          <button
            className="absolute top-2 right-2 p-1 text-[#626880] hover:text-[#CCCCCC] transition-colors"
            onClick={() => setIsExpanded(false)}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>

          {/* Disconnect button */}
          <button
            className="mt-3 w-full px-2 py-1 text-[10px] text-[#e05c6a] hover:bg-[#e05c6a]/10 rounded transition-colors"
            onClick={disconnectSpotify}
          >
            Disconnect Spotify
          </button>
        </div>
      )}
    </div>
  );
}
