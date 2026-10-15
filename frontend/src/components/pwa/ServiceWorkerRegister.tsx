'use client';

import { useEffect } from 'react';
import { syncPendingActionsToServer } from '@/lib/offlineSync';
import { shouldReloadForServiceWorkerControllerChange } from '@/lib/serviceWorkerUpdate';

const DEV_BUILD_ID_KEY = 'workgrind:dev-build-id';
const DEV_BUILD_RELOAD_KEY = 'workgrind:dev-build-reloaded:';

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Service workers cause problems in development:
    // - They intercept hot-reload chunks and cause ERR_CONNECTION_REFUSED
    // - Stale caches hide code changes until manually cleared
    // Production-only registration is the correct approach.
    if (typeof window === 'undefined') return;

    const isDev = process.env.NODE_ENV !== 'production';
    const buildId = process.env.NEXT_PUBLIC_BUILD_ID;
    let cleanupBuildListener: (() => void) | undefined;

    if (isDev && buildId) {
      const handleBuildChange = (event: StorageEvent) => {
        if (event.key === DEV_BUILD_ID_KEY && event.newValue && event.newValue !== buildId) {
          window.location.reload();
        }
      };
      window.addEventListener('storage', handleBuildChange);
      cleanupBuildListener = () => window.removeEventListener('storage', handleBuildChange);

      try {
        const storedBuildId = localStorage.getItem(DEV_BUILD_ID_KEY);
        if (storedBuildId && storedBuildId !== buildId) {
          const reloadKey = `${DEV_BUILD_RELOAD_KEY}${buildId}`;
          if (sessionStorage.getItem(reloadKey) !== '1') {
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
            return cleanupBuildListener;
          }
        }
        localStorage.setItem(DEV_BUILD_ID_KEY, buildId);
      } catch {
        // Keep the page usable when browser storage is disabled.
      }
    }

    if (!('serviceWorker' in navigator)) return cleanupBuildListener;

    const cleanupDevServiceWorkers = async () => {
      if (isDev) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          const hadController = Boolean(navigator.serviceWorker.controller);
          const removed = await Promise.all(registrations.map((registration) => registration.unregister()));
          const reloadKey = 'workgrind-dev-sw-cleanup-reloaded';
          if (hadController && removed.every(Boolean) && !sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
            return;
          }
          if (!navigator.serviceWorker.controller) sessionStorage.removeItem(reloadKey);
        } catch {
          // Ignore cleanup failures in dev; stale registrations are worse than a quiet no-op.
        }
      }
    };

    cleanupDevServiceWorkers();

    if (isDev) return cleanupBuildListener;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      const controllerUrl = navigator.serviceWorker.controller?.scriptURL || buildId || 'active';
      const reloadKey = `workgrind-sw-reloaded:${controllerUrl}`;
      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(reloadKey) === '1';
        if (shouldReloadForServiceWorkerControllerChange(hadController, alreadyReloaded)) {
          sessionStorage.setItem(reloadKey, '1');
        }
      } catch {
        alreadyReloaded = false;
      }
      if (!shouldReloadForServiceWorkerControllerChange(hadController, alreadyReloaded)) return;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[PWA diagnostics] Reloading after an updated service worker took control.');
      }
      window.location.reload();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRIGGER_BACKGROUND_SYNC') {
        syncPendingActionsToServer();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    const registerSW = async () => {
      try {
        const scriptUrl = buildId ? `/sw.js?build=${encodeURIComponent(buildId)}` : '/sw.js';
        const registration = await navigator.serviceWorker.register(scriptUrl, {
          // updateViaCache: 'none' tells the browser to always network-fetch
          // the SW script itself, bypassing the HTTP cache. This ensures
          // users get SW updates promptly when a new version is deployed.
          updateViaCache: 'none',
          scope: '/',
        });

        console.log('✓ WorkGrind PWA Service Worker registered:', registration.scope);

        // Listen for a new SW waiting to activate — when found, activate it
        // immediately so the installed app always runs the latest version.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new SW is waiting — skip waiting to activate immediately
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              console.log('✓ WorkGrind PWA updated — new version now active.');
            }
          });
        });

        // Register for Background Sync if supported
        if ('sync' in registration) {
          (registration as any).sync
            .register('sync-pending-actions')
            .catch(() => { /* Browser may not support background sync */ });
        }
      } catch (error) {
        console.warn('PWA Service Worker registration failed:', error);
      }
    };

    void registerSW();
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  return null;
}
