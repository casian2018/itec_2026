import type { Metadata } from "next";
import { IBM_Plex_Mono, Playfair_Display, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "iTECify | Collaborative Browser IDE",
  description:
    "AI-native collaborative browser IDE with session-isolated files, live preview, terminal output, and execution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-[var(--bg)] text-[var(--text-primary)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
