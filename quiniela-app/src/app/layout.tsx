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

export const metadata = {
  title: 'Super Quiniela Mundial 2026',
  description: 'Participa en la quiniela más pro del Mundial 2026. Tabla en tiempo real, múltiples quinielas y premios en efectivo.',

  openGraph: {
    title: 'Super Quiniela Mundial 2026 ⚽🔥',
    description: 'Entra a la quiniela más pro del Mundial 2026.',
    url: 'https://www.superquiniela2026.com',
    siteName: 'Super Quiniela 2026',
    images: [
      {
        url: 'https://www.superquiniela2026.com/landing-bg.png',
        width: 1200,
        height: 630,
      },
    ],
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
