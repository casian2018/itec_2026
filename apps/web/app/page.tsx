"use client";

import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";

const PLAYFAIR_FONT = "var(--font-playfair-display), serif";
const LANDING_PAGE_STYLE: CSSProperties &
  Record<"--primary" | "--accent" | "--surface-glass", string> = {
  cursor: "none",
  "--primary": "252 87% 72%",
  "--accent": "239 84% 67%",
  "--surface-glass": "232 29% 10%",
};

/* ═══════════════════════════════════════════════
   CUSTOM CURSOR
═══════════════════════════════════════════════ */

function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  const smoothX = useSpring(cursorX, { damping: 25, stiffness: 300 });
  const smoothY = useSpring(cursorY, { damping: 25, stiffness: 300 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };
    const down = () => setIsClicking(true);
    const up = () => setIsClicking(false);

    const checkHover = () => {
      const handleOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("button, a, [data-magnetic], [data-interactive]")) {
          setIsHovering(true);
        }
      };
      const handleOut = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("button, a, [data-magnetic], [data-interactive]")) {
          setIsHovering(false);
        }
      };
      window.addEventListener("mouseover", handleOver);
      window.addEventListener("mouseout", handleOut);
      return () => {
        window.removeEventListener("mouseover", handleOver);
        window.removeEventListener("mouseout", handleOut);
      };
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    const cleanHover = checkHover();

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      cleanHover();
    };
  }, [cursorX, cursorY]);

  return (
    <>
      {/* Outer ring */}
      <motion.div
        className="pointer-events-none fixed z-[9999] rounded-full border-2 mix-blend-difference"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: isHovering ? 60 : isClicking ? 24 : 36,
          height: isHovering ? 60 : isClicking ? 24 : 36,
          borderColor: isHovering ? "hsl(250, 90%, 70%)" : "rgba(255,255,255,0.6)",
          backgroundColor: isHovering ? "hsla(250, 90%, 70%, 0.1)" : "transparent",
        }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
      />
      {/* Inner dot */}
      <motion.div
        className="pointer-events-none fixed z-[9999] rounded-full bg-white mix-blend-difference"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: isHovering ? 8 : 5,
          height: isHovering ? 8 : 5,
          opacity: isClicking ? 0 : 1,
        }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════
   MAGNETIC BUTTON
═══════════════════════════════════════════════ */

