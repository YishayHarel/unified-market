import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { signInSchema, signUpSchema, type SignInInput, type SignUpInput } from "@/lib/validations";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff, ArrowLeft, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Password recovery lives on this page rather than its own route: it is the
  // same form with one field, and a separate page is one more thing to land on
  // and bounce off.
  const [mode, setMode] = useState<"auth" | "forgot">("auth");
  const [resetSent, setResetSent] = useState(false);
  const { user, signIn, signUp } = useAuth();

  // Following the emailed link signs the user in, so the usual
  // already-authenticated redirect would bounce them home before they could
  // choose a new password. Recovery is detected from the URL and takes
  // precedence.
  const isRecovery = new URLSearchParams(window.location.search).has("recovery");

  if (user && !isRecovery) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    
    // Validate input
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setValidationErrors(result.error.errors.map(err => err.message));
      return;
    }
    
    setLoading(true);
    await signIn(result.data.email, password);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    
    // Validate input with stricter password requirements for signup
    const result = signUpSchema.safeParse({ email, password });
    if (!result.success) {
      setValidationErrors(result.error.errors.map(err => err.message));
      return;
    }
    
    setLoading(true);
    await signUp(result.data.email, result.data.password);
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const trimmed = email.trim();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setValidationErrors(["Enter the email address on your account."]);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth?recovery=1`,
    });
    setLoading(false);

    // Supabase does not report unknown addresses — a request for an email with
    // no account still succeeds — so an error here is a real fault (redirect
    // URL not allow-listed, SMTP misconfigured, rate limited) and can be shown
    // without revealing who has an account.
    if (error) {
      console.error("Password reset request failed:", error.message);
      setValidationErrors([
        `Could not send the reset email: ${error.message}`,
      ]);
      return;
    }

    setResetSent(true);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    // Same strength rules as signup — a reset must not be a way around them.
    const result = signUpSchema.safeParse({ email: user?.email ?? "reset@placeholder.com", password });
    if (!result.success) {
      setValidationErrors(
        result.error.errors.filter((err) => err.path[0] === "password").map((err) => err.message),
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setValidationErrors([error.message]);
      return;
    }
    // Drop the recovery marker so a refresh does not reopen this form.
    window.location.replace("/");
  };

  const clearErrors = () => {
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">📈 UnifiedMarket</CardTitle>
          <CardDescription>
            {isRecovery
              ? "Choose a new password for your account"
              : "Sign in to your account or create a new one"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validationErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {isRecovery ? (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Choose a new password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearErrors();
                    }}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, and a number.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Set new password"}
              </Button>
            </form>
          ) : mode === "forgot" ? (
            resetSent ? (
              <div className="text-center py-6 space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 rounded-full bg-primary/10">
                    <MailCheck className="h-7 w-7 text-primary" />
                  </div>
                </div>
                <p className="font-medium">Check your email</p>
                <p className="text-sm text-muted-foreground">
                  If an account exists for {email}, a reset link is on its way. The
                  link expires after an hour.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMode("auth");
                    setResetSent(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrors();
                    }}
                    maxLength={255}
                    autoComplete="email"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll send a link to set a new password.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setMode("auth");
                    clearErrors();
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to sign in
                </Button>
              </form>
            )
          ) : (
          <Tabs defaultValue="signin" className="w-full" onValueChange={clearErrors}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrors();
                    }}
                    maxLength={255}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearErrors();
                      }}
                      maxLength={128}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => {
                    setMode("forgot");
                    clearErrors();
                  }}
                >
                  Forgot your password?
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrors();
                    }}
                    maxLength={255}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearErrors();
                      }}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters with uppercase, lowercase, and a number.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
