import type { Metadata } from "next";
import { Poppins, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Poppins es la tipografía de marca de Adapsys (docs/Adapsys_Kit_Proyecto_Claude.md).
// Se auto-hospeda con next/font: sin request externo en runtime y sin flash de
// fuente de sistema.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--fuente-sans",
  display: "swap",
});

// Los números siguen en monoespaciada, y no es una desviación del kit sino lo que
// el kit no contempla: está escrito para presentaciones. En una tabla de 10.530
// movimientos los dígitos tienen que caer en columna para poder comparar
// −1.253.118 con −306.745 de un vistazo. Poppins es una geométrica de despliegue
// con cifras de ancho variable; usarla en los montos desalinea las columnas y
// convierte una tabla que se escanea en una que hay que leer número por número.

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tesorería Adapsys",
  description: "Tesorería y control presupuestario — Adapsys",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${poppins.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
