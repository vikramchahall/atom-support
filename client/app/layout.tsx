import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtomSupport — Support Platform",
  description: "Real-time remote support with video, chat, and AI assistance",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}