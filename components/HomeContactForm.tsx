'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function HomeContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject: 'Homepage contact',
          message,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError(
        err instanceof Error ? err.message : 'Could not send your message. Please try again.',
      );
    } finally {
      setTimeout(() => {
        setStatus('idle');
      }, 3500);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-white/[0.08] bg-black/40 p-8 md:p-10 backdrop-blur-3xl shadow-2xl"
    >
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-4">
          Name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="h-14 w-full rounded-lg border border-white/10 bg-white/5 px-6 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:border-transparent transition-all"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-4">
          Work email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-14 w-full rounded-lg border border-white/10 bg-white/5 px-6 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:border-transparent transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 pl-4">
          What do you have in mind?
        </label>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us briefly about your requirement."
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:border-transparent transition-all"
        />
      </div>
      {error && <p className="text-xs text-rose-400 pl-4">{error}</p>}
      {status === 'success' && (
        <p className="text-xs text-emerald-400 pl-4">Thanks for reaching out! We&apos;ll get back soon.</p>
      )}
      <div className="pt-2">
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-lg h-14 bg-white hover:bg-zinc-200 text-black shadow-lg shadow-white/10 transition-all font-bold text-[15px] hover:-translate-y-1 active:scale-95"
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Sending…' : 'Talk to our team'}
        </Button>
      </div>
      <p className="text-[11px] font-medium text-zinc-500 text-center">
        By submitting, you agree to be contacted by the LaundroSwipe team over phone or email.
      </p>
    </form>
  );
}

