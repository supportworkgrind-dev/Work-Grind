'use client';

import Link from 'next/link';
import { ArrowRight, LogIn } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export function HelpDestinationLink({ path }: { path: string }) {
  const user = useAuthStore((state) => state.user);
  const href = user ? path : `/login?redirect=${encodeURIComponent(path)}`;

  return (
    <Link href={href} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">
      {user ? 'Open in WorkGrind' : <><LogIn className="h-4 w-4" />Sign in to continue</>}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
