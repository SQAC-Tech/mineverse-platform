import React from 'react';
import { HeroSection } from '@/components/HeroSection';
import { TimelineSection } from '@/components/TimelineSection';
import { Footer } from '@/components/Footer';
import { MinecraftBoard } from '@/components/MinecraftBoard';

export default function MainPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] overflow-hidden">
      <HeroSection />
      <div 
        className="relative w-full"
        style={{ 
          backgroundImage: "url('/cave-bg.webp')",
          backgroundSize: 'cover',
          backgroundBlendMode: 'overlay',
          backgroundColor: '#5D4037',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-black/75 z-0"></div>
        <div className="relative z-10">
          <TimelineSection />
          
          {/* Contact Section */}
          <section className="py-16 px-4 flex flex-col items-center justify-center gap-6 text-white" 
            style={{ 
              fontFamily: 'var(--font-minecraft)'
            }}
          >
        <h2 className="text-3xl md:text-4xl text-[#fca311] mb-6 tracking-widest drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">CONTACT US</h2>
        
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl px-4">
          <div className="flex-1 w-full max-w-sm mx-auto">
            <MinecraftBoard title="Faculty Convenor">
              <p className="text-xl text-[#8b0000] font-bold mt-2">Dr. M Suganiya</p>
              <p className="text-xl text-[#8b0000] font-bold mt-2">Dr. Ajanthaa Lakkshmanan </p>
            </MinecraftBoard>
          </div>
          
          <div className="flex-1 w-full max-w-sm mx-auto">
            <MinecraftBoard title="Secretary">
              <div className="space-y-4 mt-2">
                <div className="flex flex-col border-b-2 border-[#8b6b47] pb-2 border-dashed">
                  <span className="text-lg font-bold text-[#006400]">Tusharika Suman</span>
                  <span className="text-[#3c2512] font-bold text-sm">9354643301</span>
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-xl font-bold text-[#2d1e0f] mb-2 block"
                    style={{ fontFamily: 'var(--font-minecraft)' }}
                  >
                    Jt. Secretary
                  </span>

                  <span className="text-lg font-bold text-[#006400]">
                    Mahik Jain
                  </span>

                  <span className="text-[#3c2512] font-bold text-sm">
                    9818860837
                  </span>
                </div>
              </div>
            </MinecraftBoard>
          </div>
        </div>
      </section>
      </div>
      </div>

      <Footer />
    </main>
  );
}
