import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Armador de equipos · Picado",
  description:
    "Cargá el plantel, armá equipos parejos por nivel y posición, y mandá la alineación al grupo en segundos.",
};

export const viewport: Viewport = {
  themeColor: "#0a120d",
  width: "device-width",
  initialScale: 1,
  // La cancha necesita zoom para ver nombres en pantallas chicas.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="grass-backdrop flex min-h-full flex-col">{children}</body>
    </html>
  );
}
