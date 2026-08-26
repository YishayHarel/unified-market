import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls an AI edge function and turns its failure modes into states the UI can
 * render deliberately.
 *
 * The AI endpoints reject for several distinct reasons — the feature flag is
 * off, the caller is signed out, they have no subscription, they have hit a
 * limit — and each deserves a different screen. Collapsing them into one
 * "something went wrong" would, for instance, show an error to someone who
 * simply needs to subscribe.
 */
export type AIErrorKind =
  | "unauthenticated"
  | "subscription_required"
  | "rate_limited"
  | "disabled"
  | "failed";

export interface AIError {
  kind: AIErrorKind;
  message: string;
}

interface AIState<T> {
  data: T | null;
  error: AIError | null;
  loading: boolean;
}

/** Maps a status code and payload onto the state the UI should show. */
function classify(status: number | undefined, payload: unknown): AIError {
  const body = (payload ?? {}) as { error?: string; reason?: string; upgradeRequired?: boolean };
  const message = body.reason || body.error || "Something went wrong.";

  if (body.upgradeRequired || status === 402) {
    return { kind: "subscription_required", message };
  }
  if (status === 401) {
    return { kind: "unauthenticated", message: "Sign in to use this feature." };
  }
  if (status === 429) {
    return { kind: "rate_limited", message };
  }
  // 503 is the AI_ENABLED gate, which is a product state rather than a fault.
  if (status === 503) {
    return { kind: "disabled", message: message || "AI features are coming soon." };
  }
  return { kind: "failed", message };
}

export function useAIFunction<T>(functionName: string) {
  const [state, setState] = useState<AIState<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const invoke = useCallback(
    async (body: Record<string, unknown> = {}) => {
      setState({ data: null, error: null, loading: true });

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setState({
          data: null,
          loading: false,
          error: { kind: "unauthenticated", message: "Sign in to use this feature." },
        });
        return null;
      }

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        // functions.invoke hides the body on non-2xx; read it off the response
        // so the real reason (subscription, limit, flag) survives.
        let status: number | undefined;
        let payload: unknown = null;
        const response = (error as { context?: Response }).context;
        if (response instanceof Response) {
          status = response.status;
          payload = await response.json().catch(() => null);
        }
        setState({ data: null, loading: false, error: classify(status, payload) });
        return null;
      }

      // Some functions answer 200 with an error field rather than a status.
      const asRecord = data as { error?: string } | null;
      if (asRecord?.error) {
        setState({
          data: null,
          loading: false,
          error: { kind: "failed", message: asRecord.error },
        });
        return null;
      }

      setState({ data: data as T, error: null, loading: false });
      return data as T;
    },
    [functionName],
  );

  const reset = useCallback(
    () => setState({ data: null, error: null, loading: false }),
    [],
  );

  return { ...state, invoke, reset };
}
