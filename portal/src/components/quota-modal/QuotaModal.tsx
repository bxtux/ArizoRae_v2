'use client';

import { useState } from 'react';
import Link from 'next/link';

export function QuotaModal({ exceeded, economicConnected }: { exceeded: boolean; economicConnected: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (!exceeded || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass w-full max-w-md p-8 space-y-5 border border-primary/40">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-primary">Quota tokens épuisé</h2>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted hover:text-text text-2xl leading-none mt-0.5"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-muted">
          Le mode standard n&apos;est plus disponible pour le moment. Vous pouvez continuer immédiatement avec le mode économique.
        </p>
        <div className="flex gap-3">
          <Link
            href="/onboarding?mode=economic"
            className="btn-primary flex-1 justify-center text-center"
            onClick={() => setDismissed(true)}
          >
            {economicConnected ? 'Continuer en mode économique' : 'Activer le mode économique'}
          </Link>
          <Link
            href="/settings#anthropic-key"
            className="btn-ghost text-sm px-4 inline-flex items-center justify-center"
            onClick={() => setDismissed(true)}
          >
            Options avancées
          </Link>
        </div>
      </div>
    </div>
  );
}
