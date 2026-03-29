# Spotify Integration

This document explains how to set up and use the Spotify integration in the iTECify workspace.

## Overview

The Spotify integration allows users to:
- See what song they're currently listening to
- Control playback (play/pause, skip, previous)
- Adjust volume
- Toggle shuffle and repeat modes
- View track progress

## Setup

### 1. Create a Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in the app details:
   - **App name**: iTECify (or your preferred name)
   - **App description**: Collaborative coding workspace with Spotify integration
   - **Redirect URI**: `http://127.0.0.1:3000/api/spotify/callback` (for local development)
     - Note: Spotify requires explicit loopback IP addresses. Use `127.0.0.1` instead of `localhost`.
   - **API/SDKs**: Select "Web API"
4. Click "Save"

### 2. Configure Environment Variables

Add the following environment variables to your `.env.local` file:

```env
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
# Note: Use 127.0.0.1 instead of localhost (Spotify requirement)
```

Replace `your_spotify_client_id_here` with the Client ID from your Spotify app dashboard.

### 3. Update Redirect URI for Production

For production deployment, update the redirect URI in your Spotify app settings to match your production domain:

```
https://your-domain.com/api/spotify/callback
```

And update the environment variable accordingly:

```env
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=https://your-domain.com/api/spotify/callback
```

## Usage

### Connecting to Spotify

1. Open the iTECify workspace
2. Look for the "Connect Spotify" button in the status bar (bottom of the screen)
3. Click the button to open the connection dialog
4. Click "Connect with Spotify"
5. You'll be redirected to Spotify to authorize the application
6. After authorization, you'll be redirected back to iTECify

### Using the Player

Once connected, the Spotify player will show in the status bar:

**Collapsed View:**
- Shows album art, track name, and artist
- Click to expand the full player

**Expanded View:**
- Album art with playback indicator
- Track name, artist, and album
- Progress bar (click to seek)
- Playback controls:
  - Shuffle toggle
  - Previous track
  - Play/Pause
  - Next track
  - Repeat mode toggle
- Volume slider
- Disconnect button

## Features

### Real-time Playback Status
- Polls Spotify API every 5 seconds to update playback state
- Shows current track, artist, and album
- Displays playback progress

### Playback Controls
- **Play/Pause**: Toggle playback
- **Skip Next**: Skip to the next track
- **Skip Previous**: Skip to the previous track
- **Shuffle**: Toggle shuffle mode
- **Repeat**: Cycle through repeat modes (off → context → track)

### Volume Control
- Adjust volume with a slider
- Volume changes are sent to Spotify immediately

### Progress Seeking
- Click anywhere on the progress bar to seek to that position

## Technical Details

### Authentication Flow
The integration uses Spotify's OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure authentication:

1. User clicks "Connect with Spotify"
2. App generates a code verifier and challenge
3. User is redirected to Spotify with the challenge
4. Spotify redirects back with an authorization code
5. App exchanges the code for access and refresh tokens
6. Tokens are stored in localStorage
7. Access token is refreshed automatically when expired

### API Integration
The integration uses the Spotify Web API:
- **Playback State**: `GET /me/player`
- **Toggle Playback**: `PUT /me/player/play` or `PUT /me/player/pause`
- **Skip Next**: `POST /me/player/next`
- **Skip Previous**: `POST /me/player/previous`
- **Set Volume**: `PUT /me/player/volume`
- **Seek**: `PUT /me/player/seek`
- **Set Repeat**: `PUT /me/player/repeat`
- **Set Shuffle**: `PUT /me/player/shuffle`

### Required Scopes
The integration requests the following Spotify scopes:
- `user-read-playback-state`: Read current playback state
- `user-modify-playback-state`: Control playback
- `user-read-currently-playing`: Read currently playing track
- `streaming`: Play tracks (for future Web Playback SDK integration)
- `user-read-email`: Read user email
- `user-read-private`: Read user profile

## Troubleshooting

### "Failed to authenticate with Spotify"
- Verify your Client ID is correct in `.env.local`
- Check that the redirect URI matches exactly in both your app and Spotify dashboard
- Ensure you're using HTTPS in production

### "No track playing"
- Make sure you have an active Spotify session
- Play a song on any Spotify device
- The player will automatically detect the active playback

### "Requires Spotify Premium"
- The Web Playback SDK requires Spotify Premium
- Basic playback controls work with free accounts
- Full playback control requires Premium

### Token Refresh Issues
- If you're frequently logged out, check that your refresh token is being stored correctly
- Clear localStorage and reconnect if issues persist

## Future Enhancements

Potential improvements for the Spotify integration:
- [ ] Web Playback SDK integration for in-browser playback
- [ ] Queue management
- [ ] Playlist browsing
- [ ] Search functionality
- [ ] Collaborative listening (show what others are listening to)
- [ ] Music recommendations based on coding activity

## Files

- `apps/web/lib/spotify.ts`: Spotify API utility functions
- `apps/web/components/spotify-player.tsx`: React component for the player UI
- `apps/web/app/api/spotify/callback/route.ts`: OAuth callback handler
- `apps/web/.env.local`: Environment variables (local development)
- `apps/web/.env.example`: Example environment variables

## Security Notes

- Access tokens are stored in localStorage (consider using httpOnly cookies for production)
- Refresh tokens are stored in localStorage
- Tokens are automatically refreshed when expired
- Disconnecting clears all stored tokens
