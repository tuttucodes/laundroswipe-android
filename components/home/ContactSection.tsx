'use client';

import { useState } from 'react';
import { TurnstileWidget } from '@/components/TurnstileWidget';

export function ContactSection() {
  const [userRole, setUserRole] = useState('Student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const payload = {
      role: userRole,
      name: name.trim(),
      email: email.trim(),
      institution: institution.trim(),
      message: message.trim(),
      subject: `Homepage inquiry (${userRole})`,
      captchaToken,
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus({ type: 'error', message: 'Please fill name, email, and message.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !data?.ok) {
        setStatus({ type: 'error', message: data?.error || 'Failed to send message.' });
        return;
      }

      setStatus({ type: 'ok', message: 'Sent! We’ll get back to you shortly.' });
      setName('');
      setEmail('');
      setInstitution('');
      setMessage('');
      setUserRole('Student');
    } catch {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="contact" className="w-full bg-[#0A0A0A] text-white pt-24 pb-24 px-4 md:px-8 relative overflow-hidden">
      
      {/* Ghost Watermark */}
      <div className="absolute top-[20%] right-[-10%] text-right text-[200px] font-bold text-white/[0.02] pointer-events-none select-none whitespace-nowrap z-0 font-playfair tracking-tighter">
        Get Started
      </div>

      <div className="max-w-[1200px] w-full mx-auto relative z-10 flex flex-col lg:flex-row gap-16 lg:gap-8">
        
        {/* Left Side (40%) */}
        <div className="w-full lg:w-[40%] flex flex-col justify-center">
          <span className="text-[#E8523F] font-sans text-xs uppercase tracking-[0.2em] font-bold mb-4 block">
            {'{ READY TO SWIPE? }'}
          </span>
          <h2 className="font-playfair text-6xl md:text-7xl lg:text-[84px] font-bold tracking-tight mb-8 leading-[1.05]">
            Get<br/>Started
          </h2>
          <p className="text-[#9CA3AF] text-lg font-sans mb-12 max-w-md leading-relaxed">
            LaundroSwipe is a platform where you select your favorite laundry partner and schedule a pickup in a swipe. Whether you&apos;re a student, vendor, or institution admin — let&apos;s simplify laundry together.
          </p>

          <div className="flex flex-col gap-2 border-l-2 border-white/10 pl-6">
            <a href="mailto:support@laundroswipe.com" className="text-white hover:text-[#E8523F] font-sans font-bold text-lg transition-colors">
              support@laundroswipe.com
            </a>
            <a href="tel:+917736429562" className="text-white hover:text-[#E8523F] font-sans font-bold text-lg transition-colors">
              +91 7736429562
            </a>
            <a
              href="https://wa.me/917736429562?text=Hi%20LaundroSwipe%2C%20I%27d%20like%20to%20get%20started."
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-white font-sans text-sm mt-2 transition-colors"
            >
              WhatsApp Us →
            </a>
          </div>
        </div>

        {/* Right Side (60%) */}
        <div className="w-full lg:w-[60%] flex items-center justify-end">
          <form 
            onSubmit={onSubmit}
            className="w-full max-w-[600px] bg-[#111111] rounded-[32px] p-8 md:p-12 border border-white/[0.06] shadow-2xl relative overflow-hidden group"
          >
            {/* Subtle glow */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/5 blur-[80px] rounded-full pointer-events-none"></div>

            <div className="relative z-10">
              <span className="text-zinc-400 font-sans text-[11px] uppercase tracking-[0.15em] font-bold mb-4 block">
                WHAT ARE YOU?
              </span>
              
              <div className="flex flex-wrap gap-3 mb-10">
                {['Student', 'Vendor', 'Institution Admin'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setUserRole(role)}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors border ${
                      userRole === role
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-zinc-400 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-6 font-sans">
                <input 
                  type="text" 
                  placeholder="YOUR NAME" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase"
                />
                <input 
                  type="email" 
                  placeholder="YOUR EMAIL" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase"
                />
                <input 
                  type="text" 
                  placeholder="YOUR INSTITUTION" 
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase"
                />
                <textarea 
                  placeholder="MESSAGE" 
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 pb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-[#E8523F] transition-colors text-sm font-bold tracking-widest uppercase resize-none mt-2"
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <TurnstileWidget onToken={setCaptchaToken} />
              </div>

              {status && (
                <div
                  className={`mt-8 rounded-2xl border px-5 py-4 text-sm font-semibold ${
                    status.type === 'ok'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-8 bg-[#E8523F] text-white py-5 rounded-full font-bold text-sm tracking-widest uppercase hover:bg-[#c24231] hover:shadow-[0_0_30px_rgba(232,82,63,0.3)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </section>
  );
}
