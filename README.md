# iTECify

Minimal monorepo starter for a 24h hackathon MVP:

- `apps/web`: Next.js App Router frontend with Tailwind CSS and Monaco
- `apps/server`: Express + Socket.IO realtime backend
- plain npm workspaces at the root, no turbo or extra orchestration

## Structure

```text
.
├── apps
│   ├── server
│   │   ├── src
│   │   │   ├── index.ts
│   │   │   └── rooms.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web
│       ├── app
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components
│       │   ├── editor-shell.tsx
│       │   └── monaco-workspace.tsx
│       ├── lib
│       │   └── env.ts
│       ├── package.json
│       └── tsconfig.json
├── package.json
└── tsconfig.base.json
```

## Run

```bash
npm install
npm run dev
```

Frontend: `http://localhost:3000`

Backend health check: `http://localhost:4000/health`

## Why this shape works

- It keeps the stack split by responsibility: UI in `apps/web`, realtime logic in `apps/server`.
- npm workspaces are enough for a hackathon and avoid turbo/monorepo overhead.
- Monaco and Socket.IO are wired early, so you can build collaboration and AI blocks on top of a working shell instead of refactoring later.
- The backend keeps room state in memory for speed now, while the boundaries are clear enough to swap in Redis, persistence, or sandbox execution later.
