import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AccountProvider } from "./components/account";
import { Workspace } from "./components/workspace";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mando — Your Mandarin journey",
  description: "A personal space to learn Mandarin, explore your vocabulary, and see your progress. A little better, every day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body><a className="skip-link" href="#main-content">Skip to content</a><AccountProvider><Workspace>{children}</Workspace></AccountProvider></body>
    </html>
  );
}
