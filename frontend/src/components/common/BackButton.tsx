'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  /** Fallback route if there's no history (e.g. user opened the page via direct URL) */
  fallback?: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallback = '/dashboard', label = 'Back', className = '' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // If there is browser history, go back; otherwise fall back to the specified route
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`group inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 active:scale-95 ${className}`}
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </button>
  );
}
