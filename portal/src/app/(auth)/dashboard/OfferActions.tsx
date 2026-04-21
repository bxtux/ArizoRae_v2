'use client';

import { useState } from 'react';

export function OfferActions({ offerId }: { offerId: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function callAction(action: string) {
    setLoading(action);
    try {
      await fetch(`/api/offers/${offerId}/${action}`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } });
      setDone(action);
    } finally {
      setLoading(null);
    }
  }

  if (done) return <span className="text-sm text-muted capitalize">{done}</span>;

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => callAction('apply')}
        disabled={!!loading}
        className="btn-primary text-sm px-4 py-2"
      >
        {loading === 'apply' ? '...' : 'Postuler'}
      </button>
      <button
        onClick={() => callAction('interview')}
        disabled={!!loading}
        className="btn-ghost text-sm px-4 py-2"
      >
        {loading === 'interview' ? '...' : 'Entretien'}
      </button>
      <button
        onClick={() => callAction('reject')}
        disabled={!!loading}
        className="btn-ghost text-sm px-3 py-2 text-muted"
      >
        {loading === 'reject' ? '...' : 'Pas intéressé'}
      </button>
    </div>
  );
}
