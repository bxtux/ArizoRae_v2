'use client';

import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export function RaeChat({ contextPage }: { contextPage?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasLoadedHistory = useRef(false);

  useEffect(() => {
    if (open && !hasLoadedHistory.current) {
      hasLoadedHistory.current = true;
      fetch('/api/chat/history')
        .then((r) => r.json())
        .then((data: { messages?: Message[] }) => {
          if (data.messages?.length) setMessages(data.messages);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, contextPage }),
      });
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Erreur de connexion. Réessayez.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Ouvrir le chat RAE"
      >
        <img src="/rae-avatar.png" alt="RAE" className="w-10 h-10 rounded-full object-cover" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col glass shadow-2xl" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10">
            <img src="/rae-avatar.png" alt="RAE" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-semibold">Assistant RAE</span>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto text-muted hover:text-text text-xl leading-none"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-muted text-sm text-center">Posez une question à votre assistant RAE.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-primary text-white' : 'bg-white/10 text-text'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-3 py-2 rounded-xl text-sm text-muted animate-pulse">...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Écrivez un message..."
              className="input flex-1 py-2 text-sm"
            />
            <button
              onClick={send}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
