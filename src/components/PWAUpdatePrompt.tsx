import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

// How often to ask the browser whether a new build has been published. Without
// this a long-lived tab only checks on a hard navigation.
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Keeps the running app in step with what has been deployed.
 *
 * This previously asked before updating. That sounded considerate and was
 * wrong: people carried on using a stale build until they happened to notice a
 * toast, so shipped fixes did not reach them — including several during
 * development, where a deployed fix appeared broken because the browser was
 * still running the previous bundle. A fix nobody receives is not a fix.
 *
 * The worker now activates on its own and the page reloads once it takes
 * control, with a brief notice so the reload is not unexplained.
 */
export default function PWAUpdatePrompt() {
  const reloading = useRef(false);

  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // Offline or a transient failure just means we check again next tick.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.warn("[pwa] service worker registration failed:", error);
    },
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Fires when a new worker takes control, which with autoUpdate means fresh
    // assets are ready. The guard matters because the event can arrive twice.
    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      toast("Updating to the latest version…", { duration: 1500 });
      // Let the toast paint before the navigation discards it.
      setTimeout(() => window.location.reload(), 600);
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
