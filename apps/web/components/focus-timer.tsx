"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";

type TimerMode = "work" | "break";
type TimerState = "idle" | "running" | "paused";
type AmbientSound = "none" | "white-noise" | "rain" | "forest" | "cafe";

interface TimerSettings {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundEnabled: boolean;
  ambientSound: AmbientSound;
  dailyGoal: number;
}

interface SessionStats {
  date: string;
  completedSessions: number;
  totalFocusMinutes: number;
}

const DEFAULT_SETTINGS: TimerSettings = {
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  longBreakDuration: 15 * 60,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  soundEnabled: true,
  ambientSound: "none",
  dailyGoal: 8,
};

const STORAGE_KEY = "itecify:focus-timer";
const STATS_KEY = "itecify:focus-timer-stats";

// Audio context for sound generation
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("AudioContext not supported");
    }
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playNotificationSound(type: "work-complete" | "break-complete") {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === "work-complete") {
      // Pleasant chime for work completion
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } else {
      // Softer tone for break completion
      oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime + 0.15); // C5
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Could not play notification sound:", e);
  }
}

// Ambient sound generators
function createWhiteNoise(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1000;
  
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  return source;
}

function createRainSound(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * 0.3;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 0.5;
  
  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  return source;
}

function createForestSound(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * 0.2;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  
  const gain = ctx.createGain();
  gain.gain.value = 0.06;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  return source;
}

function createCafeSound(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    output[i] = (Math.random() * 2 - 1) * 0.25;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.3;
  
  const gain = ctx.createGain();
  gain.gain.value = 0.07;
  
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  return source;
}

