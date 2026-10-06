'use client';

import React, { useEffect, useState } from 'react';
import { useSyncStore } from '@/store/useSyncStore';
import { syncPendingActionsToServer, getPendingCount } from '@/lib/offlineSync';
import { WifiOff, RotateCw, CheckCircle2, CloudUpload, Sparkles } from 'lucide-react';

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, setIsOnline, setPendingCount } = useSyncStore();
  const [showSyncedToast, setShowSyncedToast] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);

  useEffect(() => {
    // Initial count
    getPendingCount().then((count) => setPendingCount(count));

    const handleOnline = () => {
      console.log('🌐 Internet connection restored');
      setIsOnline(true);
      syncPendingActionsToServer().then((result) => {
        if (result.synced > 0) {
          setSyncedCount(result.synced);
          setShowSyncedToast(true);
          setTimeout(() => setShowSyncedToast(false), 4000);
        }
      });
    };

    const handleOffline = () => {
      console.log('⚡ Lost internet connection — switching to Offline-First Mode');
      setIsOnline(false);
    };

    const handleSyncComplete = (e: any) => {
      const synced = e.detail?.synced || 0;
      if (synced > 0) {
        setSyncedCount(synced);
        setShowSyncedToast(true);
        setTimeout(() => setShowSyncedToast(false), 4000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('workgrind:sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('workgrind:sync-complete', handleSyncComplete);
    };
  }, [setIsOnline, setPendingCount]);

  return (
    <>
      {/* ── PERSISTENT OFFLINE NOTICE BANNER ── */}
      {!isOnline && (
        <div
          role="alert"
          className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-amber-500/95 backdrop-blur-md px-4 py-2.5 text-xs font-semibold text-white shadow-md animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>
                You are currently offline. Tasks and messages will save locally and sync automatically when you reconnect.
              </span>
            </div>

            {pendingCount > 0 && (
              <span className="rounded-full bg-white/20 border border-white/30 px-2.5 py-0.5 text-[11px] font-bold text-white shrink-0">
                {pendingCount} pending sync
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── BACKGROUND SYNCING BANNER ── */}
      {isOnline && isSyncing && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm animate-in fade-in duration-200">
          <RotateCw className="h-3.5 w-3.5 animate-spin" />
          <span>Syncing offline changes with WorkGrind server...</span>
        </div>
      )}

      {/* ── SYNC SUCCESS TOAST ── */}
      {showSyncedToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900/95 border border-slate-700 backdrop-blur-xl px-4 py-2.5 text-xs font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            All changes synced! {syncedCount} offline action{syncedCount > 1 ? 's' : ''} saved to workspace.
          </span>
        </div>
      )}
    </>
  );
}
