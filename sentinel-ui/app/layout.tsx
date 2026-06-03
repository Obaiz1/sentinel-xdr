import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", display: "swap" });
const shareTechMono = Share_Tech_Mono({ subsets: ["latin"], variable: "--font-mono", weight: "400", display: "swap" });

export const metadata: Metadata = {
  title: "SENTINEL XDR — Autonomous AI Threat Intelligence",
  description: "Autonomous AI-driven XDR platform with MACE, ARIA, ADRS, PHANTOM, AEGIS & CHRONICLE. Real-time network intrusion detection powered by AI.",
  keywords: ["XDR", "IDS", "intrusion detection", "cybersecurity", "AI", "MITRE ATT&CK", "network security", "SOC"],
};

// Explicit viewport so mobile devices scale correctly (allows pinch-zoom for a11y).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} ${shareTechMono.variable} h-full`} suppressHydrationWarning>
      <body
        className="min-h-full"
        style={{
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          background: "var(--bg-deep)",
          color: "var(--text-primary)",
        }}
      >
        {/* No-flash theme: apply saved preference before paint (default dark). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sxdr-theme');document.documentElement.setAttribute('data-theme', t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
