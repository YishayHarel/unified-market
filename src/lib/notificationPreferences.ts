/**
 * Which in-app alerts a reader wants to see.
 *
 * The settings screen used to show five switches — price, volume, earnings,
 * dividend, news — that wrote to localStorage and were read by nothing. Every
 * one of them was decorative, and two of the five described alerts that no code
 * anywhere produced. This keeps only the categories the alert checker actually
 * emits, and puts them somewhere the checker reads.
 */

const STORAGE_KEY = "notification_preferences";

/** Emitted when preferences change, so open components stay in step. */
const CHANGE_EVENT = "notification-preferences-changed";

export interface NotificationPreferences {
  /** Unusual single-day moves in a watchlist stock. */
  bigMoves: boolean;
  /** Headlines about a watchlist stock, and broad market news. */
  news: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  bigMoves: true,
  news: true,
};

export function readPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      bigMoves: typeof parsed?.bigMoves === "boolean" ? parsed.bigMoves : DEFAULT_PREFERENCES.bigMoves,
      news: typeof parsed?.news === "boolean" ? parsed.news : DEFAULT_PREFERENCES.news,
    };
  } catch {
    // Private browsing, blocked storage, or an older shape left behind by the
    // previous five-switch version. Defaults are a fine answer to all three.
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writePreferences(preferences: NotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Not being able to remember the choice should not break the toggle.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: preferences }));
}

export function subscribeToPreferences(listener: (prefs: NotificationPreferences) => void): () => void {
  const handler = () => listener(readPreferences());
  window.addEventListener(CHANGE_EVENT, handler);
  // Another tab writing the same key.
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** Maps an alert from the checker onto the switch that governs it. */
export function isAlertAllowed(
  type: "big_move" | "stock_news" | "market_news",
  preferences: NotificationPreferences,
): boolean {
  return type === "big_move" ? preferences.bigMoves : preferences.news;
}
