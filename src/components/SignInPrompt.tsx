import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

/**
 * Signed-out state for a feature that needs an account.
 *
 * Several panels told the reader to sign in and then gave them no way to do it,
 * which leaves the page a dead end — the nav has no sign-in entry either, so
 * the only route was to guess the URL.
 */
export function SignInPrompt({
  title,
  description,
  compact = false,
}: {
  title: string;
  description?: string;
  /** Inline variant for use inside a panel that already has its own heading. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{title}</span>
        <Button asChild size="sm" variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-8 space-y-3">
      <div className="flex justify-center">
        <div className="p-3 rounded-full bg-primary/10">
          <LogIn className="h-7 w-7 text-primary" />
        </div>
      </div>
      <p className="text-lg font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      )}
      <Button asChild className="mt-1">
        <Link to="/auth">Sign in</Link>
      </Button>
    </div>
  );
}

export default SignInPrompt;