export function FocusTimer() {
  // Settings state - use lazy initializer to load from localStorage
  const [settings, setSettings] = useState<TimerSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn("Could not load timer settings:", e);
    }
    return DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS.workDuration;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.workDuration || DEFAULT_SETTINGS.workDuration;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SETTINGS.workDuration;
  });
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [mode, setMode] = useState<TimerMode>("work");
  const [sessions, setSessions] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [showTaskInput, setShowTaskInput] = useState(false);
  
  // Stats state - use lazy initializer to load from localStorage
  const [stats, setStats] = useState<SessionStats[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const storedStats = localStorage.getItem(STATS_KEY);
      if (storedStats) {
        return JSON.parse(storedStats);
      }
    } catch (e) {
      console.warn("Could not load timer stats:", e);
    }
    return [];
  });
  
  // Ambient sound state
  const [ambientSource, setAmbientSource] = useState<AudioBufferSourceNode | null>(null);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  
  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Settings and stats are now loaded via lazy initializers in useState
  
  // Save settings to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Could not save timer settings:", e);
    }
  }, [settings]);
  
  // Save stats to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn("Could not save timer stats:", e);
    }
  }, [stats]);
  
  // Calculate progress
  const currentDuration = mode === "work" ? settings.workDuration : 
    (sessions > 0 && sessions % settings.sessionsBeforeLongBreak === 0) 
      ? settings.longBreakDuration 
      : settings.breakDuration;
  const progress = ((currentDuration - timeLeft) / currentDuration) * 100;
  
  // Get today's stats
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return stats.find(s => s.date === today) || { date: today, completedSessions: 0, totalFocusMinutes: 0 };
  }, [stats]);
  
  // Daily goal progress
  const dailyProgress = Math.min((todayStats.completedSessions / settings.dailyGoal) * 100, 100);
  
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
      setTimeLeft((prevTimeLeft: number) => {
        if (prevTimeLeft <= 1) {
          // Timer completed
          setTimerState("idle");
          
          if (mode === "work") {
            // Work session completed
            const newSessions = sessions + 1;
            setSessions(newSessions);
            
            // Update stats
            const today = new Date().toISOString().split('T')[0];
            setStats(prev => {
              const existing = prev.find(s => s.date === today);
              if (existing) {
                return prev.map(s => s.date === today 
                  ? { ...s, completedSessions: s.completedSessions + 1, totalFocusMinutes: s.totalFocusMinutes + Math.round(settings.workDuration / 60) }
                  : s
                );
              }
              return [...prev, { date: today, completedSessions: 1, totalFocusMinutes: Math.round(settings.workDuration / 60) }];
            });
            
            // Play sound
            if (settings.soundEnabled) {
              playNotificationSound("work-complete");
            }
            
            // Determine break type
            const isLongBreak = newSessions % settings.sessionsBeforeLongBreak === 0;
            const breakDuration = isLongBreak ? settings.longBreakDuration : settings.breakDuration;
            
            setMode("break");
            if (settings.autoStartBreaks) {
              setTimerState("running");
            }
            return breakDuration;
          } else {
            // Break completed
            if (settings.soundEnabled) {
              playNotificationSound("break-complete");
            }
            
            setMode("work");
            if (settings.autoStartPomodoros) {
              setTimerState("running");
            }
            return settings.workDuration;
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
  }, [timerState, mode, sessions, settings]);

  // Ambient sound control
  useEffect(() => {
    if (settings.ambientSound === "none" || timerState !== "running") {
      if (ambientSourceRef.current) {
        ambientSourceRef.current.stop();
        ambientSourceRef.current = null;
      }
      return;
    }
    
    if (isAmbientPlaying) return;
    
    try {
      const ctx = getAudioContext();
      let source: AudioBufferSourceNode;
      
      switch (settings.ambientSound) {
        case "white-noise":
          source = createWhiteNoise(ctx);
          break;
        case "rain":
          source = createRainSound(ctx);
          break;
        case "forest":
          source = createForestSound(ctx);
          break;
        case "cafe":
          source = createCafeSound(ctx);
          break;
        default:
          return;
      }
      
      source.start();
      ambientSourceRef.current = source;
    } catch (e) {
      console.warn("Could not start ambient sound:", e);
    }
    
    return () => {
      if (ambientSourceRef.current) {
        ambientSourceRef.current.stop();
        ambientSourceRef.current = null;
      }
    };
  }, [settings.ambientSound, timerState, isAmbientPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (ambientSourceRef.current) {
        ambientSourceRef.current.stop();
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    setTimerState("running");
  }, []);

  const pauseTimer = useCallback(() => {
    setTimerState("paused");
  }, []);

  const stopTimer = useCallback(() => {
    setTimerState("idle");
    setMode("work");
    setTimeLeft(settings.workDuration);
  }, [settings.workDuration]);

  const resetTimer = useCallback(() => {
    setTimerState("idle");
    setMode("work");
    setTimeLeft(settings.workDuration);
    setSessions(0);
  }, [settings.workDuration]);

  const skipToNext = useCallback(() => {
    setTimerState("idle");
    if (mode === "work") {
      const newSessions = sessions + 1;
      setSessions(newSessions);
      
      const isLongBreak = newSessions % settings.sessionsBeforeLongBreak === 0;
      const breakDuration = isLongBreak ? settings.longBreakDuration : settings.breakDuration;
      setMode("break");
      setTimeLeft(breakDuration);
    } else {
      setMode("work");
      setTimeLeft(settings.workDuration);
    }
  }, [mode, sessions, settings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
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
        return mode === "work" ? "Focusing..." : "On Break";
      case "paused":
        return "Paused";
      default:
        return "Ready";
    }
  };

  const getModeLabel = () => {
    if (mode === "work") return "Focus";
    const isLongBreak = sessions > 0 && sessions % settings.sessionsBeforeLongBreak === 0;
    return isLongBreak ? "Long Break" : "Short Break";
  };

  const getMotivationalMessage = () => {
    if (mode === "work") {
      if (timerState === "running") {
        const messages = [
          "Stay focused!",
          "You're doing great!",
          "Keep pushing!",
          "Deep work time!",
          "Concentrate!",
        ];
        return messages[Math.floor(timeLeft / 100) % messages.length];
      }
      return "Time to focus";
    }
    return "Take a break!";
  };

  // SVG circle parameters
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center gap-4 p-4">
      {/* Main timer display */}
      <div className="relative flex flex-col items-center">
        {/* Circular progress */}
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-slate-700/50"
            />
            {/* Progress circle */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className={`transition-all duration-1000 ease-linear ${
                mode === "work" ? "text-emerald-500" : "text-amber-500"
              }`}
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold text-white tracking-wider">
              {formatTime(timeLeft)}
            </span>
            <span className={`text-xs font-medium mt-1 ${
              timerState === "running" 
                ? mode === "work" ? "text-emerald-400" : "text-amber-400"
                : timerState === "paused" ? "text-amber-400" : "text-slate-400"
            }`}>
              {getStateLabel()}
            </span>
          </div>
          
          {/* Pulse animation when running */}
          {timerState === "running" && (
            <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
              mode === "work" ? "bg-emerald-500" : "bg-amber-500"
            }`} />
          )}
        </div>

        {/* Mode and task info */}
        <div className="flex flex-col items-center mt-3 gap-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              mode === "work" ? "bg-emerald-500" : "bg-amber-500"
            } ${timerState === "running" ? "animate-pulse" : ""}`} />
            <span className={`text-sm font-semibold tracking-wide ${
              mode === "work" ? "text-emerald-400" : "text-amber-400"
            }`}>
              {getModeLabel()}
            </span>
          </div>
          
          {/* Task name */}
          {showTaskInput ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                placeholder="What are you working on?"
                className="px-2 py-1 text-xs bg-slate-800/50 border border-slate-700/50 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") setShowTaskInput(false);
                  if (e.key === "Escape") {
                    setCurrentTask("");
                    setShowTaskInput(false);
                  }
                }}
              />
              <button
                onClick={() => setShowTaskInput(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✓
              </button>
            </div>
          ) : currentTask ? (
            <button
              onClick={() => setShowTaskInput(true)}
              className="text-xs text-slate-400 hover:text-white truncate max-w-[200px]"
              title="Click to edit task"
            >
              📋 {currentTask}
            </button>
          ) : (
            <button
              onClick={() => setShowTaskInput(true)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              + Add task
            </button>
          )}
          
          <span className="text-[10px] text-slate-500 mt-1">
            {getMotivationalMessage()}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Start/Pause button */}
        {timerState !== "running" ? (
          <button
            className="group relative p-2.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={startTimer}
            title="Start (Space)"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Start
            </span>
          </button>
        ) : (
          <button
            className="group relative p-2.5 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300 transition-all duration-200 hover:scale-110 active:scale-95"
            onClick={pauseTimer}
            title="Pause (Space)"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Pause
            </span>
          </button>
        )}

        {/* Stop button */}
        <button
          className="group relative p-2 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300 transition-all duration-200 hover:scale-110 active:scale-95"
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
          className="group relative p-2 rounded-full bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 hover:text-slate-300 transition-all duration-200 hover:scale-110 active:scale-95"
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
          className="group relative p-2 rounded-full bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 hover:text-slate-300 transition-all duration-200 hover:scale-110 active:scale-95"
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

        {/* Divider */}
        <div className="w-px h-6 bg-slate-700/50 mx-1" />

        {/* Stats button */}
        <button
          className={`group relative p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
            showStats 
              ? "bg-indigo-500/20 text-indigo-400" 
              : "bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 hover:text-slate-300"
          }`}
          onClick={() => setShowStats(!showStats)}
          title="Statistics"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Stats
          </span>
        </button>

        {/* Settings button */}
        <button
          className={`group relative p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
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

      {/* Session counter and daily goal */}
      <div className="flex items-center gap-4">
        {sessions > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-xs font-medium text-slate-300">
              {sessions} session{sessions !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        
        {/* Daily goal progress */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs text-slate-400">Daily:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${dailyProgress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-300">
              {todayStats.completedSessions}/{settings.dailyGoal}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics panel */}
      {showStats && (
        <div className="absolute bottom-full left-0 mb-3 p-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl z-50 min-w-[300px] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Statistics</h3>
            <button
              className="p-1 text-slate-400 hover:text-white transition-colors"
              onClick={() => setShowStats(false)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Today's stats */}
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs font-medium text-slate-400 mb-2">Today</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-bold text-white">{todayStats.completedSessions}</div>
                  <div className="text-xs text-slate-400">Sessions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{todayStats.totalFocusMinutes}</div>
                  <div className="text-xs text-slate-400">Minutes</div>
                </div>
              </div>
            </div>

            {/* Weekly overview */}
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">Last 7 Days</div>
              <div className="flex items-end gap-1 h-16">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - i));
                  const dateStr = date.toISOString().split('T')[0];
                  const dayStats = stats.find(s => s.date === dateStr);
                  const sessions = dayStats?.completedSessions || 0;
                  const maxSessions = Math.max(...stats.map(s => s.completedSessions), 1);
                  const height = (sessions / maxSessions) * 100;
                  
                  return (
                    <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-indigo-500/30 rounded-t transition-all duration-300"
                        style={{ height: `${height}%`, minHeight: sessions > 0 ? '4px' : '0' }}
                      />
                      <span className="text-[9px] text-slate-500">
                        {date.toLocaleDateString('en', { weekday: 'short' }).charAt(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total stats */}
            <div className="pt-3 border-t border-slate-700/50">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-white">
                    {stats.reduce((sum, s) => sum + s.completedSessions, 0)}
                  </div>
                  <div className="text-[10px] text-slate-400">Total Sessions</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">
                    {stats.reduce((sum, s) => sum + s.totalFocusMinutes, 0)}
                  </div>
                  <div className="text-[10px] text-slate-400">Total Minutes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute bottom-full left-0 mb-3 p-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl z-50 min-w-[320px] animate-in fade-in slide-in-from-bottom-2 duration-200">
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

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
                    value={formatDurationInput(settings.workDuration)}
                    onChange={(e) => {
                      const newDuration = parseDurationInput(e.target.value);
                      if (newDuration > 0) {
                        setSettings(s => ({ ...s, workDuration: newDuration }));
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
                  <label className="text-xs font-medium text-slate-300">Short Break</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formatDurationInput(settings.breakDuration)}
                    onChange={(e) => {
                      const newDuration = parseDurationInput(e.target.value);
                      if (newDuration > 0) {
                        setSettings(s => ({ ...s, breakDuration: newDuration }));
                      }
                    }}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                  />
                  <span className="text-xs text-slate-400">min</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <label className="text-xs font-medium text-slate-300">Long Break</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formatDurationInput(settings.longBreakDuration)}
                    onChange={(e) => {
                      const newDuration = parseDurationInput(e.target.value);
                      if (newDuration > 0) {
                        setSettings(s => ({ ...s, longBreakDuration: newDuration }));
                      }
                    }}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  />
                  <span className="text-xs text-slate-400">min</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  <label className="text-xs font-medium text-slate-300">Sessions before long break</label>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.sessionsBeforeLongBreak}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 10) {
                      setSettings(s => ({ ...s, sessionsBeforeLongBreak: val }));
                    }
                  }}
                  className="w-16 px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="pt-3 border-t border-slate-700/50">
              <div className="text-xs font-medium text-slate-400 mb-2">Quick Presets</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className="px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => {
                    setSettings(s => ({
                      ...s,
                      workDuration: 25 * 60,
                      breakDuration: 5 * 60,
                      longBreakDuration: 15 * 60,
                      sessionsBeforeLongBreak: 4,
                    }));
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
                    setSettings(s => ({
                      ...s,
                      workDuration: 50 * 60,
                      breakDuration: 10 * 60,
                      longBreakDuration: 20 * 60,
                      sessionsBeforeLongBreak: 3,
                    }));
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
                    setSettings(s => ({
                      ...s,
                      workDuration: 90 * 60,
                      breakDuration: 20 * 60,
                      longBreakDuration: 30 * 60,
                      sessionsBeforeLongBreak: 2,
                    }));
                    if (timerState === "idle") {
                      setTimeLeft(90 * 60);
                    }
                  }}
                >
                  90/20
                </button>
              </div>
            </div>

            {/* Auto-start options */}
            <div className="pt-3 border-t border-slate-700/50 space-y-2">
              <div className="text-xs font-medium text-slate-400 mb-2">Automation</div>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs text-slate-300">Auto-start breaks</span>
                <button
                  onClick={() => setSettings(s => ({ ...s, autoStartBreaks: !s.autoStartBreaks }))}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    settings.autoStartBreaks ? "bg-emerald-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    settings.autoStartBreaks ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs text-slate-300">Auto-start pomodoros</span>
                <button
                  onClick={() => setSettings(s => ({ ...s, autoStartPomodoros: !s.autoStartPomodoros }))}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    settings.autoStartPomodoros ? "bg-emerald-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    settings.autoStartPomodoros ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
            </div>

            {/* Sound settings */}
            <div className="pt-3 border-t border-slate-700/50 space-y-2">
              <div className="text-xs font-medium text-slate-400 mb-2">Sound</div>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-xs text-slate-300">Notification sounds</span>
                <button
                  onClick={() => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    settings.soundEnabled ? "bg-emerald-500" : "bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    settings.soundEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </button>
              </label>
              
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-300">Ambient sound</span>
                <select
                  value={settings.ambientSound}
                  onChange={(e) => setSettings(s => ({ ...s, ambientSound: e.target.value as AmbientSound }))}
                  className="px-2 py-1 text-xs bg-slate-800/50 border border-slate-700/50 rounded text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="none">None</option>
                  <option value="white-noise">White Noise</option>
                  <option value="rain">Rain</option>
                  <option value="forest">Forest</option>
                  <option value="cafe">Café</option>
                </select>
              </div>
            </div>

            {/* Daily goal */}
            <div className="pt-3 border-t border-slate-700/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <label className="text-xs font-medium text-slate-300">Daily goal (sessions)</label>
                </div>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.dailyGoal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 20) {
                      setSettings(s => ({ ...s, dailyGoal: val }));
                    }
                  }}
                  className="w-16 px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
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
              <button
                className="w-full px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-500/10 rounded-lg transition-all duration-200"
                onClick={() => {
                  setSettings(DEFAULT_SETTINGS);
                  setTimeLeft(DEFAULT_SETTINGS.workDuration);
                }}
              >
                Reset to Defaults
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
