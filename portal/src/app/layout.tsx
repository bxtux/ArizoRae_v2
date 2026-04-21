import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ArizoRAE',
  description: "Assistant de Recherche Active d'Emploi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-bg text-text font-sans">{children}</body>
    </html>
  );
}
