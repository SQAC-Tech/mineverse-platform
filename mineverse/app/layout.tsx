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

import { Press_Start_2P } from 'next/font/google';

const minecraftFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-minecraft",
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
      className={`${geistSans.variable} ${geistMono.variable} ${minecraftFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans relative" suppressHydrationWarning>
        <ClickParticles />
        <FloatingBlocks />
        <AchievementToast />
        <div className="relative z-10 flex-grow flex flex-col">
          {children}
        </div>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
