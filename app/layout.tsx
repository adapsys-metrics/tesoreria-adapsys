import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tesorería Adapsys",
  description: "Tesorería y control presupuestario — Adapsys",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
