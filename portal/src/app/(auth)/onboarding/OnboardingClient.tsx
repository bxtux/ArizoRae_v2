'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'form' | 'uploading' | 'streaming' | 'demo' | 'done';
type DemoOffer = { title: string; company: string; score: number };

export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [progress, setProgress] = useState('Initialisation...');
  const [demoOffers, setDemoOffers] = useState<DemoOffer[]>([]);
  const esRef = useRef<EventSource | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('cv') as File;
    const metier = String(fd.get('metier') ?? '');
    const country = String(fd.get('country') ?? '');

    setStep('uploading');

    // 1) Upload CV
    const cvForm = new FormData();
    cvForm.append('cv', file);
    await fetch('/api/onboarding/cv', { method: 'POST', body: cvForm });

    // 2) Store metier + country (writes onboarding.json)
    await fetch('/api/onboarding/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metier, country }),
    });

    setStep('streaming');
    setProgress('Analyse du CV en cours...');

    // 3) Open SSE stream (proxy → agent-worker /workflows/init)
    const es = new EventSource('/api/ws/onboarding');
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          type: string;
          step?: string;
          percent?: number;
          message?: string;
        };
        if (data.type === 'progress') {
          setProgress(`${data.step ?? '...'} (${data.percent ?? 0}%)`);
        } else if (data.type === 'done') {
          es.close();
          setStep('demo');
          loadDemo();
        } else if (data.type === 'error') {
          es.close();
          setProgress(`Erreur : ${data.message}`);
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setProgress('Connexion perdue. Rafraîchissez la page.');
    };
  }

  async function loadDemo() {
    setProgress('Démo scraper en cours...');
    const res = await fetch('/api/scraper/demo', { method: 'POST' });
    const data = (await res.json()) as { offers?: DemoOffer[] };
    setDemoOffers(data.offers ?? []);
    setStep('done');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass w-full max-w-2xl p-8 space-y-6">
        <h1 className="text-2xl font-bold">Bienvenue sur ArizoRAE</h1>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-muted text-sm">
              Uploadez votre CV et renseignez vos préférences. Votre agent RAE sera configuré automatiquement.
            </p>
            <div>
              <label className="text-sm text-muted block mb-1">CV (PDF)</label>
              <input name="cv" type="file" accept=".pdf" required className="input" />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Poste visé</label>
              <input name="metier" required placeholder="ex : administrateur systèmes Linux" className="input" />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Pays (code)</label>
              <input name="country" required placeholder="BE, FR, CH, CA…" maxLength={5} className="input" />
            </div>
            <button type="submit" className="btn-primary w-full justify-center">
              Lancer l&apos;onboarding
            </button>
          </form>
        )}

        {(step === 'uploading' || step === 'streaming') && (
          <div className="text-center space-y-4 py-8">
            <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted">{progress}</p>
            <p className="text-xs text-muted">Cette étape prend 1 à 2 minutes — ne fermez pas la page.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Aperçu — premières offres trouvées</h2>
            {demoOffers.length === 0 ? (
              <p className="text-muted text-sm">
                Aucune offre démo disponible — le scraper sera lancé depuis le dashboard.
              </p>
            ) : (
              <ul className="space-y-2">
                {demoOffers.map((o, i) => (
                  <li key={i} className="glass p-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{o.title}</p>
                      <p className="text-sm text-muted">{o.company}</p>
                    </div>
                    <span className="text-primary font-mono font-bold">{o.score}</span>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => router.push('/dashboard')} className="btn-primary w-full justify-center">
              Aller au dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
