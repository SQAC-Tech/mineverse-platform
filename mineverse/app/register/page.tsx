import { RegistrationForm } from '@/features/landing-registration/registration-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Register - MINEVERSE',
};

export default function RegisterPage() {
  const mc = { fontFamily: 'var(--font-minecraft), system-ui, sans-serif' };

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden flex flex-col">
      {/* Background with slight tint */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        backgroundImage: 'url(/cavern-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: 'brightness(0.5)',
      }} />

      <div className="relative z-10 p-6 flex items-center justify-between">
        <Link href="/">
          <button style={{
            background: '#4a3320',
            borderTop: '3px solid #6c4b31',
            borderLeft: '3px solid #6c4b31',
            borderBottom: '3px solid #1f140c',
            borderRight: '3px solid #1f140c',
            padding: '8px 16px',
            color: '#fca311',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            ...mc
          }} className="hover:brightness-110 active:scale-95 transition-all">
            <ArrowLeft className="w-4 h-4" /> BACK TO HOME
          </button>
        </Link>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 py-12">
        <RegistrationForm />
      </div>
    </div>
  );
}
