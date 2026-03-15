import dynamic from 'next/dynamic';
import AddToHomeScreenPrompt from '@/components/AddToHomeScreenPrompt';

const LaundroApp = dynamic(() => import('@/components/LaundroApp'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="app-wrap" id="app">
      <LaundroApp />
      <AddToHomeScreenPrompt />
    </div>
  );
}
