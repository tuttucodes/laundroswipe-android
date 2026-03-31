'use client';

import dynamic from 'next/dynamic';
import AddToHomeScreenPrompt from '@/components/AddToHomeScreenPrompt';
import PwaRegister from '@/components/PwaRegister';

const LaundroApp = dynamic(() => import('@/components/LaundroApp'), {
  ssr: false,
});

export default function DashboardPage() {
  return (
    <div className="app-wrap" id="app">
      <PwaRegister />
      <LaundroApp />
      <AddToHomeScreenPrompt />
    </div>
  );
}

