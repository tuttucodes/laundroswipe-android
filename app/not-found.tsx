'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050816] px-4 text-white">
      <div className="max-w-md space-y-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] font-medium text-slate-300">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
          <span>404 · Page Not Found</span>
        </div>

        <h1 className="text-3xl font-semibold md:text-4xl">
          This laundry basket is empty.
        </h1>
        <p className="text-sm text-slate-300">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
          Let&apos;s get you back to fresh laundry.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            size="lg"
            className="shadow-[0_0_24px_rgba(59,130,246,0.9)]"
            onClick={() => router.push('/')}
          >
            Go to Homepage
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-slate-500/60 bg-transparent text-slate-100 hover:bg-white/5"
            asChild
          >
            <Link href="/dashboard">Open Dashboard</Link>
          </Button>
        </div>

        <p className="text-[0.7rem] text-slate-500">
          LaundroSwipe — Laundry, simplified.
        </p>
      </div>
    </main>
  );
}

