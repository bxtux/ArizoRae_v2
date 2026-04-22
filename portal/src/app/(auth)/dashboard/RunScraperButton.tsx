'use client';

import { useState } from 'react';

export function RunScraperButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function handleClick() {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch('/api/scraper/run', { method: 'POST' });
      if (!res.ok) throw new Error();
      setStatus('done');
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  }

  const labels = {
    idle: 'Lancer le scraper',
    loading: 'Lancement...',
    done: 'Scraper lancé !',
    error: 'Erreur — réessayez',
  };

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className={`btn-primary text-sm px-5 py-2 transition-colors ${
        status === 'done' ? 'bg-green-600' : status === 'error' ? 'bg-red-600' : ''
      }`}
    >
      {labels[status]}
    </button>
  );
}
