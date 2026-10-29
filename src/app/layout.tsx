import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Rotta Concursos — Sua rota até a aprovação",
    template: "%s · Rotta Concursos",
  },
  description: "Banco de questões, simulados no padrão das bancas, flashcards com revisão espaçada, caderno de erros e plano de estudos inteligente.",
  applicationName: "Rotta Concursos",
  appleWebApp: { capable: true, title: "Rotta", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: light)", color: "#F6F6F3" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
