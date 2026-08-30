import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Briefcase, Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SignInPrompt from "@/components/SignInPrompt";

interface Holding {
  id: string;
  symbol: string;
  company_name: string | null;
  shares: number;
  avg_cost: number;
  current_price: number | null;
  sector: string | null;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/**
 * Add, edit and remove portfolio positions.
 *
 * The table, its RLS policies and six backend readers all existed, but no part
 * of the app ever wrote to it — so every AI feature that personalises on
 * holdings had no way to receive any. The optimiser answered "add some holdings
 * first" against a screen that did not exist.
 *
 * Prices come from the same edge function the rest of the app uses, so the
 * value and P&L shown here match the stock pages rather than a stored snapshot
 * that drifts.
 */
const PortfolioHoldings = () => {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Holding | null>(null);

  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("portfolio_holdings")
      .select("id, symbol, company_name, shares, avg_cost, current_price, sector")
      .eq("user_id", user.id)
      .order("symbol");

    if (error) {
      console.error("Could not load holdings:", error.message);
      toast.error("Could not load your portfolio");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Holding[];
    setHoldings(rows);
    setLoading(false);

    // One batched quote call rather than one per row.
    if (rows.length > 0) {
      const { data: quotes } = await supabase.functions.invoke("get-stock-prices", {
        body: { symbols: [...new Set(rows.map((r) => r.symbol))] },
      });
      if (Array.isArray(quotes)) {
        const map: Record<string, number> = {};
        for (const q of quotes) {
          if (q?.symbol && typeof q.price === "number" && q.price > 0) map[q.symbol] = q.price;
        }
        setPrices(map);
      }
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  function priceFor(h: Holding) {
    return prices[h.symbol] ?? h.current_price ?? null;
  }

  const totals = useMemo(() => {
    let value = 0;
    let cost = 0;
    for (const h of holdings) {
      const price = priceFor(h);
      value += h.shares * (price ?? h.avg_cost);
      cost += h.shares * h.avg_cost;
    }
    return { value, cost, gain: value - cost, gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, prices]);

  function openAdd() {
    setEditing(null);
    setSymbol("");
    setShares("");
    setAvgCost("");
    setFormOpen(true);
  }

  function openEdit(h: Holding) {
    setEditing(h);
    setSymbol(h.symbol);
    setShares(String(h.shares));
    setAvgCost(String(h.avg_cost));
    setFormOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
    const sharesNum = Number(shares);
    const costNum = Number(avgCost);

    if (!cleanSymbol) return toast.error("Enter a ticker symbol.");
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) return toast.error("Shares must be greater than zero.");
    if (!Number.isFinite(costNum) || costNum <= 0) return toast.error("Average cost must be greater than zero.");

    setSaving(true);

    // Look up the company name so the AI context and this list are not just
    // bare tickers. Absence is not an error — plenty of symbols are missing
    // from the stocks table.
    const { data: stock } = await supabase
      .from("stocks")
      .select("name")
      .eq("symbol", cleanSymbol)
      .maybeSingle();

    const payload = {
      user_id: user.id,
      symbol: cleanSymbol,
      company_name: (stock?.name as string) ?? null,
      shares: sharesNum,
      avg_cost: costNum,
    };

    const { error } = editing
      ? await supabase.from("portfolio_holdings").update(payload).eq("id", editing.id)
      : await supabase.from("portfolio_holdings").insert(payload);

    setSaving(false);

    if (error) {
      console.error("Could not save holding:", error.message);
      toast.error("Could not save that position");
      return;
    }

    toast.success(editing ? `${cleanSymbol} updated` : `${cleanSymbol} added`);
    setFormOpen(false);
    void load();
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;

    const { error } = await supabase.from("portfolio_holdings").delete().eq("id", target.id);
    if (error) {
      toast.error("Could not remove that position");
      return;
    }
    toast.success(`${target.symbol} removed`);
    void load();
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignInPrompt
            title="Sign in to track your portfolio"
            description="Add your positions to see value, gains, and analysis based on what you actually hold."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Portfolio
            </CardTitle>
            <CardDescription>
              {holdings.length > 0
                ? `${holdings.length} position${holdings.length === 1 ? "" : "s"} · ${money(totals.value)}`
                : "Add what you hold to unlock analysis based on your own positions"}
            </CardDescription>
          </div>
          {!formOpen && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {formOpen && (
          <form onSubmit={save} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {editing ? `Edit ${editing.symbol}` : "New position"}
              </p>
              <Button type="button" variant="ghost" size="icon" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-symbol">Ticker</Label>
                <Input
                  id="h-symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  maxLength={10}
                  disabled={!!editing}
                  autoFocus={!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-shares">Shares</Label>
                <Input
                  id="h-shares"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="10"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-cost">Avg cost</Label>
                <Input
                  id="h-cost"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  placeholder="150.00"
                  inputMode="decimal"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add position"}
            </Button>
          </form>
        )}

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!loading && holdings.length === 0 && !formOpen && (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Nothing here yet. Adding your positions is what lets the AI features
              talk about your actual holdings instead of the market in general.
            </p>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add your first position
            </Button>
          </div>
        )}

        {!loading && holdings.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Value</div>
                <div className="font-semibold">{money(totals.value)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cost</div>
                <div className="font-semibold">{money(totals.cost)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Gain / loss</div>
                <div className={`font-semibold ${totals.gain >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {totals.gain >= 0 ? "+" : ""}{money(totals.gain)} ({totals.gainPct >= 0 ? "+" : ""}{totals.gainPct.toFixed(2)}%)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {holdings.map((h) => {
                const price = priceFor(h);
                const value = h.shares * (price ?? h.avg_cost);
                const gainPct = price != null ? ((price - h.avg_cost) / h.avg_cost) * 100 : null;
                const weight = totals.value > 0 ? (value / totals.value) * 100 : 0;

                return (
                  <div key={h.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link to={`/stock/${h.symbol}`}>
                            <Badge variant="secondary" className="hover:bg-primary/20">{h.symbol}</Badge>
                          </Link>
                          {h.company_name && (
                            <span className="text-sm text-muted-foreground truncate">{h.company_name}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {h.shares} @ {money(h.avg_cost)}
                          {price != null && <> · now {money(price)}</>}
                          {" · "}{weight.toFixed(1)}% of portfolio
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-medium">{money(value)}</div>
                          {gainPct != null && (
                            <div className={`text-xs ${gainPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(2)}%
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(h)} aria-label={`Edit ${h.symbol}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete(h)} aria-label={`Remove ${h.symbol}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>

      {/* Removing a position is irreversible, so it is confirmed rather than
          done on a single click next to the edit button. */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.symbol}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the position from your portfolio. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default PortfolioHoldings;
