"use client";

import type { editor as MonacoEditor } from "monaco-editor";

export const IDE_THEME_STORAGE_KEY = "itecify-ide-theme";

export type IdeThemeId = "dark" | "light" | "github" | "neon" | "itecify";

export type IdeThemeDefinition = {
  id: IdeThemeId;
  label: string;
  description: string;
  monacoTheme: string;
};

type MonacoModule = typeof import("monaco-editor");

type MonacoThemeMap = Record<IdeThemeId, MonacoEditor.IStandaloneThemeData>;

export const IDE_THEMES: IdeThemeDefinition[] = [
  {
    id: "dark",
    label: "Dark",
    description: "VS Code-like dark workbench.",
    monacoTheme: "itecify-dark",
  },
  {
    id: "light",
    label: "Light",
    description: "Bright editor chrome with a clean product feel.",
    monacoTheme: "itecify-light",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Neutral GitHub-inspired IDE surfaces and editor colors.",
    monacoTheme: "itecify-github",
  },
  {
    id: "neon",
    label: "Neon",
    description: "Purple hacker aesthetic for demos.",
    monacoTheme: "itecify-neon",
  },
  {
    id: "itecify",
    label: "iTECify",
    description: "Teal collaborative workspace chrome (default for /dev sessions).",
    monacoTheme: "itecify-itecify",
  },
];

const DEFAULT_IDE_THEME_ID: IdeThemeId = "itecify";

const monacoThemes: MonacoThemeMap = {
  dark: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955" },
      { token: "keyword", foreground: "569CD6" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "type.identifier", foreground: "4EC9B0" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#2a2d2e",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#3a3d41",
      "editorCursor.foreground": "#aeafad",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorGutter.background": "#1e1e1e",
      "editorIndentGuide.background1": "#404040",
      "editorIndentGuide.activeBackground1": "#707070",
    },
  },
  light: {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7280" },
      { token: "keyword", foreground: "2563eb" },
      { token: "string", foreground: "0f766e" },
      { token: "number", foreground: "b45309" },
      { token: "type.identifier", foreground: "7c3aed" },
    ],
    colors: {
      "editor.background": "#f7fbff",
      "editor.foreground": "#132033",
      "editor.lineHighlightBackground": "#e7f0ff",
      "editor.selectionBackground": "#bfdbfe66",
      "editor.inactiveSelectionBackground": "#dbeafe66",
      "editorCursor.foreground": "#2563eb",
      "editorLineNumber.foreground": "#8a99ae",
      "editorLineNumber.activeForeground": "#1f2937",
      "editorGutter.background": "#f7fbff",
      "editorIndentGuide.background1": "#d9e3f1",
      "editorIndentGuide.activeBackground1": "#9fb3ca",
    },
  },
  github: {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e7781" },
      { token: "keyword", foreground: "cf222e" },
      { token: "string", foreground: "0a3069" },
      { token: "number", foreground: "953800" },
      { token: "type.identifier", foreground: "8250df" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292f",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editor.selectionBackground": "#ddf4ff",
      "editor.inactiveSelectionBackground": "#eaeef2",
      "editorCursor.foreground": "#0969da",
      "editorLineNumber.foreground": "#8c959f",
      "editorLineNumber.activeForeground": "#57606a",
      "editorGutter.background": "#ffffff",
      "editorIndentGuide.background1": "#d0d7de",
      "editorIndentGuide.activeBackground1": "#8c959f",
    },
  },
  neon: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8f79b3" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "86efac" },
      { token: "number", foreground: "f9a8d4" },
      { token: "type.identifier", foreground: "22d3ee" },
    ],
    colors: {
      "editor.background": "#0f0820",
      "editor.foreground": "#f6edff",
      "editor.lineHighlightBackground": "#20103a",
      "editor.selectionBackground": "#7e22ce66",
      "editor.inactiveSelectionBackground": "#7e22ce33",
      "editorCursor.foreground": "#c084fc",
      "editorLineNumber.foreground": "#7c6b98",
      "editorLineNumber.activeForeground": "#f5eaff",
      "editorGutter.background": "#0f0820",
      "editorIndentGuide.background1": "#2a1745",
      "editorIndentGuide.activeBackground1": "#55307f",
    },
  },
  itecify: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "3d4560" },
      { token: "keyword", foreground: "8b7cf8" },
      { token: "string", foreground: "7ecb95" },
      { token: "number", foreground: "e8a23a" },
      { token: "type.identifier", foreground: "e07b8a" },
      { token: "function", foreground: "57a6f0" },
    ],
    colors: {
      "editor.background": "#0b0d12",
      "editor.foreground": "#e8eaf2",
      "editor.lineHighlightBackground": "#13161f",
      "editor.selectionBackground": "rgba(78, 205, 196, 0.22)",
      "editor.inactiveSelectionBackground": "rgba(78, 205, 196, 0.12)",
      "editorCursor.foreground": "#4ecdc4",
      "editorLineNumber.foreground": "#3d4259",
      "editorLineNumber.activeForeground": "#a8abbe",
      "editorGutter.background": "#0b0d12",
      "editorIndentGuide.background1": "#242840",
      "editorIndentGuide.activeBackground1": "#3d4259",
    },
  },
};

let hasRegisteredMonacoThemes = false;

export function getIdeTheme(themeId: string | null | undefined) {
  return (
    IDE_THEMES.find((theme) => theme.id === themeId) ??
    IDE_THEMES.find((theme) => theme.id === DEFAULT_IDE_THEME_ID)!
  );
}

export function getStoredIdeTheme() {
  if (typeof window === "undefined") {
    return DEFAULT_IDE_THEME_ID;
  }

  return getIdeTheme(window.localStorage.getItem(IDE_THEME_STORAGE_KEY)).id;
}

export function persistIdeTheme(themeId: IdeThemeId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(IDE_THEME_STORAGE_KEY, themeId);
}

export function getMonacoThemeName(themeId: IdeThemeId) {
  return getIdeTheme(themeId).monacoTheme;
}

export function registerMonacoThemes(monaco: MonacoModule) {
  if (hasRegisteredMonacoThemes) {
    return;
  }

  IDE_THEMES.forEach((theme) => {
    monaco.editor.defineTheme(theme.monacoTheme, monacoThemes[theme.id]);
  });

  hasRegisteredMonacoThemes = true;
}
