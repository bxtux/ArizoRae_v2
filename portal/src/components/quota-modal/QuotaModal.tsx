'use client';

import { useState } from 'react';
import Link from 'next/link';

export function QuotaModal({ exceeded }: { exceeded: boolean }) {
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
          Vous avez utilisé la totalité du quota gratuit ArizoRAE. Pour continuer à utiliser
          l&apos;assistant, ajoutez votre propre clé API Anthropic.
        </p>
        <p className="text-xs text-muted">
          Obtenez une clé sur{' '}
          <span className="text-primary font-mono">console.anthropic.com</span> — les appels seront
          facturés sur votre compte Anthropic directement.
        </p>
        <div className="flex gap-3">
          <Link
            href="/settings#anthropic-key"
            className="btn-primary flex-1 justify-center text-center"
            onClick={() => setDismissed(true)}
          >
            Configurer ma clé
          </Link>
          <button onClick={() => setDismissed(true)} className="btn-ghost text-sm px-4">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
