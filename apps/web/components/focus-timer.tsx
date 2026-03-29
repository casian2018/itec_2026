"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type TimerMode = "work" | "break";
type TimerState = "idle" | "running" | "paused";

export function FocusTimer() {
  const [workDuration, setWorkDuration] = useState(25 * 60);
  const [breakDuration, setBreakDuration] = useState(5 * 60);
  const [timeLeft, setTimeLeft] = useState(workDuration);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [mode, setMode] = useState<TimerMode>("work");
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentDuration = mode === "work" ? workDuration : breakDuration;
  const progress = ((currentDuration - timeLeft) / currentDuration) * 100;

  // Handle timer interval
  useEffect(() => {
    if (timerState !== "running") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTimeLeft) => {
        if (prevTimeLeft <= 1) {
          // Timer completed
          setTimerState("idle");
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
  }, [timerState, mode, breakDuration, workDuration]);

  const startTimer = useCallback(() => {
    setTimerState("running");
  }, []);

  const pauseTimer = useCallback(() => {
    setTimerState("paused");
  }, []);

  const stopTimer = useCallback(() => {
    setTimerState("idle");
    setMode("work");
    setTimeLeft(workDuration);
  }, [workDuration]);

  const resetTimer = useCallback(() => {
    setTimerState("idle");
    setMode("work");
    setTimeLeft(workDuration);
    setSessions(0);
  }, [workDuration]);

  const skipToNext = useCallback(() => {
    setTimerState("idle");
    if (mode === "work") {
      setSessions((s) => s + 1);
      setMode("break");
      setTimeLeft(breakDuration);
    } else {
      setMode("work");
      setTimeLeft(workDuration);
    }
  }, [mode, breakDuration, workDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (timerState === "running") {
          pauseTimer();
        } else {
          startTimer();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        stopTimer();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetTimer();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        skipToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timerState, startTimer, pauseTimer, stopTimer, resetTimer, skipToNext]);

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

  const getStateLabel = () => {
    switch (timerState) {
      case "running":
        return "Running";
      case "paused":
        return "Paused";
      default:
        return "Ready";
    }
  };

  const getStateColor = () => {
    switch (timerState) {
      case "running":
        return "text-emerald-400";
      case "paused":
        return "text-amber-400";
      default:
        return "text-slate-400";
    }
  };

  const getModeColor = () => {
    return mode === "work" ? "text-emerald-400" : "text-amber-400";
  };

  const getModeBgColor = () => {
    return mode === "work" ? "bg-emerald-500/10" : "bg-amber-500/10";
  };

  const getProgressColor = () => {
    return mode === "work" ? "bg-emerald-500" : "bg-amber-500";
  };

  return (
    <div className="relative flex items-center gap-3 px-3 py-2">
      {/* Progress bar background */}
      <div className="absolute inset-0 h-full w-full overflow-hidden rounded-lg">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${getModeBgColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer content */}
      <div className="relative flex items-center gap-3 z-10">
        {/* Mode indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${mode === "work" ? "bg-emerald-500" : "bg-amber-500"} ${timerState === "running" ? "animate-pulse" : ""}`} />
          <span className={`text-xs font-semibold tracking-wide uppercase ${getModeColor()}`}>
            {mode === "work" ? "Focus" : "Break"}
          </span>
        </div>

        {/* Time display */}
        <div className="flex flex-col items-center">
          <span className="font-mono text-lg font-bold text-white tracking-wider">
            {formatTime(timeLeft)}
          </span>
          <span className={`text-[10px] font-medium ${getStateColor()}`}>
            {getStateLabel()}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {/* Start/Pause button */}
          {timerState !== "running" ? (
            <button
              className="group relative p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={startTimer}
              title="Start (Space)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Start
              </span>
            </button>
          ) : (
            <button
              className="group relative p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300 transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={pauseTimer}
              title="Pause (Space)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Pause
              </span>
            </button>
          )}

          {/* Stop button */}
          <button
            className="group relative p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300 transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={stopTimer}
            title="Stop (Esc)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Stop
            </span>
          </button>

          {/* Reset button */}
          <button
            className="group relative p-2 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 hover:text-slate-300 transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={resetTimer}
            title="Reset (R)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Reset
            </span>
          </button>

          {/* Skip button */}
          <button
            className="group relative p-2 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 hover:text-slate-300 transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={skipToNext}
            title="Skip (S)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Skip
            </span>
          </button>

          {/* Settings toggle */}
          <button
            className={`group relative p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
              showSettings 
                ? "bg-indigo-500/20 text-indigo-400" 
                : "bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 hover:text-slate-300"
            }`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Settings
            </span>
          </button>
        </div>

        {/* Session counter */}
        {sessions > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-500/10">
            <svg className="w-3 h-3 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-xs font-medium text-slate-300">
              {sessions} session{sessions !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute bottom-full left-0 mb-3 p-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl z-50 min-w-[280px] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Timer Settings</h3>
            <button
              className="p-1 text-slate-400 hover:text-white transition-colors"
              onClick={() => setShowSettings(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Duration inputs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <label className="text-xs font-medium text-slate-300">Focus Duration</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={formatDurationInput(workDuration)}
                    onChange={(e) => {
                      const newDuration = parseDurationInput(e.target.value);
                      if (newDuration > 0) {
                        setWorkDuration(newDuration);
                        if (mode === "work" && timerState === "idle") {
                          setTimeLeft(newDuration);
                        }
                      }
                    }}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  />
                  <span className="text-xs text-slate-400">min</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <label className="text-xs font-medium text-slate-300">Break Duration</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formatDurationInput(breakDuration)}
                    onChange={(e) => {
                      const newDuration = parseDurationInput(e.target.value);
                      if (newDuration > 0) {
                        setBreakDuration(newDuration);
                        if (mode === "break" && timerState === "idle") {
                          setTimeLeft(newDuration);
                        }
                      }
                    }}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  />
                  <span className="text-xs text-slate-400">min</span>
                </div>
              </div>
            </div>

            {/* Quick presets */}
            <div className="pt-3 border-t border-slate-700/50">
              <div className="text-xs font-medium text-slate-400 mb-2">Quick Presets</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className="px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => {
                    setWorkDuration(25 * 60);
                    setBreakDuration(5 * 60);
                    if (timerState === "idle") {
                      setTimeLeft(25 * 60);
                    }
                  }}
                >
                  25/5
                </button>
                <button
                  className="px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => {
                    setWorkDuration(50 * 60);
                    setBreakDuration(10 * 60);
                    if (timerState === "idle") {
                      setTimeLeft(50 * 60);
                    }
                  }}
                >
                  50/10
                </button>
                <button
                  className="px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => {
                    setWorkDuration(90 * 60);
                    setBreakDuration(20 * 60);
                    if (timerState === "idle") {
                      setTimeLeft(90 * 60);
                    }
                  }}
                >
                  90/20
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-700/50 space-y-2">
              <button
                className="w-full px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
                onClick={() => {
                  setSessions(0);
                  setShowSettings(false);
                }}
              >
                Reset Sessions
              </button>
            </div>

            {/* Keyboard shortcuts */}
            <div className="pt-3 border-t border-slate-700/50">
              <div className="text-xs font-medium text-slate-400 mb-2">Keyboard Shortcuts</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/30 rounded">
                  <span className="text-slate-400">Space</span>
                  <span className="text-slate-300">Start/Pause</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/30 rounded">
                  <span className="text-slate-400">Esc</span>
                  <span className="text-slate-300">Stop</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/30 rounded">
                  <span className="text-slate-400">R</span>
                  <span className="text-slate-300">Reset</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800/30 rounded">
                  <span className="text-slate-400">S</span>
                  <span className="text-slate-300">Skip</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
