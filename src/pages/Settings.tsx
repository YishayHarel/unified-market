import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, User, Bell, Crown } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import NotificationSettings from "@/components/NotificationSettings";
import WatchlistAlerts from "@/components/WatchlistAlerts";

const Settings = () => {
  const { user, subscription } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account, alerts, and notification preferences
          </p>
        </div>

        {/* Account Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Crown className={`h-5 w-5 ${subscription?.subscribed ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium">Subscription</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription?.subscribed ? `${subscription.tier || 'Premium'} Plan` : 'Free Plan'}
                  </p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/subscription">
                  {subscription?.subscribed ? 'Manage' : 'Upgrade'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <NotificationSettings />

        {/* Watchlist Alerts */}
        <WatchlistAlerts />
      </div>
    </div>
  );
};

export default Settings;
