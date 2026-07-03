import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Morello Marker — display / headers.
const morello = localFont({
  src: "./fonts/morellomarker-Regular.ttf",
  variable: "--font-morello",
  display: "swap",
});

// Open Runde — body / everything else.
const openRunde = localFont({
  src: "./fonts/OpenRunde-Regular.otf",
  variable: "--font-runde",
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
    <html lang="en" className={`${morello.variable} ${openRunde.variable}`}>
      <body>
        {children}
        {drawer}
      </body>
    </html>
  );
}
