import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

// How often to ask the browser whether a new service worker has been published.
// Without this the check only happens on a hard navigation, so a long-lived tab
// can sit on a stale build indefinitely.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const UPDATE_TOAST_ID = "pwa-update-available";

/**
 * Tells the user when a new build is available and applies it on request.
 *
 * The service worker precaches the app shell, so a deploy does not reach anyone
 * who already has the site open — or who opens it from cache. This watches for
 * a waiting worker and offers a one-tap reload rather than forcing one, since
 * an unannounced refresh would discard whatever the user was in the middle of.
 */
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // Ignore failures: offline or a transient network error just means we
        // check again on the next tick.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.warn("[pwa] service worker registration failed:", error);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;

    toast("A new version of UnifiedMarket is available", {
      id: UPDATE_TOAST_ID,
      description: "Reload to get the latest fixes and data.",
      duration: Infinity,
      action: {
        label: "Reload",
        // updateServiceWorker(true) activates the waiting worker and reloads.
        onClick: () => void updateServiceWorker(true),
      },
      onDismiss: () => setNeedRefresh(false),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
