"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type TimerMode = "work" | "break";

export function FocusTimer() {
  const [workDuration, setWorkDuration] = useState(25 * 60);
  const [breakDuration, setBreakDuration] = useState(5 * 60);
  const [timeLeft, setTimeLeft] = useState(workDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>("work");
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentDuration = mode === "work" ? workDuration : breakDuration;
  const progress = ((currentDuration - timeLeft) / currentDuration) * 100;

  // Handle timer interval
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTimeLeft) => {
        if (prevTimeLeft <= 1) {
          // Timer completed - handle in callback to avoid setState in effect
          setIsRunning(false);
          if (mode === "work") {
            setSessions((s) => s + 1);
            setMode("break");
            return breakDuration;
          } else {
            setMode("work");
            return workDuration;
          }
        }
        return prevTimeLeft - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, mode, breakDuration, workDuration]);

  const toggleTimer = useCallback(() => {
    setIsRunning(!isRunning);
  }, [isRunning]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setMode("work");
    setTimeLeft(workDuration);
  }, [workDuration]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const formatDurationInput = (seconds: number) => {
    return Math.floor(seconds / 60).toString();
  };

  const parseDurationInput = (value: string) => {
    const minutes = parseInt(value, 10);
    return isNaN(minutes) ? 0 : minutes * 60;
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Progress bar background */}
      <div className="absolute inset-0 h-full w-full overflow-hidden rounded">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            mode === "work" ? "bg-[#4ecdc4]/20" : "bg-[#e8a23a]/20"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer content */}
      <div className="relative flex items-center gap-2 z-10">
        {/* Mode indicator */}
        <span
          className={`text-[10px] font-medium ${
            mode === "work" ? "text-[#4ecdc4]" : "text-[#e8a23a]"
          }`}
        >
          {mode === "work" ? "WORK" : "BREAK"}
        </span>

        {/* Time display */}
        <span className="font-mono text-[11px] text-[#CCCCCC]">
          {formatTime(timeLeft)}
        </span>

        {/* Controls */}
        <button
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            isRunning
              ? "bg-[#e05c6a]/20 text-[#e05c6a] hover:bg-[#e05c6a]/30"
              : "bg-[#4ecdc4]/20 text-[#4ecdc4] hover:bg-[#4ecdc4]/30"
          }`}
          onClick={toggleTimer}
        >
          {isRunning ? "⏸" : "▶"}
        </button>

        <button
          className="px-2 py-0.5 text-[10px] text-[#626880] hover:text-[#a8abbe] transition-colors"
          onClick={resetTimer}
        >
          ↺
        </button>

        {/* Settings toggle */}
        <button
          className="px-1 py-0.5 text-[10px] text-[#626880] hover:text-[#a8abbe] transition-colors"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙
        </button>

        {/* Session counter */}
        {sessions > 0 && (
          <span className="text-[10px] text-[#626880]">
            {sessions} session{sessions !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute bottom-full left-0 mb-2 p-3 bg-[#1a1b26] border border-[#3C3C3C] rounded-lg shadow-lg z-50 min-w-[200px]">
          <div className="text-[11px] text-[#a8abbe] mb-2 font-medium">
            Timer Settings
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] text-[#626880]">Work (min)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={formatDurationInput(workDuration)}
                onChange={(e) => {
                  const newDuration = parseDurationInput(e.target.value);
                  if (newDuration > 0) {
                    setWorkDuration(newDuration);
                    if (mode === "work" && !isRunning) {
                      setTimeLeft(newDuration);
                    }
                  }
                }}
                className="w-16 px-2 py-1 text-[10px] bg-[#0f1118] border border-[#3C3C3C] rounded text-[#CCCCCC] focus:outline-none focus:border-[#4ecdc4]"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] text-[#626880]">Break (min)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={formatDurationInput(breakDuration)}
                onChange={(e) => {
                  const newDuration = parseDurationInput(e.target.value);
                  if (newDuration > 0) {
                    setBreakDuration(newDuration);
                    if (mode === "break" && !isRunning) {
                      setTimeLeft(newDuration);
                    }
                  }
                }}
                className="w-16 px-2 py-1 text-[10px] bg-[#0f1118] border border-[#3C3C3C] rounded text-[#CCCCCC] focus:outline-none focus:border-[#e8a23a]"
              />
            </div>

            <div className="pt-2 border-t border-[#3C3C3C]">
              <button
                className="w-full px-2 py-1 text-[10px] text-[#e05c6a] hover:bg-[#e05c6a]/10 rounded transition-colors"
                onClick={() => {
                  setSessions(0);
                  setShowSettings(false);
                }}
              >
                Reset Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
