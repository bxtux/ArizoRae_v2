'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Step = 'form' | 'connecting' | 'uploading' | 'streaming' | 'done';
type Mode = 'standard' | 'economic';
type DemoOffer = { title: string; company: string; score: number };
type EconomicStatus = { connected: boolean; expired: boolean; expiresAt: string | null };
type ArtifactBundle = { facts: string; bullets: string; preset: string };

const ECONOMIC_STEPS: Record<string, string> = {
  auth_check: 'Vérification de la connexion OpenAI',
  workspace_prepare: 'Préparation de votre espace sécurisé',
  cv_extract: 'Extraction du contenu du CV',
  facts_generate: 'Création de FACTS.md',
  bullets_generate: 'Création de BULLET_LIBRARY.md',
  preset_generate: 'Génération du preset métier',
  artifacts_validate: 'Vérification des fichiers générés',
  done: 'Profil prêt',
};

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'economic' ? 'economic' : 'standard');
  const [step, setStep] = useState<Step>('form');
  const [progress, setProgress] = useState('Initialisation...');
  const [demoOffers, setDemoOffers] = useState<DemoOffer[]>([]);
  const [economicStatus, setEconomicStatus] = useState<EconomicStatus | null>(null);
  const [economicToken, setEconomicToken] = useState('');
  const [economicMessage, setEconomicMessage] = useState('');
  const [artifacts, setArtifacts] = useState<ArtifactBundle | null>(null);
  const [error, setError] = useState('');
  const esRef = useRef<EventSource | null>(null);

  const economicReady = !!economicStatus?.connected && !economicStatus.expired;
  const economicLabel = useMemo(() => {
    if (!economicStatus) return 'Vérification du mode économique...';
    if (economicStatus.connected) return `Mode economique activé jusqu'au ${new Date(economicStatus.expiresAt ?? '').toLocaleDateString('fr-BE')}`;
    if (economicStatus.expired) return 'Connexion expirée, reconnectez-vous pour continuer.';
    return 'Aucune connexion OpenAI active.';
  }, [economicStatus]);

  useEffect(() => {
    loadEconomicSession().catch(() => {});
    return () => esRef.current?.close();
  }, []);

  async function loadEconomicSession() {
    const res = await fetch('/api/economic/session');
    const data = (await res.json()) as EconomicStatus;
    setEconomicStatus(data);
  }

  async function connectEconomicSession() {
    if (!economicToken.trim()) {
      setEconomicMessage('Renseignez votre session OpenAI pour activer le mode économique.');
      return;
    }
    setStep('connecting');
    setEconomicMessage('');
    const res = await fetch('/api/economic/connect/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: economicToken, expiresInDays: 30 }),
    });
    if (!res.ok) {
      setStep('form');
      setEconomicMessage("Impossible d'activer le mode économique.");
      return;
    }
    setEconomicToken('');
    await loadEconomicSession();
    setStep('form');
    setEconomicMessage('Mode economique activé.');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    const file = fd.get('cv') as File;
    const metier = String(fd.get('metier') ?? '');
    const country = String(fd.get('country') ?? '');
    const confirmReplace = String(fd.get('confirmReplace') ?? '') === 'on';

    if (mode === 'economic') {
      if (!economicReady) {
        setError('Le mode économique requiert une connexion OpenAI active.');
        return;
      }
      await startEconomicOnboarding({ file, metier, country, confirmReplace });
      return;
    }

    await startStandardOnboarding({ file, metier, country });
  }

  async function startStandardOnboarding(args: { file: File; metier: string; country: string }) {
    setStep('uploading');

    const cvForm = new FormData();
    cvForm.append('cv', args.file);
    await fetch('/api/onboarding/cv', { method: 'POST', body: cvForm });

    const startRes = await fetch('/api/onboarding/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metier: args.metier, country: args.country }),
    });
    if (!startRes.ok) {
      setStep('form');
      setError("Impossible de démarrer l'onboarding standard.");
      return;
    }

    setStep('streaming');
    setProgress('Analyse du CV en cours...');

    const es = new EventSource('/api/ws/onboarding');
    esRef.current = es;
    es.addEventListener('progress', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { step?: string; percent?: number };
      setProgress(`${data.step ?? '...'} (${data.percent ?? 0}%)`);
    });
    es.addEventListener('done', () => {
      es.close();
      setStep('done');
      loadDemo();
    });
    es.addEventListener('error', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { message?: string; fallback_mode?: string };
      es.close();
      setStep('form');
      if (data.fallback_mode === 'economic') {
        setMode('economic');
        setError('Le mode standard est indisponible. Passez en mode économique pour continuer.');
        return;
      }
      setError(`Erreur : ${data.message}`);
    });

    es.onerror = () => {
      es.close();
      setStep('form');
      setError('Connexion perdue. Rafraîchissez la page.');
    };
  }

  async function startEconomicOnboarding(args: { file: File; metier: string; country: string; confirmReplace: boolean }) {
    setStep('uploading');
    const form = new FormData();
    form.append('cv', args.file);
    form.append('metier', args.metier);
    form.append('country', args.country);
    form.append('confirmReplace', String(args.confirmReplace));
    const startRes = await fetch('/api/economic/onboarding/start', { method: 'POST', body: form });
    const startData = await startRes.json().catch(() => ({}));

    if (startRes.status === 409) {
      setStep('form');
      setError('Un profil existe déjà. Cochez la confirmation pour le remplacer.');
      return;
    }
    if (!startRes.ok || !startData.runId) {
      setStep('form');
      setError("Impossible de démarrer le mode économique.");
      return;
    }

    setStep('streaming');
    setProgress('Mode economique activé, préparation du profil...');

    const es = new EventSource(`/api/economic/onboarding/events?runId=${encodeURIComponent(startData.runId)}`);
    esRef.current = es;
    es.addEventListener('progress', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { step?: string; percent?: number };
      const label = ECONOMIC_STEPS[data.step ?? ''] ?? data.step ?? 'Traitement en cours';
      setProgress(`${label} (${data.percent ?? 0}%)`);
    });
    es.addEventListener('done', () => {
      es.close();
      setProgress('Profil prêt.');
      setStep('done');
      loadArtifacts();
    });
    es.addEventListener('error', (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { message?: string };
      es.close();
      setStep('form');
      setError(data.message ?? 'Le mode économique a échoué.');
    });

    es.onerror = () => {
      es.close();
      setStep('form');
      setError('Connexion perdue pendant le mode économique.');
    };
  }

  async function loadDemo() {
    setProgress('Démo scraper en cours...');
    const res = await fetch('/api/scraper/demo', { method: 'POST' });
    const data = (await res.json()) as { offers?: DemoOffer[] };
    setDemoOffers(data.offers ?? []);
  }

  async function loadArtifacts() {
    const res = await fetch('/api/economic/artifacts');
    const data = (await res.json()) as ArtifactBundle;
    setArtifacts(data);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="glass w-full max-w-3xl p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Bienvenue sur ArizoRAE</h1>
          <p className="text-sm text-muted">
            Créez votre profil RAE et générez automatiquement les fichiers de référence nécessaires à la suite du parcours.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {step === 'form' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`rounded-xl border px-4 py-4 text-left ${mode === 'standard' ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5'}`}
              >
                <p className="font-semibold">Mode standard</p>
                <p className="text-sm text-muted">Traitement habituel via le moteur ArizoRAE.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('economic')}
                className={`rounded-xl border px-4 py-4 text-left ${mode === 'economic' ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5'}`}
              >
                <p className="font-semibold">Mode économique</p>
                <p className="text-sm text-muted">Fallback discret quand le mode standard n’est plus disponible.</p>
              </button>
            </div>

            {mode === 'economic' && (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Connexion OpenAI</h2>
                  <p className="text-sm text-muted">{economicLabel}</p>
                </div>
                <div className="space-y-3">
                  <textarea
                    value={economicToken}
                    onChange={(e) => setEconomicToken(e.target.value)}
                    placeholder="Collez ici votre session OpenAI"
                    rows={4}
                    className="input resize-none text-sm"
                  />
                  <button type="button" onClick={connectEconomicSession} className="btn-primary">
                    Activer le mode economique
                  </button>
                  {economicMessage && <p className="text-sm text-muted">{economicMessage}</p>}
                </div>
              </section>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
              {mode === 'economic' && (
                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <input name="confirmReplace" type="checkbox" className="mt-1 accent-primary" />
                  <span className="text-sm text-muted">
                    Autoriser le remplacement d’un profil existant si `FACTS.md` et `BULLET_LIBRARY.md` sont déjà présents.
                  </span>
                </label>
              )}
              <button type="submit" className="btn-primary w-full justify-center">
                {mode === 'economic' ? 'Lancer le mode economique' : "Lancer l'onboarding"}
              </button>
            </form>
          </div>
        )}

        {(step === 'connecting' || step === 'uploading' || step === 'streaming') && (
          <div className="text-center space-y-4 py-8">
            <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted">{progress}</p>
            <p className="text-xs text-muted">Cette étape prend 1 à 2 minutes. Ne fermez pas la page.</p>
          </div>
        )}

        {step === 'done' && mode === 'economic' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Profil économique prêt</h2>
            <p className="text-sm text-muted">
              Les fichiers de référence ont été créés et sont maintenant disponibles pour le reste des workflows.
            </p>
            <div className="grid gap-4">
              {[
                { title: 'FACTS.md', content: artifacts?.facts ?? '' },
                { title: 'BULLET_LIBRARY.md', content: artifacts?.bullets ?? '' },
                { title: 'preset.md', content: artifacts?.preset ?? '' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="font-semibold">{item.title}</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted">
                    {item.content || 'Fichier non disponible.'}
                  </pre>
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/dashboard')} className="btn-primary w-full justify-center">
              Aller au dashboard
            </button>
          </div>
        )}

        {step === 'done' && mode === 'standard' && (
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
