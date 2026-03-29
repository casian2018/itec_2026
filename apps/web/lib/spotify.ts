"use client";

const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "user-read-email",
  "user-read-private",
].join(" ");

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
  uri: string;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device: {
    id: string;
    name: string;
    type: string;
    volume_percent: number;
  } | null;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
}

// Generate random string for state parameter
function generateRandomString(length: number): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

// Generate code verifier for PKCE
function generateCodeVerifier(length: number): string {
  return generateRandomString(length);
}

// Generate code challenge from verifier
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Get stored tokens from localStorage
export function getStoredTokens(): SpotifyTokens | null {
  if (typeof window === "undefined") return null;
  
  const tokens = localStorage.getItem("spotify_tokens");
  if (!tokens) return null;
  
  try {
    const parsed = JSON.parse(tokens);
    const expiresAt = localStorage.getItem("spotify_token_expires_at");
    
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      // Token expired, try to refresh
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
}

// Store tokens in localStorage
export function storeTokens(tokens: SpotifyTokens): void {
  if (typeof window === "undefined") return;
  
  localStorage.setItem("spotify_tokens", JSON.stringify(tokens));
  localStorage.setItem("spotify_token_expires_at", 
    (Date.now() + tokens.expires_in * 1000).toString()
  );
}

// Clear stored tokens
export function clearTokens(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem("spotify_tokens");
  localStorage.removeItem("spotify_token_expires_at");
}

// Initiate Spotify OAuth flow with PKCE
export async function initiateSpotifyAuth(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_REDIRECT_URI) {
    console.error("Spotify client ID or redirect URI not configured");
    return;
  }
  
  const codeVerifier = generateCodeVerifier(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);
  
  // Store code verifier and current path for later use
  localStorage.setItem("spotify_code_verifier", codeVerifier);
  localStorage.setItem("spotify_auth_state", state);
  localStorage.setItem("spotify_auth_redirect", window.location.pathname);
  
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    state: state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  
  // Open popup window for Spotify auth
  const width = 500;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  
  const popup = window.open(
    `${SPOTIFY_AUTH_URL}?${params.toString()}`,
    "Spotify Auth",
    `width=${width},height=${height},left=${left},top=${top}`
  );
  
  // Listen for messages from the popup
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === "spotify-auth-success") {
      window.removeEventListener("message", handleMessage);
      // Reload the page to update the Spotify player state
      window.location.reload();
    } else if (event.data.type === "spotify-auth-error") {
      window.removeEventListener("message", handleMessage);
      console.error("Spotify auth error:", event.data.error);
    }
  };
  
  window.addEventListener("message", handleMessage);
  
  // Check if popup was closed without completing auth
  const checkPopupClosed = setInterval(() => {
    if (popup && popup.closed) {
      clearInterval(checkPopupClosed);
      window.removeEventListener("message", handleMessage);
    }
  }, 1000);
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, state: string): Promise<SpotifyTokens | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_REDIRECT_URI) {
    console.error("Spotify client ID or redirect URI not configured");
    return null;
  }
  
  const storedState = localStorage.getItem("spotify_auth_state");
  const codeVerifier = localStorage.getItem("spotify_code_verifier");
  
  if (state !== storedState) {
    console.error("State mismatch");
    return null;
  }
  
  if (!codeVerifier) {
    console.error("Code verifier not found");
    return null;
  }
  
  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to exchange code for tokens");
    }
    
    const tokens: SpotifyTokens = await response.json();
    storeTokens(tokens);
    
    // Clean up
    localStorage.removeItem("spotify_code_verifier");
    localStorage.removeItem("spotify_auth_state");
    
    return tokens;
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    return null;
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens | null> {
  if (!SPOTIFY_CLIENT_ID) {
    console.error("Spotify client ID not configured");
    return null;
  }
  
  try {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }
    
    const tokens: SpotifyTokens = await response.json();
    
    // Keep the refresh token if not provided in response
    if (!tokens.refresh_token) {
      tokens.refresh_token = refreshToken;
    }
    
    storeTokens(tokens);
    return tokens;
  } catch (error) {
    console.error("Error refreshing token:", error);
    clearTokens();
    return null;
  }
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  
  if (!tokens) {
    return null;
  }
  
  const expiresAt = localStorage.getItem("spotify_token_expires_at");
  if (expiresAt && Date.now() > parseInt(expiresAt) - 60000) {
    // Token expired or about to expire, refresh it
    const refreshedTokens = await refreshAccessToken(tokens.refresh_token);
    return refreshedTokens?.access_token ?? null;
  }
  
  return tokens.access_token;
}

// Make authenticated Spotify API request
export async function spotifyApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    return null;
  }
  
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (response.status === 204) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Spotify API request failed:", error);
    return null;
  }
}

// Get current playback state
export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  return spotifyApiRequest<SpotifyPlaybackState>("/me/player");
}

// Get currently playing track
export async function getCurrentlyPlaying(): Promise<SpotifyPlaybackState | null> {
  return spotifyApiRequest<SpotifyPlaybackState>("/me/player/currently-playing");
}

// Play/pause playback
export async function togglePlayback(isPlaying: boolean): Promise<boolean> {
  const endpoint = isPlaying ? "/me/player/pause" : "/me/player/play";
  const result = await spotifyApiRequest(endpoint, { method: "PUT" });
  return result !== null;
}

// Skip to next track
export async function skipToNext(): Promise<boolean> {
  const result = await spotifyApiRequest("/me/player/next", { method: "POST" });
  return result !== null;
}

// Skip to previous track
export async function skipToPrevious(): Promise<boolean> {
  const result = await spotifyApiRequest("/me/player/previous", { method: "POST" });
  return result !== null;
}

// Set volume
export async function setVolume(volumePercent: number): Promise<boolean> {
  const result = await spotifyApiRequest(
    `/me/player/volume?volume_percent=${volumePercent}`,
    { method: "PUT" }
  );
  return result !== null;
}

// Seek to position
export async function seekToPosition(positionMs: number): Promise<boolean> {
  const result = await spotifyApiRequest(
    `/me/player/seek?position_ms=${positionMs}`,
    { method: "PUT" }
  );
  return result !== null;
}

// Set repeat mode
export async function setRepeatMode(state: "off" | "track" | "context"): Promise<boolean> {
  const result = await spotifyApiRequest(
    `/me/player/repeat?state=${state}`,
    { method: "PUT" }
  );
  return result !== null;
}

// Set shuffle mode
export async function setShuffle(state: boolean): Promise<boolean> {
  const result = await spotifyApiRequest(
    `/me/player/shuffle?state=${state}`,
    { method: "PUT" }
  );
  return result !== null;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getStoredTokens() !== null;
}

// Disconnect Spotify
export function disconnectSpotify(): void {
  clearTokens();
}
