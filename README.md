# iTECify

iTECify is a browser-native collaborative IDE built for the iTEC 2026 brief.

It currently includes:

- session-scoped collaborative workspaces at `/dev/[sessionCode]`
- VS Code-inspired IDE layout
- shared file tree, tabs, active file, and multi-cursor editor
- AI suggestion blocks with accept/reject flow
- shared integrated PTY terminal per session
- Docker-backed code execution for JavaScript, Python, C, and C++
- live preview for HTML/CSS/JS workspaces
- ZIP project import
- snapshots and lightweight presentation/replay mode
- room-isolated state for participants, files, terminal, preview, and execution
- a Docker-backed shared terminal toolchain with Node.js, npm, pnpm, yarn, Python, pip, gcc, g++, git, curl, ripgrep, jq, zip/unzip, and common CLI utilities

## Stack

- frontend: Next.js App Router + TypeScript + Tailwind + Monaco + xterm.js
- backend: Express + Socket.IO + TypeScript
- sandboxing: Docker CLI from the backend
- AI: Gemini suggestion generation

## Routes

- `/` landing page
- `/auth` lightweight demo auth
- `/dev` session lobby
- `/dev/[sessionCode]` collaborative IDE session

## Local Run

Prerequisites:

- Node.js 20+
- npm 10+
- Docker Desktop or Docker Engine running locally

Optional:

- `GEMINI_API_KEY` for AI suggestions
- `GEMINI_MODEL` if you want a model other than `gemini-2.5-flash`

Install:

```bash
npm install
```

Start both apps:

```bash
npm run dev
```

Open:

- web: [http://localhost:3000](http://localhost:3000)
- server health: [http://localhost:4000/health](http://localhost:4000/health)

Useful local commands:

```bash
npm run dev:web
npm run dev:server
npm run typecheck
npm run lint
npm run build
```

## Docker Run

This repo includes Dockerfiles for the web app and the server plus a root `docker-compose.yml`.

Important:

- the backend itself launches Docker containers for code execution
- because of that, the server container mounts the host Docker socket
- the compose setup also needs the absolute host project path so execution temp directories can be mounted correctly into runtime containers
- the shared integrated terminal runs inside the server container, so when you use Docker you also get a preprovisioned Linux dev environment for session terminals

Create a root `.env` from `.env.example` and set the absolute repo path:

```bash
cp .env.example .env
```

Set:

```bash
HOST_PROJECT_ROOT=/absolute/path/to/itec_2026
CLIENT_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

Then run:

```bash
npm run docker:up
```

Or directly:

```bash
docker compose up --build
```

Stop:

```bash
npm run docker:down
```

## Session Flow

1. Open `/`
2. Go through `/auth`
3. Create a new session or join an existing session code
4. You land in `/dev/[sessionCode]`
5. Everyone in the same session shares:
   - workspace tree
   - open tabs and active file
   - AI suggestion blocks
   - shared terminal
   - preview state
   - snapshots

## Execution Support

Supported runnable file types:

- `.js` -> Node in `node:20-alpine`
- `.py` -> Python in `python:3.11-alpine`
- `.c` -> GCC compile + run in `gcc:13-bookworm`
- `.cpp`, `.cc`, `.cxx` -> G++ compile + run in `gcc:13-bookworm`
- `.html` -> opens live preview instead of backend execution

Safety defaults already enabled:

- `--rm`
- `--network none`
- memory limit
- CPU limit
- PID limit
- timeout handling
- temp directory cleanup

## Notes

- workspace and session state are intentionally in-memory for hackathon speed
- the shared integrated terminal is a real session-scoped PTY and is practical for local/demo use, not hostile multi-tenant production
- AI suggestions require a valid Gemini API key on the server

## Verification

Run the full checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test --workspace @itecify/server
```
