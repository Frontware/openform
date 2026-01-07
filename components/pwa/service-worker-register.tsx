'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/sw-registration';

/**
 * Service Worker Registration Component
 * Registers the service worker on mount and handles updates
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Register the service worker
    registerServiceWorker({
      onUpdate: (registration) => {
        console.log('[SW] New content is available; please refresh.');

        // Optionally show a prompt to the user
        if (registration.waiting) {
          // Send message to skip waiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });

          // Reload the page to get the new version
          registration.waiting.addEventListener('statechange', (e) => {
            const target = e.target as ServiceWorker;
            if (target.state === 'activated') {
              window.location.reload();
            }
          });
        }
      },
      onSuccess: (registration) => {
        console.log('[SW] Service worker is active:', registration);
      },
      onError: (error) => {
        console.error('[SW] Service worker registration error:', error);
      },
    });

    // Cleanup on unmount
    return () => {
      // Service worker will continue running, but we stop listening
    };
  }, []);

  return null;
}
