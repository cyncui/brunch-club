import type { Metadata, Viewport } from "next";
import { Funnel_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  variable: "--font-funnel-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Book Club Archive",
  description:
    "An infinite-canvas archive of books read — sourced from Are.na. A stamp collection you can wander.",
  openGraph: {
    title: "Book Club Archive",
    description: "An infinite canvas of books read.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2ede1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
  drawer,
}: Readonly<{
  children: React.ReactNode;
  drawer: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${funnelSans.variable} ${spaceMono.variable}`}>
      <body>
        {children}
        {drawer}
      </body>
    </html>
  );
}
