import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Press_Start_2P, VT323 } from 'next/font/google';

const minecraftFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-minecraft",
});

/*
 * Press Start 2P is a display face — it turns to mush under about 14px, so
 * anything with real prose in it (the rulebook) cannot be set in it without
 * either shrinking to nothing or filling the screen.
 *
 * VT323 carries that body copy. Pixelify Sans was tried first and is closer to
 * Minecraft in shape, but its `5` is very nearly an `S` at every size — "45
 * Stone + 25 Iron" rendered as "4S Stone + 2S Iron" — and the rulebook's whole
 * job is stating exact resource counts. VT323's digits are unambiguous.
 */
const minecraftBodyFont = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-minecraft-body",
});

export const metadata: Metadata = {
  // Child routes set their own title; everything else falls back to the default.
  title: {
    default: "MINEVERSE — Code. Craft. Conquer.",
    template: "%s · MINEVERSE",
  },
  description:
    "MINEVERSE is a two-day Minecraft-themed coding competition by SQAC. Register your team, mine resources, craft your way through five rounds, and take on the Ender Dragon.",
  applicationName: "MINEVERSE",
  openGraph: {
    title: "MINEVERSE — Code. Craft. Conquer.",
    description:
      "A two-day Minecraft-themed coding competition by SQAC. Register your team and battle through five rounds.",
    siteName: "MINEVERSE",
    type: "website",
  },
};

import { ClickParticles } from "@/components/ClickParticles";
import { FloatingBlocks } from "@/components/FloatingBlocks";
import { AchievementToast } from "@/components/AchievementToast";

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${minecraftFont.variable} ${minecraftBodyFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans relative" suppressHydrationWarning>
        <ClickParticles />
        <FloatingBlocks />
        <AchievementToast />
        <div className="relative z-10 flex-grow flex flex-col">
          {children}
        </div>
        <Toaster 
          position="top-right" 
          toastOptions={{ 
            className: 'minecraft-toast',
            classNames: {
              toast: 'minecraft-toast',
              title: 'minecraft-toast-title',
              description: 'minecraft-toast-description',
              success: 'minecraft-toast-success',
              error: 'minecraft-toast-error',
            }
          }} 
        />
      </body>
    </html>
  );
}
