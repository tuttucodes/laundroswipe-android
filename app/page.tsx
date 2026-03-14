import dynamic from 'next/dynamic';

const LaundroApp = dynamic(() => import('@/components/LaundroApp'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="app-wrap" id="app">
      <LaundroApp />
    </div>
  );
}
