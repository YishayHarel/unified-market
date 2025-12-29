import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check, Share, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-md mx-auto pt-12">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Already Installed!</h2>
              <p className="text-muted-foreground mb-6">
                UnifiedMarket is installed on your device. Open it from your home screen for the best experience.
              </p>
              <Button onClick={() => navigate('/')}>
                Go to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Install UnifiedMarket</h1>
          <p className="text-muted-foreground">
            Add to your home screen for quick access and an app-like experience
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Why Install?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Quick Access</p>
                <p className="text-sm text-muted-foreground">Launch directly from your home screen</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Works Offline</p>
                <p className="text-sm text-muted-foreground">View cached data even without internet</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Full Screen Experience</p>
                <p className="text-sm text-muted-foreground">No browser bars, feels like a native app</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Real-Time Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified about your saved stocks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full" size="lg">
            <Download className="h-5 w-5 mr-2" />
            Install Now
          </Button>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Install on iPhone/iPad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                <div className="flex items-center gap-2">
                  <span>Tap the</span>
                  <Share className="h-5 w-5" />
                  <span>Share button</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                <div className="flex items-center gap-2">
                  <span>Scroll and tap</span>
                  <Plus className="h-5 w-5" />
                  <span>"Add to Home Screen"</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                <span>Tap "Add" to confirm</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How to Install</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                <span>Open the browser menu (⋮ or ⋯)</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                <span>Tap "Install app" or "Add to Home Screen"</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                <span>Confirm the installation</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/')}>
          Maybe Later
        </Button>
      </div>
    </div>
  );
};

export default Install;
