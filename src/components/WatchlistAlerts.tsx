import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Activity, Percent, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SignInPrompt from "@/components/SignInPrompt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  target_price: number | null;
  message: string | null;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

/**
 * Only the conditions the scheduled checker can actually evaluate.
 *
 * "Earnings Date" and "Dividend Date" used to be offered here. Nothing ever
 * evaluated them, so choosing one created a row that could never fire. An
 * option that cannot work is worse than a missing one — it looks like the
 * alert is set.
 */
const ALERT_TYPES = [
  {
    value: "price_above",
    label: "Price rises above",
    unit: "$",
    targetLabel: "Target price ($)",
    placeholder: "150.00",
    max: 1_000_000,
    icon: TrendingUp,
    tone: "text-green-500",
  },
  {
    value: "price_below",
    label: "Price falls below",
    unit: "$",
    targetLabel: "Target price ($)",
    placeholder: "90.00",
    max: 1_000_000,
    icon: TrendingDown,
    tone: "text-red-500",
  },
  {
    value: "percent_up",
    label: "Gains more than (in a day)",
    unit: "%",
    targetLabel: "Percentage gain (%)",
    placeholder: "5",
    max: 100,
    icon: Percent,
    tone: "text-green-500",
  },
  {
    value: "percent_down",
    label: "Drops more than (in a day)",
    unit: "%",
    targetLabel: "Percentage drop (%)",
    placeholder: "5",
    max: 100,
    icon: Percent,
    tone: "text-red-500",
  },
  {
    value: "volume_spike",
    label: "Trades unusual volume",
    unit: "x",
    targetLabel: "Volume multiple (2 = twice normal)",
    placeholder: "2",
    max: 100,
    icon: Activity,
    tone: "text-orange-500",
  },
] as const;

const typeConfig = (value: string) => ALERT_TYPES.find((t) => t.value === value) ?? ALERT_TYPES[0];

const formatTarget = (alert: Alert) => {
  if (alert.target_price == null) return "";
  const { unit } = typeConfig(alert.alert_type);
  const value = Number(alert.target_price);
  return unit === "$" ? `$${value}` : `${value}${unit}`;
};

const WatchlistAlerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Alert | null>(null);

  const [symbol, setSymbol] = useState("");
  const [alertType, setAlertType] = useState<string>("price_above");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("watchlist_alerts")
      .select("id, symbol, alert_type, target_price, message, is_active, triggered_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load alerts:", error.message);
      toast.error("Could not load your alerts");
    } else {
      setAlerts((data ?? []) as Alert[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      void load();
    } else {
      setAlerts([]);
      setLoading(false);
    }
  }, [user, load]);

  async function addAlert() {
    if (!user) return;

    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    const config = typeConfig(alertType);
    const targetNum = Number(target);

    if (!cleanSymbol) return toast.error("Enter a ticker symbol.");
    if (!Number.isFinite(targetNum) || targetNum <= 0 || targetNum > config.max) {
      return toast.error(`Enter a ${config.unit === "$" ? "price" : "value"} between 0 and ${config.max}.`);
    }

    setSaving(true);
    const { error } = await supabase.from("watchlist_alerts").insert({
      user_id: user.id,
      symbol: cleanSymbol,
      alert_type: alertType,
      target_price: targetNum,
      message: note.trim() || null,
    });
    setSaving(false);

    if (error) {
      console.error("Could not add alert:", error.message);
      toast.error("Could not save that alert");
      return;
    }

    toast.success(`Alert set for ${cleanSymbol}`);
    setSymbol("");
    setTarget("");
    setNote("");
    setShowAddForm(false);
    void load();
  }

  async function confirmDelete() {
    const doomed = pendingDelete;
    setPendingDelete(null);
    if (!doomed) return;

    const { error } = await supabase.from("watchlist_alerts").delete().eq("id", doomed.id);
    if (error) {
      toast.error("Could not delete that alert");
      return;
    }
    toast.success("Alert deleted");
    void load();
  }

  async function toggleAlert(alert: Alert) {
    const { error } = await supabase
      .from("watchlist_alerts")
      .update({ is_active: !alert.is_active })
      .eq("id", alert.id);

    if (error) {
      toast.error("Could not update that alert");
      return;
    }
    void load();
  }

  /** Clears triggered_at so a fired alert starts watching again. */
  async function rearm(alert: Alert) {
    const { error } = await supabase
      .from("watchlist_alerts")
      .update({ triggered_at: null, is_active: true })
      .eq("id", alert.id);

    if (error) {
      toast.error("Could not reset that alert");
      return;
    }
    toast.success(`${alert.symbol} is watching again`);
    void load();
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <SignInPrompt
            title="Sign in to set price alerts"
            description="Get an email when a stock you follow hits your target."
          />
        </CardContent>
      </Card>
    );
  }

  const config = typeConfig(alertType);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Price Alerts
            </CardTitle>
            <CardDescription>
              Checked every 15 minutes while the market is open. When one fires you get an email,
              and it stops watching until you reset it.
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add alert
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alert-symbol">Stock symbol</Label>
                  <Input
                    id="alert-symbol"
                    placeholder="AAPL"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alert-type">Tell me when it</Label>
                  <Select
                    value={alertType}
                    onValueChange={(value) => {
                      setAlertType(value);
                      setTarget("");
                    }}
                  >
                    <SelectTrigger id="alert-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert-target">{config.targetLabel}</Label>
                <Input
                  id="alert-target"
                  type="number"
                  step="0.01"
                  min="0"
                  max={config.max}
                  placeholder={config.placeholder}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert-note">Note (optional)</Label>
                <Input
                  id="alert-note"
                  placeholder="Why you're watching this"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button onClick={addAlert} disabled={saving}>
                  {saving ? "Saving…" : "Add alert"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No alerts set up yet.</p>
            <p className="text-sm text-muted-foreground">
              Add one and we will email you when the condition is met.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const { icon: Icon, tone, label } = typeConfig(alert.alert_type);
              const fired = alert.triggered_at !== null;

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg bg-muted/50 ${!alert.is_active && !fired ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className={`h-4 w-4 mt-1 shrink-0 ${tone}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{alert.symbol}</span>
                          {fired && (
                            <Badge variant="secondary">
                              Triggered {new Date(alert.triggered_at!).toLocaleDateString()}
                            </Badge>
                          )}
                          {!alert.is_active && !fired && <Badge variant="outline">Paused</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {label} {formatTarget(alert)}
                        </div>
                        {alert.message && (
                          <div className="text-xs text-muted-foreground mt-1">{alert.message}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {fired ? (
                        <Button variant="outline" size="sm" onClick={() => rearm(alert)}>
                          Reset
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => toggleAlert(alert)}>
                          {alert.is_active ? "Pause" : "Resume"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDelete(alert)}
                        aria-label={`Delete ${alert.symbol} alert`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {pendingDelete?.symbol} alert?</AlertDialogTitle>
            <AlertDialogDescription>
              You will stop being emailed about it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default WatchlistAlerts;
