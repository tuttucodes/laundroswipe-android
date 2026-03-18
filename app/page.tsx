import { FloatingNav } from '@/components/home/FloatingNav';
import { VerticalSidebar } from '@/components/home/VerticalSidebar';
import { OAuthRedirectToDashboard } from '@/components/home/OAuthRedirectToDashboard';
import { Hero } from '@/components/home/Hero';
import { BentoEcosystem } from '@/components/home/BentoEcosystem';
import { MarqueeStrips } from '@/components/home/MarqueeStrips';
import { FeatureTabs } from '@/components/home/FeatureTabs';
import { Testimonials } from '@/components/home/Testimonials';
import { ContactSection } from '@/components/home/ContactSection';
import { Footer } from '@/components/home/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black font-sans selection:bg-[#E8523F] selection:text-white overflow-x-hidden relative">
      <OAuthRedirectToDashboard />
      <FloatingNav />
      <VerticalSidebar />
      <Hero />
      <BentoEcosystem />
      <MarqueeStrips />
      <FeatureTabs />
      <Testimonials />
      <ContactSection />
      <Footer />
    </main>
  );
}
