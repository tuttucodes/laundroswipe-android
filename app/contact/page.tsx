'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStatus('error');
        setError(data?.error || 'Something went wrong. Please try again.');
      } else {
        setStatus('ok');
        setForm({ name: '', email: '', subject: '', message: '' });
      }
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <section className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-16 md:flex-row md:items-start md:px-8">
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-semibold md:text-4xl">Get In Touch</h1>
          <p className="max-w-md text-sm text-slate-300">
            Have questions? Want to partner with us? We&apos;d love to hear from you.
          </p>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p className="font-medium">🏢 Kochi Office</p>
            <p>F223 DLF NTH SEAPORT AIRPORT ROAD KOCHI 682030</p>
            <p className="mt-3">
              📧{' '}
              <a href="mailto:support@laundroswipe.com" className="text-primary hover:underline">
                support@laundroswipe.com
              </a>
            </p>
            <p>
              📱{' '}
              <a href="tel:+917736429562" className="text-primary hover:underline">
                +91 7736429562
              </a>
            </p>
          </div>
        </div>

        <div className="flex-1">
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-200">Name</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-200">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-200">Subject</label>
              <input
                className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-200">Message</label>
              <textarea
                className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </div>

            {status === 'error' && <p className="text-xs text-red-400">{error}</p>}
            {status === 'ok' && (
              <p className="text-xs text-emerald-400">
                Message sent! We&apos;ll get back to you soon.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

