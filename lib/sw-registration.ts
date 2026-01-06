'use client';

/**
 * Service Worker Registration Utility
 * Registers the service worker and handles update events
 */

const SW_URL = `/sw.js`;

export interface ServiceWorkerRegistrationOptions {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

/**
 * Register the service worker
 */
export function registerServiceWorker(options: ServiceWorkerRegistrationOptions = {}): void {
  if (!isServiceWorkerSupported()) {
    console.warn('[SW] Service workers are not supported in this browser');
    return;
  }

  const { onUpdate, onSuccess, onError } = options;

  // Register the service worker
  navigator.serviceWorker
    .register(SW_URL)
    .then((registration) => {
      console.log('[SW] Service worker registered successfully');

      // Check for updates
      if (registration.waiting) {
        // Service worker is already waiting to activate
        onUpdate?.(registration);
      } else if (registration.installing) {
        // Service worker is installing
        registration.installing.addEventListener('statechange', () => {
          if (registration.waiting) {
            onUpdate?.(registration);
          } else if (registration.active) {
            onSuccess?.(registration);
          }
        });
      } else {
        // Service worker is already active
        onSuccess?.(registration);
      }

      // Listen for new service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && registration.waiting) {
            // New service worker is waiting to activate
            onUpdate?.(registration);
          }
        });
      });
    })
    .catch((error) => {
      console.error('[SW] Service worker registration failed:', error);
      onError?.(error as Error);
    });
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('[SW] Service worker unregistered');
    }
  } catch (error) {
    console.error('[SW] Failed to unregister service worker:', error);
  }
}

/**
 * Skip waiting and activate the new service worker
 */
export function skipWaiting(): void {
  if (!isServiceWorkerSupported()) {
    return;
  }

  navigator.serviceWorker.getRegistration().then((registration) => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}

/**
 * Get the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Hook to register service worker in React components
 */
export function useServiceWorker(options: ServiceWorkerRegistrationOptions = {}) {
  if (typeof window === 'undefined') {
    return { registration: null, update: skipWaiting, isSupported: false };
  }

  return {
    registration: null,
    update: skipWaiting,
    isSupported: isServiceWorkerSupported(),
  };
}
