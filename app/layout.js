import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

export const metadata = {
  title: "Rumo Visual Logistics",
  description: "Globo 3D interativo para localizar unidades operacionais da Rumo Logística."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        {children}
      </body>
    </html>
  );
}
