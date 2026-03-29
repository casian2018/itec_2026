"use client";

import { useEffect, useState } from "react";
import { exchangeCodeForTokens } from "@/lib/spotify";

export default function SpotifyCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      setTimeout(() => {
        setStatus("error");
        setErrorMessage(`Spotify authentication failed: ${error}`);
      }, 0);
      return;
    }

    if (!code || !state) {
      setTimeout(() => {
        setStatus("error");
        setErrorMessage("Missing authentication parameters");
      }, 0);
      return;
    }

    // Exchange code for tokens
    exchangeCodeForTokens(code, state)
      .then((tokens) => {
        if (tokens) {
          setTimeout(() => {
            setStatus("success");
          }, 0);
          
          // Notify parent window and close popup
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage({ type: "spotify-auth-success" }, window.location.origin);
              window.close();
            } else {
              // Fallback: redirect if not in popup
              const redirectPath = localStorage.getItem("spotify_auth_redirect");
              localStorage.removeItem("spotify_auth_redirect");
              if (redirectPath && redirectPath !== window.location.pathname) {
                window.location.href = redirectPath;
              } else {
                window.location.href = "/";
              }
            }
          }, 1000);
        } else {
          setTimeout(() => {
            setStatus("error");
            setErrorMessage("Failed to authenticate with Spotify");
          }, 0);
          
          // Notify parent window of error and close popup
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage({ type: "spotify-auth-error", error: "Failed to authenticate" }, window.location.origin);
              window.close();
            }
          }, 2000);
        }
      })
      .catch((err) => {
        setTimeout(() => {
          setStatus("error");
          setErrorMessage("Failed to authenticate with Spotify");
        }, 0);
        console.error("Spotify auth error:", err);
        
        // Notify parent window of error and close popup
        setTimeout(() => {
          if (window.opener) {
            window.opener.postMessage({ type: "spotify-auth-error", error: err.message }, window.location.origin);
            window.close();
          }
        }, 2000);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1118] flex items-center justify-center">
      <div className="bg-[#1a1b26] border border-[#3C3C3C] rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* Spotify Logo */}
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-[#1DB954]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>

          {status === "loading" && (
            <>
              <h2 className="text-xl font-semibold text-[#CCCCCC] mb-2">
                Connecting to Spotify
              </h2>
              <p className="text-[#626880] mb-4">
                Please wait while we complete the authentication...
              </p>
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <h2 className="text-xl font-semibold text-[#1DB954] mb-2">
                Successfully Connected!
              </h2>
              <p className="text-[#626880] mb-4">
                Your Spotify account has been linked. Redirecting you back...
              </p>
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <h2 className="text-xl font-semibold text-[#e05c6a] mb-2">
                Connection Failed
              </h2>
              <p className="text-[#626880] mb-4">
                {errorMessage || "An error occurred while connecting to Spotify."}
              </p>
              <button
                onClick={() => (window.location.href = "/")}
                className="px-4 py-2 bg-[#1DB954] text-white rounded hover:bg-[#1ed760] transition-colors"
              >
                Return to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