function MagneticButton({
  children,
  className = "",
  strength = 0.3,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { damping: 15, stiffness: 150 });
  const springY = useSpring(y, { damping: 15, stiffness: 150 });

  const handleMouse = (e: ReactMouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      data-magnetic
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════
   3D TILT CARD
═══════════════════════════════════════════════ */

function TiltCard({
  children,
  className = "",
  glareColor = "rgba(255,255,255,0.1)",
}: {
  children: ReactNode;
  className?: string;
  glareColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const [isHovered, setIsHovered] = useState(false);

  const springRotateX = useSpring(rotateX, { damping: 20, stiffness: 200 });
  const springRotateY = useSpring(rotateY, { damping: 20, stiffness: 200 });
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, ${glareColor}, transparent 60%)`;

  const handleMouse = (e: ReactMouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    rotateX.set((y - 0.5) * -20);
    rotateY.set((x - 0.5) * 20);
    glareX.set(x * 100);
    glareY.set(y * 100);
  };

  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      data-interactive
      className={`relative ${className}`}
      style={{
        perspective: 1000,
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={(e) => {
        handleMouse(e);
        setIsHovered(true);
      }}
      onMouseLeave={handleLeave}
      whileHover={{ z: 30 }}
    >
      {children}
      {/* Glare overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-10"
        style={{
          background: glareBackground,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ opacity: { duration: 0.3 } }}
      />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════ */

const directions = {
  up: { hidden: { opacity: 0, y: 80 }, visible: { opacity: 1, y: 0 } },
  down: { hidden: { opacity: 0, y: -80 }, visible: { opacity: 1, y: 0 } },
  left: { hidden: { opacity: 0, x: -80 }, visible: { opacity: 1, x: 0 } },
  right: { hidden: { opacity: 0, x: 80 }, visible: { opacity: 1, x: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } },
};

function ScrollReveal({
  children,
  className = "",
  direction = "up",
  delay = 0,
  duration = 0.8,
}: {
  children: ReactNode;
  className?: string;
  direction?: keyof typeof directions;
  delay?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={directions[direction]}
      transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   TYPING EFFECT
═══════════════════════════════════════════════ */

const editorLines = [
  { text: 'import { WorkspaceShell } from "@/components/workspace-shell"', delay: 0 },
  { text: 'import { lookupSession } from "@/lib/session"', delay: 0.45 },
  { text: "", delay: 0.9 },
  { text: '// Browser IDE session preview', delay: 1.3 },
  { text: 'const room = await lookupSession("AB12CD")', delay: 1.8 },
  { text: 'const currentUserName = "Alex"', delay: 2.35 },
  { text: "", delay: 2.85 },
  { text: "return (", delay: 3.3 },
  { text: '  <WorkspaceShell roomId={room.roomId}', delay: 3.8 },
  { text: '    currentUserName={currentUserName}', delay: 4.3 },
  { text: "  />", delay: 4.8 },
  { text: ")", delay: 5.15 },
];

function TypingLine({ text, delay: startDelay }: { text: string; delay: number }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), startDelay * 1000);
    return () => clearTimeout(timeout);
  }, [startDelay]);

  useEffect(() => {
    if (!started || !text) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 35);
    return () => clearInterval(interval);
  }, [started, text]);

  if (!started && text) return <div className="h-6">&nbsp;</div>;
  if (!text) return <div className="h-6">&nbsp;</div>;

  // Syntax highlighting
  const colorize = (s: string) => {
    if (s.startsWith("//")) return <span className="text-muted-foreground italic">{s}</span>;
    return s.split(/(".*?")/g).map((part, i) =>
      part.startsWith('"') ? (
        <span key={i} className="text-accent">{part}</span>
      ) : (
        <span key={i}>
          {part.split(/\b(import|from|const|return|true)\b/g).map((word, j) =>
            ["import", "from", "const", "return", "true"].includes(word) ? (
              <span key={j} className="text-primary font-medium">{word}</span>
            ) : (
              <span key={j}>{word}</span>
            )
          )}
        </span>
      )
    );
  };

  return <div className="h-6 font-mono text-sm text-foreground/90">{colorize(displayed)}</div>;
}

function createSeededRandom(seed: number) {
  let current = seed >>> 0;

  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 4294967296;
  };
}

/* ═══════════════════════════════════════════════
   3D BACKGROUND PARTICLES
═══════════════════════════════════════════════ */

function BGParticles({ count = 200 }: { count?: number }) {
  const mesh = useRef<THREE.Points | null>(null);
  const positions = useMemo(() => {
    const random = createSeededRandom(count * 97 + 13);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (random() - 0.5) * 25;
      pos[i * 3 + 1] = (random() - 0.5) * 25;
      pos[i * 3 + 2] = (random() - 0.5) * 25;
    }
    return pos;
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.x = state.clock.elapsedTime * 0.015;
    mesh.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#8b7cf6" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function FloatingGeo() {
  const ref1 = useRef<THREE.Mesh | null>(null);
  const ref2 = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref1.current) {
      ref1.current.rotation.x = t * 0.2;
      ref1.current.rotation.y = t * 0.15;
      ref1.current.position.y = Math.sin(t * 0.4) * 0.8;
    }
    if (ref2.current) {
      ref2.current.rotation.z = t * 0.25;
      ref2.current.rotation.x = t * 0.1;
      ref2.current.position.y = Math.cos(t * 0.3) * 0.6 + 1;
    }
  });

  return (
    <>
      <mesh ref={ref1} position={[3.5, 0, -3]}>
        <torusGeometry args={[1, 0.15, 16, 48]} />
        <meshStandardMaterial color="#7c6cf6" wireframe transparent opacity={0.15} />
      </mesh>
      <mesh ref={ref2} position={[-3, 1.5, -4]}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#a78bfa" wireframe transparent opacity={0.12} />
      </mesh>
    </>
  );
}

function HeroBG() {
  return (
    <div className="absolute inset-0 z-0" style={{ pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 7], fov: 55 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.15} />
        <pointLight position={[5, 5, 5]} intensity={0.4} color="#8b7cf6" />
        <pointLight position={[-5, -3, 3]} intensity={0.3} color="#6366f1" />
        <BGParticles />
        <FloatingGeo />
      </Canvas>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   FLOATING 3D SCENE (features bg)
═══════════════════════════════════════════════ */

function FloatingSphere() {
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.rotation.x = s.clock.elapsedTime * 0.15;
    ref.current.rotation.y = s.clock.elapsedTime * 0.2;
  });
  return (
    <Float speed={1.5} rotationIntensity={0.8} floatIntensity={1.5}>
      <mesh ref={ref} scale={2}>
        <icosahedronGeometry args={[1, 3]} />
        <MeshDistortMaterial color="#7c6cf6" wireframe transparent opacity={0.1} distort={0.25} speed={1.5} />
      </mesh>
    </Float>
  );
}

function FeaturesBG({ className = "" }: { className?: string }) {
  return (
    <div className={className} style={{ pointerEvents: "none" }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.1} />
        <pointLight position={[3, 3, 3]} intensity={0.6} color="#7c6cf6" />
        <FloatingSphere />
      </Canvas>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ANIMATED GRID BG
═══════════════════════════════════════════════ */

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.03]" style={{ pointerEvents: "none" }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,124,246,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,124,246,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   AI SUGGESTION CARD
═══════════════════════════════════════════════ */

function AISuggestionCard() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 6, duration: 0.6 }}
      className="mt-4 mx-2"
    >
      <div className="rounded-xl border border-accent/30 bg-accent/5 backdrop-blur-sm p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-medium text-accent tracking-wide">AI SUGGESTION</span>
        </div>
        <div className="font-mono text-xs text-foreground/70 mb-3 pl-2 border-l-2 border-accent/30">
          <div>workspace.deploy({"{"}</div>
          <div className="pl-3">region: &quot;us-east-1&quot;,</div>
          <div className="pl-3">scaling: &quot;auto&quot;</div>
          <div>{"}"})</div>
        </div>
        {accepted === null ? (
          <div className="flex gap-2">
            <button
              onClick={() => setAccepted(true)}
              className="flex-1 rounded-lg bg-accent/20 py-1.5 text-xs font-medium text-accent hover:bg-accent/30 transition-colors"
            >
              ✓ Accept
            </button>
            <button
              onClick={() => setAccepted(false)}
              className="flex-1 rounded-lg bg-destructive/10 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              ✗ Reject
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-center py-1.5 rounded-lg text-xs font-medium ${
              accepted ? "bg-accent/20 text-accent" : "bg-destructive/10 text-destructive"
            }`}
          >
            {accepted ? "✓ Accepted & Applied" : "✗ Rejected"}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   FEATURES DATA
═══════════════════════════════════════════════ */

const features = [
  {
    icon: "👥",
    title: "Real-time Collaboration",
    description: "See cursors, selections, and changes instantly. Like Google Docs, but for code.",
    handwritten: "works like magic ✨",
  },
  {
    icon: "🤖",
    title: "AI-Assisted Coding",
    description: "Context-aware suggestions that understand your entire codebase, not just the current file.",
    handwritten: "your AI pair programmer",
  },
  {
    icon: "⚡",
    title: "Instant Sandbox",
    description: "Run, test, and iterate in milliseconds. No local setup, no waiting for builds.",
    handwritten: "zero config needed",
  },
];

const workspacePreviewParticipants = [
  { socketId: "self", name: "Alex", badge: "You", active: true },
  { socketId: "sarah", name: "Sarah", badge: "Live", active: false },
  { socketId: "marcus", name: "Marcus", badge: "Live", active: false },
];

const workspacePreviewTabs = [
  {
    id: "workspace-shell",
    name: "workspace-shell.tsx",
    path: "apps/web/components/workspace-shell.tsx",
    icon: "TSX",
    extension: ".tsx",
    editable: true,
  },
  {
    id: "participants-bar",
    name: "participants-bar.tsx",
    path: "apps/web/components/participants-bar.tsx",
    icon: "TSX",
    extension: ".tsx",
  },
  {
    id: "ai-suggestions",
    name: "ai-suggestions-panel.tsx",
    path: "apps/web/components/ai-suggestions-panel.tsx",
    icon: "TSX",
    extension: ".tsx",
  },
];

const workspacePreviewTree = [
  { kind: "folder", label: "apps", depth: 0, active: false },
  { kind: "folder", label: "web", depth: 1, active: false },
  { kind: "folder", label: "components", depth: 2, active: false },
  { kind: "file", label: "workspace-shell.tsx", depth: 3, active: true },
  { kind: "file", label: "participants-bar.tsx", depth: 3, active: false },
  { kind: "file", label: "ai-suggestions-panel.tsx", depth: 3, active: false },
  { kind: "folder", label: "lib", depth: 2, active: false },
  { kind: "file", label: "socket.ts", depth: 3, active: false },
  { kind: "file", label: "session.ts", depth: 3, active: false },
];

const workspacePreviewTerminal = [
  "$ room:join AB12CD --name Alex",
  "connected: 3 participants synced",
  "$ npm run dev:web",
  "ready - preview listening on http://localhost:3000",
];

function WorkspacePreviewPanel() {
  return (
    <TiltCard className="overflow-hidden rounded-[28px]" glareColor="rgba(0,122,204,0.16)">
      <div
        className="ide-theme-root overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--bg-elevated)] shadow-[0_40px_140px_-50px_rgba(0,0,0,0.8)]"
        data-ide-theme="dark"
      >
        <div className="flex h-[760px] min-h-0 flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--titlebar-bg)] px-3 py-2">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--accent)]">
                  iTECify
                </span>
                <span className="inline-flex h-6 items-center border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  Session AB12CD
                </span>
                <span className="inline-flex h-6 items-center border border-emerald-400/16 bg-emerald-400/10 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300">
                  Connected
                </span>
                <span className="inline-flex h-6 items-center border border-cyan-400/14 bg-cyan-400/10 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                  Run Ready
                </span>
                <span className="inline-flex h-6 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  Alex
                </span>
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-[var(--text-primary)]">
                  EXPLORER / Collaborative Session
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  The same coding surface as `/dev/[sessionCode]`: explorer, editor, inspector,
                  terminal, and live collaborators in one workbench.
                </p>
              </div>
            </div>

            <div className="space-y-1 border border-[var(--line)] bg-[var(--bg-panel)] p-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-8 items-center gap-2 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 text-xs text-[var(--text-secondary)]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Theme
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">Dark</span>
                </span>
                <span className="inline-flex h-8 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-xs font-medium text-[var(--text-secondary)]">
                  Share
                </span>
                <span className="inline-flex h-8 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-xs font-medium text-[var(--text-secondary)]">
                  Invite
                </span>
              </div>
            </div>
          </header>

          <section className="border-b border-[var(--line)] bg-[var(--titlebar-bg)] px-3 py-2">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  Session
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Connected collaborators in the current workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {workspacePreviewParticipants.map((participant) => (
                  <div
                    key={participant.socketId}
                    className={`inline-flex h-8 items-center gap-2 border px-2.5 ${
                      participant.active
                        ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                        : "border-[rgba(148,163,184,0.12)] bg-[var(--bg-panel-soft)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center border font-mono text-[10px] ${
                        participant.active
                          ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--line)] bg-[var(--surface-chip)] text-[var(--text-muted)]"
                      }`}
                    >
                      {participant.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <span className="text-xs font-medium">{participant.name}</span>
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                        participant.active
                          ? "border-[var(--line)] bg-[var(--surface-chip)] text-[var(--accent)]"
                          : "border-[var(--line)] bg-[var(--surface-chip)] text-[var(--text-muted)]"
                      }`}
                    >
                      {participant.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-[48px_minmax(220px,18vw)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_190px] overflow-hidden">
            <aside className="row-span-2 flex min-h-0 flex-col items-center gap-1 border-r border-[var(--line)] bg-[var(--activitybar-bg)] px-1 py-2">
              {[
                { label: "EX", active: true },
                { label: "PR", active: false },
                { label: "AI", active: true },
                { label: "TM", active: false },
                { label: "OP", active: false },
                { label: "TL", active: false },
              ].map((button) => (
                <span
                  key={button.label}
                  className={`flex h-11 w-11 items-center justify-center border-l-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    button.active
                      ? "border-l-[var(--accent)] bg-[var(--editor-tab-hover-bg)] text-[var(--text-primary)]"
                      : "border-l-transparent text-[var(--text-muted)]"
                  }`}
                >
                  {button.label}
                </span>
              ))}
            </aside>

            <aside className="min-h-0 overflow-hidden border-r border-[var(--line)] bg-[var(--sidebar-bg)]">
              <div className="border-b border-[var(--line)] px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Explorer
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Session-isolated file tree with live tabs and active file sync.
                </p>
              </div>

              <div className="space-y-1 px-2 py-3">
                {workspacePreviewTree.map((node) => (
                  <div
                    key={`${node.depth}-${node.label}`}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
                      node.active
                        ? "bg-[var(--editor-tab-hover-bg)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                    style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
                  >
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      {node.kind === "folder" ? "DIR" : "FILE"}
                    </span>
                    <span className="truncate">{node.label}</span>
                    {node.active ? (
                      <span className="ml-auto border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--accent)]">
                        Open
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </aside>

            <div className="grid min-h-0 overflow-hidden grid-cols-[minmax(0,1fr)_minmax(280px,30vw)]">
              <section className="flex min-h-0 flex-col border border-[var(--line)] bg-[var(--editor-shell)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--editor-tab-bg)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      Editor
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                      apps/web/components/workspace-shell.tsx · AB12CD
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="border border-cyan-400/10 bg-cyan-400/10 px-2 py-1 font-mono text-cyan-300">
                      Shared file
                    </span>
                    <span className="border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 font-mono text-[var(--text-muted)]">
                      TypeScript
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2 text-xs">
                  <span className="inline-flex h-8 items-center gap-2 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2.5 text-[var(--text-secondary)]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Lang
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">TypeScript</span>
                  </span>
                  {["Next Line", "AI Assist", "Optimize File", "Run"].map((action) => (
                    <span
                      key={action}
                      className="inline-flex h-8 items-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-3 text-xs font-medium text-[var(--text-secondary)]"
                    >
                      {action}
                    </span>
                  ))}
                </div>

                <div className="flex items-stretch overflow-x-auto border-b border-[var(--line)] bg-[var(--editor-tab-bg)]">
                  {workspacePreviewTabs.map((tab, index) => {
                    const active = index === 0;

                    return (
                      <div
                        key={tab.id}
                        className={`group flex min-w-[170px] max-w-[240px] items-stretch border-r border-[var(--line)] ${
                          active
                            ? "bg-[var(--editor-tab-active-bg)]"
                            : "bg-[var(--editor-tab-bg)]"
                        }`}
                      >
                        <div className="flex-1 px-3 py-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-4 min-w-5 items-center justify-center border border-[var(--line)] bg-[var(--bg-panel-soft)] px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                              {tab.icon}
                            </span>
                            <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                              {tab.name}
                            </span>
                            {tab.extension ? (
                              <span className="hidden font-mono text-[10px] text-[var(--text-muted)] md:inline">
                                {tab.extension}
                              </span>
                            ) : null}
                            {tab.editable ? (
                              <span className="border border-[var(--accent-line)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--accent)]">
                                Live
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate font-mono text-[10px] text-[var(--text-muted)]">
                            {tab.path}
                          </p>
                        </div>
                        <span className="mr-1 flex h-full items-center px-1.5 text-[11px] text-[var(--text-muted)]">
                          ×
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--editor-inline)]">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,122,204,0.06))]" />
                  <div className="grid h-full min-h-0 grid-cols-[56px_minmax(0,1fr)]">
                    <div className="border-r border-[var(--line)] bg-[var(--editor-shell)]/70 px-3 py-4 font-mono text-[11px] text-[var(--text-muted)]">
                      {editorLines.map((_, index) => (
                        <div key={index} className="h-6 text-right leading-6">
                          {index + 1}
                        </div>
                      ))}
                    </div>

                    <div className="relative p-4">
                      <div className="space-y-0">
                        {editorLines.map((line, index) => (
                          <TypingLine key={index} text={line.text} delay={line.delay} />
                        ))}
                      </div>

                      <motion.div
                        className="absolute left-[38%] top-[34%]"
                        animate={{ x: [0, 24, -12, 0], y: [0, 12, -10, 0] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <div className="rounded-md bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white">
                          Sarah
                        </div>
                      </motion.div>

                      <motion.div
                        className="absolute left-[64%] top-[58%]"
                        animate={{ x: [0, -18, 20, 0], y: [0, -10, 14, 0] }}
                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <div className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white">
                          Marcus
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--bg-panel)] px-3 py-2">
                  <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)] font-mono">
                    <span>TypeScript</span>
                    <span>UTF-8</span>
                    <span>Ln 9, Col 5</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-medium text-[var(--accent)]">Synced</span>
                  </div>
                </div>
              </section>

              <aside className="flex h-full min-h-0 flex-col border-l border-[var(--line)] bg-[var(--sidebar-bg)]">
                <div className="border-b border-[var(--line)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 px-3 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Inspector
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        Preview and AI tools stay docked to the right, like the real `/dev`
                        workbench.
                      </p>
                    </div>
                    <span className="m-3 border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      Right Panel
                    </span>
                  </div>

                  <div className="flex">
                    {["Preview", "AI Suggestions"].map((tab, index) => (
                      <span
                        key={tab}
                        className={`border-b-2 px-3 py-2 text-xs font-medium ${
                          index === 1
                            ? "border-b-[var(--accent)] bg-[var(--editor-tab-active-bg)] text-[var(--text-primary)]"
                            : "border-b-transparent bg-[var(--editor-tab-bg)] text-[var(--text-muted)]"
                        }`}
                      >
                        {tab}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden p-3">
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-panel)] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      AI Suggestions
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Reviewable patches stay docked here before they touch the shared file.
                    </p>
                    <AISuggestionCard />
                  </div>
                </div>
              </aside>
            </div>

            <div className="min-h-0 overflow-hidden border-t border-[var(--line)] lg:col-[2/4]">
              <section className="flex h-full min-h-0 flex-col bg-[var(--panel-bg)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Integrated Panel
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Shared terminal activity, run output, and time-travel tools live together
                      below the editor.
                    </p>
                  </div>
                  <span className="border border-[var(--line)] bg-[var(--bg-panel-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Bottom Panel
                  </span>
                </div>

                <div className="flex border-b border-[var(--line)]">
                  {["Terminal", "Output", "Timeline"].map((tab, index) => (
                    <span
                      key={tab}
                      className={`border-b-2 px-3 py-2 text-xs font-medium ${
                        index === 0
                          ? "border-b-[var(--accent)] bg-[var(--editor-tab-active-bg)] text-[var(--text-primary)]"
                          : "border-b-transparent bg-[var(--editor-tab-bg)] text-[var(--text-muted)]"
                      }`}
                    >
                      {tab}
                    </span>
                  ))}
                </div>

                <div className="min-h-0 flex-1 bg-[var(--terminal-bg)] px-4 py-3 font-mono text-[11px] text-[var(--terminal-text)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="uppercase tracking-[0.18em] text-[var(--terminal-muted)]">
                      Shared Terminal
                    </span>
                    <span className="text-[10px] text-[var(--terminal-muted)]">Session AB12CD</span>
                  </div>

                  <div className="space-y-2">
                    {workspacePreviewTerminal.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

/* ═══════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════ */

export default function Index() {
  const router = useRouter();
  const containerRef = useRef<HTMLElement | null>(null);
  const handleStartCoding = useCallback(() => {
    router.push("/auth");
  }, [router]);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 80, damping: 30 });

  // Hero parallax
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    container: containerRef,
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(heroProgress, [0, 1], [0, -200]);
  const heroOpacity = useTransform(heroProgress, [0, 0.6], [1, 0]);

  // Features parallax
  const featRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: featProgress } = useScroll({
    container: containerRef,
    target: featRef,
    offset: ["start end", "end start"],
  });
  const featBgY = useTransform(featProgress, [0, 1], [120, -120]);

  // Editor parallax
  const editorRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress: editorProgress } = useScroll({
    container: containerRef,
    target: editorRef,
    offset: ["start end", "end start"],
  });
  const editorScale = useTransform(editorProgress, [0, 0.4], [0.85, 1]);
  const editorOpacity = useTransform(editorProgress, [0, 0.3], [0, 1]);

  return (
    <main
      ref={containerRef}
      className="relative h-full overflow-y-auto overflow-x-hidden bg-background"
      style={LANDING_PAGE_STYLE}
    >
      <CustomCursor />
      <AnimatedGrid />

      {/* ── Progress bar ── */}
      <motion.div
        className="fixed left-0 right-0 top-0 z-[100] h-[2px] origin-left"
        style={{
          scaleX,
          background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
        }}
      />

      {/* ── Header ── */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="mx-auto flex items-center justify-between px-8 py-5 max-w-7xl">
          <motion.div
            className="text-xl font-bold tracking-tight font-serif"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <span className="text-foreground">iTEC</span>
            <span className="text-primary">ify</span>
          </motion.div>

          <MagneticButton
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:shadow-[0_0_30px_rgba(139,124,246,0.4)]"
            strength={0.4}
            onClick={handleStartCoding}
          >
            Start Coding
          </MagneticButton>
        </div>
      </motion.header>

      {/* ══════════════════════════════════════
         HERO SECTION
      ══════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <HeroBG />

        {/* Gradient orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full blur-[180px] opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent)", top: "10%", left: "20%" }}
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-15"
          style={{ background: "radial-gradient(circle, hsl(var(--accent)), transparent)", bottom: "10%", right: "15%" }}
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="relative z-10 text-center max-w-4xl px-6"
          style={{ y: heroY, opacity: heroOpacity }}
        >
            <motion.h1
              className="text-6xl md:text-8xl lg:text-9xl font-bold leading-[0.95] tracking-tight mb-8"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ fontFamily: PLAYFAIR_FONT }}
            >
            Code together.
            <br />
            <span className="text-gradient">Instantly.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            Collaborate with your team and AI in a shared real-time coding environment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <MagneticButton
              className="group relative rounded-full bg-foreground px-10 py-4 text-base font-semibold text-background transition-all hover:shadow-[0_0_60px_rgba(139,124,246,0.5)]"
              strength={0.5}
              onClick={handleStartCoding}
            >
              <span className="relative z-10">Start Coding</span>
              <motion.div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                }}
              />
            </MagneticButton>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute -bottom-24 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
              <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
              <div className="h-10 w-6 rounded-full border border-muted-foreground/20 p-1">
                <motion.div
                  className="h-2 w-2 rounded-full bg-primary/60"
                  animate={{ y: [0, 16, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════
         EDITOR PREVIEW SECTION
      ══════════════════════════════════════ */}
      <section ref={editorRef} className="relative py-32 px-6">
        <motion.div
          className="max-w-5xl mx-auto"
          style={{ scale: editorScale, opacity: editorOpacity }}
        >
          <ScrollReveal className="mb-16 text-center">
            <h2
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ fontFamily: PLAYFAIR_FONT }}
            >
              See it in <span className="text-gradient italic">action</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Multiple cursors. AI suggestions. One shared canvas.
            </p>
          </ScrollReveal>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[1080px]">
              <WorkspacePreviewPanel />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════
         FEATURES SECTION (Bento Grid)
      ══════════════════════════════════════ */}
      <section ref={featRef} className="relative py-32 px-6 overflow-hidden">
        <FeaturesBG className="absolute inset-0 opacity-20" />

        <motion.div className="absolute inset-0 -z-10" style={{ y: featBgY }}>
          <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[200px]" />
          <div className="absolute right-1/3 bottom-0 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[200px]" />
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <ScrollReveal className="mb-20 text-center">
            <h2
              className="text-4xl md:text-6xl font-bold mb-4"
              style={{ fontFamily: PLAYFAIR_FONT }}
            >
              Built for the <span className="text-gradient italic">future</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Three pillars of a next-generation development experience.
            </p>
          </ScrollReveal>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <ScrollReveal key={i} direction="up" delay={i * 0.15}>
                <TiltCard
                  className="h-full rounded-[24px]"
                  glareColor="rgba(139,124,246,0.15)"
                >
                  <div
                    className="group relative h-full rounded-[24px] border border-border/30 p-8 transition-all duration-500 hover:border-primary/30"
                    style={{
                      background: "hsl(var(--surface-glass) / 0.4)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    <motion.div
                      className="mb-6 text-5xl"
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      {feature.icon}
                    </motion.div>
                    <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>

                    {/* Handwritten overlay on hover */}
                    <motion.div
                      className="absolute bottom-6 right-6 text-primary/60 text-sm italic pointer-events-none"
                      initial={{ opacity: 0, rotate: -5, y: 10 }}
                      whileInView={{ opacity: 0 }}
                      style={{ fontFamily: PLAYFAIR_FONT }}
                    >
                      {feature.handwritten}
                    </motion.div>
                    <motion.div
                      className="absolute bottom-6 right-6 text-primary/70 text-sm italic pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ fontFamily: PLAYFAIR_FONT, transform: "rotate(-3deg)" }}
                    >
                      {feature.handwritten}
                    </motion.div>

                    {/* Glow on hover */}
                    <div className="absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10 blur-2xl bg-primary/10" />
                  </div>
                </TiltCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
         FOOTER
      ══════════════════════════════════════ */}
      <footer className="relative border-t border-border/20 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <ScrollReveal direction="right">
            <span className="text-lg font-bold" style={{ fontFamily: PLAYFAIR_FONT }}>
              <span className="text-foreground">iTEC</span>
              <span className="text-primary">ify</span>
            </span>
          </ScrollReveal>
          <ScrollReveal direction="up">
            <div className="flex items-center gap-8">
              {["Privacy", "Terms", "Twitter", "GitHub"].map((link, i) => (
                <motion.a
                  key={i}
                  href="#"
                  className="text-xs font-medium tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors uppercase"
                  whileHover={{ y: -2 }}
                >
                  {link}
                </motion.a>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal direction="left">
            <p className="text-xs text-muted-foreground/40">© 2024 iTECify. All rights reserved.</p>
          </ScrollReveal>
        </div>
      </footer>
    </main>
  );
}
