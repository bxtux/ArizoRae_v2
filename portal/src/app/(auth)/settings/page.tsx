import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function SettingsPage({ searchParams }: { searchParams: { saved?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      email: true,
      mailFrequencyDays: true,
      anthropicKeyEncrypted: true,
      openaiKeyEncrypted: true,
      aiProvider: true,
    },
  });
  const hasAnthropicKey = !!user?.anthropicKeyEncrypted;
  const hasOpenaiKey = !!user?.openaiKeyEncrypted;
  const provider = user?.aiProvider ?? 'claude';

  async function saveProvider(fd: FormData) {
    'use server';
    const s = await auth();
    if (!s?.user?.id) return;
    const p = String(fd.get('ai_provider') || 'claude');
    if (p !== 'claude' && p !== 'openai') return;
    await (await import('@/lib/db')).prisma.user.update({
      where: { id: s.user.id },
      data: { aiProvider: p },
    });
    const { redirect: r } = await import('next/navigation');
    r('/settings?saved=1');
  }

  async function saveOpenaiKey(fd: FormData) {
    'use server';
    const s = await auth();
    if (!s?.user?.id) return;
    const rawKey = String(fd.get('openai_key') || '').trim();
    let openaiKeyEncrypted: string | null = null;
    if (rawKey) {
      const { encryptApiKey } = await import('@/lib/crypto');
      openaiKeyEncrypted = encryptApiKey(rawKey);
    }
    await (await import('@/lib/db')).prisma.user.update({
      where: { id: s.user.id },
      data: { openaiKeyEncrypted },
    });
    const { redirect: r } = await import('next/navigation');
    r('/settings?saved=1');
  }

  async function saveMailFreq(fd: FormData) {
    'use server';
    const s = await auth();
    if (!s?.user?.id) return;
    const days = fd.get('mail_frequency_days');
    await (await import('@/lib/db')).prisma.user.update({
      where: { id: s.user.id },
      data: { mailFrequencyDays: days ? parseInt(String(days)) : null },
    });
    const { redirect: r } = await import('next/navigation');
    r('/settings?saved=1');
  }

  async function saveAnthropicKey(fd: FormData) {
    'use server';
    const s = await auth();
    if (!s?.user?.id) return;
    const rawKey = String(fd.get('anthropic_key') || '').trim();
    let anthropicKeyEncrypted: string | null = null;
    if (rawKey) {
      const { encryptApiKey } = await import('@/lib/crypto');
      anthropicKeyEncrypted = encryptApiKey(rawKey);
    }
    await (await import('@/lib/db')).prisma.user.update({
      where: { id: s.user.id },
      data: { anthropicKeyEncrypted },
    });
    const { redirect: r } = await import('next/navigation');
    r('/settings?saved=1');
  }

  async function sendSupport(fd: FormData) {
    'use server';
    const s = await auth();
    if (!s?.user?.id) return;
    const subject = String(fd.get('subject') || '').slice(0, 200);
    const body = String(fd.get('body') || '').slice(0, 5000);
    if (!subject || !body) return;
    const { prisma: db } = await import('@/lib/db');
    const { notifyAdmin } = await import('@/lib/gotify');
    await db.supportTicket.create({ data: { userId: s.user.id, subject, body } });
    await notifyAdmin(`[Support] ${subject}`, `User ${s.user.email}: ${body.slice(0, 300)}`);
    const { redirect: r } = await import('next/navigation');
    r('/settings?saved=1');
  }

  async function deleteAccount() {
    'use server';
    const s = await auth();
    if (!s?.user?.id) return;
    const { prisma: db } = await import('@/lib/db');
    await db.$transaction([
      db.user.update({ where: { id: s.user.id }, data: { deletedAt: new Date() } }),
      db.session.deleteMany({ where: { userId: s.user.id } }),
    ]);
    const { redirect: r } = await import('next/navigation');
    r('/login?deleted=1');
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Paramètres</h1>

        {searchParams.saved && (
          <p className="text-green-400 text-sm">Modifications sauvegardées.</p>
        )}

        {/* Fournisseur IA */}
        <section className="glass p-6 space-y-4">
          <h2 className="text-xl font-semibold">Fournisseur IA</h2>
          <p className="text-sm text-muted">
            Choisissez le moteur IA utilisé pour tous les workflows (analyse, CV, lettre, chat…).
          </p>
          <form action={saveProvider} className="space-y-4">
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ai_provider" value="claude" defaultChecked={provider === 'claude'} className="accent-primary" />
                <span className="text-sm font-medium">Claude (Anthropic)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="ai_provider" value="openai" defaultChecked={provider === 'openai'} className="accent-primary" />
                <span className="text-sm font-medium">ChatGPT (OpenAI)</span>
              </label>
            </div>
            <button type="submit" className="btn-primary">Appliquer</button>
          </form>
        </section>

        {/* Clé OpenAI */}
        <section className="glass p-6 space-y-4" id="openai-key">
          <h2 className="text-xl font-semibold">Clé OpenAI personnelle</h2>
          <p className="text-sm text-muted">
            Requise si vous utilisez le fournisseur ChatGPT. Chiffrée AES-256-GCM avant stockage.
          </p>
          {hasOpenaiKey && (
            <p className="text-sm text-green-400">Clé OpenAI configurée.</p>
          )}
          <form action={saveOpenaiKey} className="space-y-3">
            <input
              name="openai_key"
              type="password"
              placeholder={hasOpenaiKey ? 'Laisser vide pour conserver la clé actuelle' : 'sk-…'}
              className="input font-mono text-sm"
              autoComplete="off"
            />
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                {hasOpenaiKey ? 'Mettre à jour' : 'Enregistrer'}
              </button>
              {hasOpenaiKey && (
                <button
                  type="submit"
                  name="openai_key"
                  value=""
                  className="btn-ghost border-red-500/40 text-red-400 hover:bg-red-500/10"
                >
                  Supprimer la clé
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Clé Anthropic */}
        <section className="glass p-6 space-y-4" id="anthropic-key">
          <h2 className="text-xl font-semibold">Clé Anthropic personnelle</h2>
          <p className="text-sm text-muted">
            Utilisez votre propre clé API Anthropic pour ne pas consommer le quota gratuit.
            Elle est chiffrée (AES-256-GCM) avant stockage.
          </p>
          {hasAnthropicKey && (
            <p className="text-sm text-green-400">Clé configurée — elle sera utilisée en priorité.</p>
          )}
          <form action={saveAnthropicKey} className="space-y-3">
            <input
              name="anthropic_key"
              type="password"
              placeholder={hasAnthropicKey ? 'Laisser vide pour conserver la clé actuelle' : 'sk-ant-…'}
              className="input font-mono text-sm"
              autoComplete="off"
            />
            <div className="flex gap-3">
              <button type="submit" className="btn-primary">
                {hasAnthropicKey ? 'Mettre à jour' : 'Enregistrer'}
              </button>
              {hasAnthropicKey && (
                <button
                  type="submit"
                  name="anthropic_key"
                  value=""
                  className="btn-ghost border-red-500/40 text-red-400 hover:bg-red-500/10"
                >
                  Supprimer la clé
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Email digest */}
        <section className="glass p-6 space-y-4">
          <h2 className="text-xl font-semibold">Email digest</h2>
          <form action={saveMailFreq} className="space-y-4">
            <label className="block text-sm text-muted">
              Fréquence de réception des offres (jours, laisser vide pour désactiver)
            </label>
            <input
              name="mail_frequency_days"
              type="number"
              min="1"
              max="30"
              defaultValue={user?.mailFrequencyDays ?? ''}
              placeholder="ex: 1 (quotidien), 7 (hebdomadaire)"
              className="input"
            />
            <button type="submit" className="btn-primary">Sauvegarder</button>
          </form>
        </section>

        {/* Support */}
        <section className="glass p-6 space-y-4">
          <h2 className="text-xl font-semibold">Support</h2>
          <form action={sendSupport} className="space-y-4">
            <input name="subject" placeholder="Sujet" required className="input" />
            <textarea name="body" placeholder="Décrivez votre problème..." required rows={5} className="input resize-none" />
            <button type="submit" className="btn-primary">Envoyer</button>
          </form>
        </section>

        {/* Zone dangereuse */}
        <section className="glass p-6 border border-red-500/20">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Zone dangereuse</h2>
          <p className="text-sm text-muted mb-4">
            La suppression du compte est irréversible. Vos données seront archivées puis supprimées.
          </p>
          <form action={deleteAccount}>
            <button type="submit" className="btn-ghost border-red-500/40 text-red-400 hover:bg-red-500/10">
              Supprimer mon compte
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
