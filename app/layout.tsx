import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Vitrine — vídeos de produto com IA" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="wrap">
          <header className="top">
            <h1><Link href="/" style={{ textDecoration: "none" }}>Vitrine</Link></h1>
            <span>anúncios e explicativos prontos pro TikTok</span>
            <Link href="/settings" style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>⚙ Configurações</Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
