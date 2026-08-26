import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, Lock, LogIn, AlertTriangle, Timer } from "lucide-react";
import type { AIError } from "@/hooks/useAIFunction";

/**
 * Renders the non-success states shared by every AI feature.
 *
 * Each reason gets its own message and its own next step: someone without a
 * subscription needs an upgrade link, not an error, and the feature flag being
 * off is a product state rather than a fault.
 */
export function AIStateNotice({ error, onRetry }: { error: AIError; onRetry?: () => void }) {
  if (error.kind === "disabled") {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Clock className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">Coming soon</h3>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          This feature is built and will switch on shortly.
        </p>
      </div>
    );
  }

  if (error.kind === "subscription_required") {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Lock className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">Included with a subscription</h3>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          AI analysis runs on your own holdings and costs money to produce, so it
          is part of the paid plan.
        </p>
        <Button asChild className="mt-2">
          <Link to="/subscription">See plans</Link>
        </Button>
      </div>
    );
  }

  if (error.kind === "unauthenticated") {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <LogIn className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">Sign in to continue</h3>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          This analysis is based on your portfolio, so it needs your account.
        </p>
        <Button asChild className="mt-2">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  const rateLimited = error.kind === "rate_limited";

  return (
    <Alert variant={rateLimited ? "default" : "destructive"}>
      {rateLimited ? <Timer className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>{rateLimited ? "Daily limit reached" : "Could not complete that"}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{error.message}</p>
        {onRetry && !rateLimited && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default AIStateNotice;
