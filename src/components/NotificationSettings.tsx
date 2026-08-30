import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, BellRing, Smartphone, Mail } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useState, useEffect } from "react";
import {
  readPreferences,
  writePreferences,
  subscribeToPreferences,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";

const NotificationSettings = () => {
  const { isSupported, isEnabled, permission, requestPermission, disableNotifications, sendNotification } =
    usePushNotifications();

  const [preferences, setPreferences] = useState<NotificationPreferences>(readPreferences);

  useEffect(() => subscribeToPreferences(setPreferences), []);

  const toggle = (key: keyof NotificationPreferences) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    writePreferences(next);
  };

  const statusIcon = !isSupported ? (
    <BellOff className="h-5 w-5 text-muted-foreground" />
  ) : isEnabled ? (
    <BellRing className="h-5 w-5 text-primary" />
  ) : (
    <Bell className="h-5 w-5 text-muted-foreground" />
  );

  const statusText = !isSupported
    ? "Not supported in this browser"
    : permission === "denied"
      ? "Blocked by browser"
      : isEnabled
        ? "Enabled"
        : "Disabled";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {statusIcon}
          Notifications
        </CardTitle>
        <CardDescription>
          Browser notifications reach you while UnifiedMarket is open. Price alerts are emailed
          instead, so they arrive whether the site is open or not.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium">Browser notifications</p>
              <p className="text-sm text-muted-foreground">{statusText}</p>
            </div>
          </div>
          {isSupported && !isEnabled && permission !== "denied" && (
            <Button onClick={requestPermission}>Enable</Button>
          )}
          {isSupported && isEnabled && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  sendNotification("Test notification", {
                    body: "Notifications are working.",
                    tag: "test",
                  })
                }
              >
                Test
              </Button>
              <Button variant="outline" size="sm" onClick={disableNotifications}>
                Disable
              </Button>
            </div>
          )}
        </div>

        {/*
          Only the two categories the alert checker actually produces. There
          were five switches here — including earnings and dividend reminders
          that nothing anywhere generated — and none of them were read by any
          code, so toggling them changed nothing at all.
        */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            What to notify me about
          </h4>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-big-moves" className="flex flex-col gap-1">
              <span>Big moves</span>
              <span className="text-xs text-muted-foreground font-normal">
                When a stock on your watchlist makes an unusual move
              </span>
            </Label>
            <Switch
              id="pref-big-moves"
              checked={preferences.bigMoves}
              onCheckedChange={() => toggle("bigMoves")}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-news" className="flex flex-col gap-1">
              <span>News</span>
              <span className="text-xs text-muted-foreground font-normal">
                Headlines about your watchlist, and major market news
              </span>
            </Label>
            <Switch id="pref-news" checked={preferences.news} onCheckedChange={() => toggle("news")} />
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-sm">
          <Mail className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Price alerts are emailed to your account address whenever one is met. Set them up under
            Price Alerts.
          </p>
        </div>

        {permission === "denied" && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            <p className="font-medium">Notifications are blocked</p>
            <p className="mt-1">
              To enable them, open the lock icon in your browser's address bar and allow
              notifications for this site.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
