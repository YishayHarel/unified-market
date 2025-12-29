import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, BellRing, Smartphone } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useState, useEffect } from "react";

interface NotificationPreferences {
  priceAlerts: boolean;
  volumeAlerts: boolean;
  earningsAlerts: boolean;
  dividendAlerts: boolean;
  newsAlerts: boolean;
}

const NotificationSettings = () => {
  const { isSupported, isEnabled, permission, requestPermission, disableNotifications, sendNotification } = usePushNotifications();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const saved = localStorage.getItem('notification_preferences');
    return saved ? JSON.parse(saved) : {
      priceAlerts: true,
      volumeAlerts: true,
      earningsAlerts: true,
      dividendAlerts: true,
      newsAlerts: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('notification_preferences', JSON.stringify(preferences));
  }, [preferences]);

  const handleTogglePreference = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleTestNotification = () => {
    sendNotification('Test Notification', {
      body: 'Push notifications are working correctly!',
      tag: 'test',
    });
  };

  const getStatusIcon = () => {
    if (!isSupported) return <BellOff className="h-5 w-5 text-muted-foreground" />;
    if (isEnabled) return <BellRing className="h-5 w-5 text-primary" />;
    return <Bell className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (!isSupported) return 'Not supported in this browser';
    if (permission === 'denied') return 'Blocked by browser';
    if (isEnabled) return 'Enabled';
    return 'Disabled';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about price alerts, volume spikes, and more
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Status</p>
              <p className="text-sm text-muted-foreground">{getStatusText()}</p>
            </div>
          </div>
          {isSupported && (
            <>
              {!isEnabled && permission !== 'denied' ? (
                <Button onClick={requestPermission}>
                  Enable
                </Button>
              ) : isEnabled ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleTestNotification}>
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={disableNotifications}>
                    Disable
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Notification Preferences */}
        {isEnabled && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Alert Types
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="price-alerts" className="flex flex-col gap-1">
                  <span>Price Alerts</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    When stocks hit your target prices
                  </span>
                </Label>
                <Switch
                  id="price-alerts"
                  checked={preferences.priceAlerts}
                  onCheckedChange={() => handleTogglePreference('priceAlerts')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="volume-alerts" className="flex flex-col gap-1">
                  <span>Volume Alerts</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    When unusual trading volume is detected
                  </span>
                </Label>
                <Switch
                  id="volume-alerts"
                  checked={preferences.volumeAlerts}
                  onCheckedChange={() => handleTogglePreference('volumeAlerts')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="earnings-alerts" className="flex flex-col gap-1">
                  <span>Earnings Alerts</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Reminders before earnings reports
                  </span>
                </Label>
                <Switch
                  id="earnings-alerts"
                  checked={preferences.earningsAlerts}
                  onCheckedChange={() => handleTogglePreference('earningsAlerts')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="dividend-alerts" className="flex flex-col gap-1">
                  <span>Dividend Alerts</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Notifications for upcoming dividends
                  </span>
                </Label>
                <Switch
                  id="dividend-alerts"
                  checked={preferences.dividendAlerts}
                  onCheckedChange={() => handleTogglePreference('dividendAlerts')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="news-alerts" className="flex flex-col gap-1">
                  <span>News Alerts</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Breaking news for your watchlist
                  </span>
                </Label>
                <Switch
                  id="news-alerts"
                  checked={preferences.newsAlerts}
                  onCheckedChange={() => handleTogglePreference('newsAlerts')}
                />
              </div>
            </div>
          </div>
        )}

        {permission === 'denied' && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            <p className="font-medium">Notifications are blocked</p>
            <p className="mt-1">
              To enable notifications, click the lock icon in your browser's address bar and allow notifications.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
