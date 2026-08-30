import { useState, useEffect, useMemo, useCallback } from "react";
import SignInPrompt from "@/components/SignInPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Pencil, Loader2, Download, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface UserDividend {
  id: string;
  symbol: string;
  company: string;
  shares: number;
  dividend_per_share: number;
  frequency: number;
  next_pay_date: string | null;
  yield_percentage: number | null;
  created_at: string;
}

/** What the lookup returns from get-dividend-info. */
interface DividendInfo {
  symbol: string;
  company: string | null;
  price: number | null;
  dividendPerShare: number | null;
  frequency: number | null;
  annualDividend: number | null;
  yieldPercentage: number | null;
  lastPaidDate: string | null;
  nextPayDate: string | null;
  paysDividend: boolean;
}

// Guards against the kind of entry this table already collected before there
// was any validation: 67,676,767 shares paying $67 twenty times a year.
const MAX_SHARES = 10_000_000;
const MAX_DIVIDEND_PER_SHARE = 1_000;
const MAX_FREQUENCY = 12;

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const payDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const DividendTracker = () => {
  const { user } = useAuth();
  const [dividends, setDividends] = useState<UserDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserDividend | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserDividend | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [company, setCompany] = useState("");
  const [perShare, setPerShare] = useState("");
  const [frequency, setFrequency] = useState("");
  const [yieldPct, setYieldPct] = useState("");
  const [nextPay, setNextPay] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("user_dividends")
      .select("id, symbol, company, shares, dividend_per_share, frequency, next_pay_date, yield_percentage, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load dividends:", error.message);
      toast.error("Could not load your dividend stocks");
    } else {
      setDividends((data ?? []) as UserDividend[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      void load();
    } else {
      setDividends([]);
      setLoading(false);
    }
  }, [user, load]);

  /**
   * Fills in the payout details for a symbol.
   *
   * This is the point of the rewrite: the payout, cadence and yield are facts
   * about the company, not preferences, so asking the reader to supply them
   * only invited wrong numbers. They stay editable for the cases the data
   * misses — a special dividend, a freshly announced raise.
   */
  const lookup = useCallback(async (raw: string) => {
    const clean = raw.trim().toUpperCase();
    if (!clean) return;

    setLookingUp(true);
    setLookupNote(null);

    const { data, error } = await supabase.functions.invoke<DividendInfo>("get-dividend-info", {
      body: { symbol: clean },
    });

    setLookingUp(false);

    if (error || !data) {
      setLookupNote("Could not look that up — you can still enter the numbers yourself.");
      return;
    }

    if (data.company) setCompany(data.company);

    if (!data.paysDividend) {
      setLookupNote(`${data.symbol} has not paid a dividend in the last two years.`);
      return;
    }

    if (data.dividendPerShare != null) setPerShare(String(data.dividendPerShare));
    if (data.frequency != null) setFrequency(String(data.frequency));
    if (data.yieldPercentage != null) setYieldPct(String(data.yieldPercentage));
    setNextPay(data.nextPayDate);

    const parts: string[] = [];
    if (data.annualDividend != null) parts.push(`${money(data.annualDividend)}/share per year`);
    if (data.yieldPercentage != null) parts.push(`${data.yieldPercentage}% yield`);
    if (data.lastPaidDate) parts.push(`last paid ${payDate(data.lastPaidDate)}`);
    setLookupNote(parts.join(" · ") || null);
  }, []);

  function openAdd() {
    setEditing(null);
    setSymbol("");
    setShares("");
    setCompany("");
    setPerShare("");
    setFrequency("4");
    setYieldPct("");
    setNextPay(null);
    setLookupNote(null);
    setFormOpen(true);
  }

  function openEdit(d: UserDividend) {
    setEditing(d);
    setSymbol(d.symbol);
    setShares(String(d.shares));
    setCompany(d.company);
    setPerShare(String(d.dividend_per_share));
    setFrequency(String(d.frequency));
    setYieldPct(d.yield_percentage != null ? String(d.yield_percentage) : "");
    setNextPay(d.next_pay_date);
    setLookupNote(null);
    setFormOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    const sharesNum = Number(shares);
    const perShareNum = Number(perShare);
    const frequencyNum = Number(frequency);
    const yieldNum = yieldPct.trim() === "" ? null : Number(yieldPct);

    if (!cleanSymbol) return toast.error("Enter a ticker symbol.");
    if (!company.trim()) return toast.error("Enter the company name.");
    if (!Number.isFinite(sharesNum) || sharesNum <= 0 || sharesNum > MAX_SHARES) {
      return toast.error(`Shares must be between 0 and ${MAX_SHARES.toLocaleString()}.`);
    }
    if (!Number.isFinite(perShareNum) || perShareNum <= 0 || perShareNum > MAX_DIVIDEND_PER_SHARE) {
      return toast.error("Dividend per share must be a positive amount.");
    }
    if (!Number.isInteger(frequencyNum) || frequencyNum < 1 || frequencyNum > MAX_FREQUENCY) {
      return toast.error("Frequency must be between 1 and 12 payments a year.");
    }
    if (yieldNum !== null && (!Number.isFinite(yieldNum) || yieldNum < 0 || yieldNum > 100)) {
      return toast.error("Yield must be between 0 and 100%.");
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      symbol: cleanSymbol,
      company: company.trim(),
      shares: sharesNum,
      dividend_per_share: perShareNum,
      frequency: frequencyNum,
      yield_percentage: yieldNum,
      next_pay_date: nextPay,
    };

    const { error } = editing
      ? await supabase.from("user_dividends").update(payload).eq("id", editing.id)
      : await supabase.from("user_dividends").insert(payload);

    setSaving(false);

    if (error) {
      console.error("Could not save dividend:", error.message);
      toast.error("Could not save that stock");
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

    const { error } = await supabase.from("user_dividends").delete().eq("id", target.id);
    if (error) {
      toast.error("Could not remove that stock");
      return;
    }
    toast.success(`${target.symbol} removed`);
    void load();
  }

  /**
   * Pulls in whichever portfolio positions actually pay a dividend.
   *
   * Holdings were already entered on the portfolio screen, so re-typing the
   * same tickers here was pure duplication — and the two lists drifted apart
   * the moment one was updated without the other.
   */
  async function importFromPortfolio() {
    if (!user) return;
    setImporting(true);

    const { data: holdings, error } = await supabase
      .from("portfolio_holdings")
      .select("symbol, company_name, shares");

    if (error || !holdings || holdings.length === 0) {
      setImporting(false);
      toast.error(
        error ? "Could not read your portfolio" : "No portfolio positions to import yet",
      );
      return;
    }

    const already = new Set(dividends.map((d) => d.symbol));
    const candidates = holdings.filter((h) => !already.has(String(h.symbol).toUpperCase()));

    if (candidates.length === 0) {
      setImporting(false);
      toast.info("Every position is already tracked here");
      return;
    }

    let added = 0;
    let skipped = 0;

    for (const holding of candidates) {
      const { data: info } = await supabase.functions.invoke<DividendInfo>("get-dividend-info", {
        body: { symbol: holding.symbol },
      });

      if (!info?.paysDividend || info.dividendPerShare == null || info.frequency == null) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("user_dividends").insert({
        user_id: user.id,
        symbol: info.symbol,
        company: info.company ?? holding.company_name ?? info.symbol,
        shares: Number(holding.shares),
        dividend_per_share: info.dividendPerShare,
        frequency: info.frequency,
        yield_percentage: info.yieldPercentage,
        next_pay_date: info.nextPayDate,
      });

      if (insertError) skipped++;
      else added++;
    }

    setImporting(false);
    void load();

    if (added === 0) {
      toast.info("None of your positions pay a dividend");
    } else {
      toast.success(
        `Imported ${added} dividend payer${added === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} skipped` : ""),
      );
    }
  }

  const totals = useMemo(() => {
    const annual = dividends.reduce(
      (sum, d) => sum + d.shares * d.dividend_per_share * d.frequency,
      0,
    );
    return { annual, monthly: annual / 12 };
  }, [dividends]);

  /** The soonest payments, so the page says something about what happens next. */
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return dividends
      .filter((d) => d.next_pay_date && d.next_pay_date >= today)
      .sort((a, b) => (a.next_pay_date! < b.next_pay_date! ? -1 : 1))
      .slice(0, 3);
  }, [dividends]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>💰 Dividend Tracker</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>💰 Dividend Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <SignInPrompt
            title="Sign in to track dividends"
            description="Record your holdings and see the income they pay out."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Annual</div>
            <div className="text-2xl font-bold text-primary">{money(totals.annual)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Holdings</div>
            <div className="text-2xl font-bold">{dividends.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Monthly Est.</div>
            <div className="text-2xl font-bold text-accent">{money(totals.monthly)}</div>
          </CardContent>
        </Card>
      </div>

      {upcoming.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <CalendarDays className="h-4 w-4" />
              Next payments (estimated)
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {upcoming.map((d) => (
                <div key={d.id}>
                  <span className="font-medium">{d.symbol}</span>
                  <span className="text-muted-foreground"> · {payDate(d.next_pay_date!)} · </span>
                  <span className="text-primary font-medium">
                    {money(d.shares * d.dividend_per_share)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Your Dividend Stocks</CardTitle>
              <CardDescription>
                Payout, cadence and yield are looked up for you — just enter the ticker and how
                many shares you hold.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={importFromPortfolio} disabled={importing}>
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                From portfolio
              </Button>
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Add Stock
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {dividends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-2">No dividend stocks yet</p>
              <p className="text-sm">
                Add a ticker, or import the dividend payers already in your portfolio.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dividends.map((d) => (
                <div key={d.id} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <Badge variant="secondary" className="mb-1">
                        {d.symbol}
                      </Badge>
                      <div className="text-sm text-muted-foreground truncate">{d.company}</div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <div className="font-bold text-primary whitespace-nowrap">
                          {money(d.shares * d.dividend_per_share * d.frequency)} annual
                        </div>
                        {d.yield_percentage != null && (
                          <div className="text-sm text-muted-foreground">
                            {Number(d.yield_percentage).toFixed(2)}% yield
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(d)}
                          aria-label={`Edit ${d.symbol}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(d)}
                          aria-label={`Remove ${d.symbol}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Shares: </span>
                      <span className="font-medium">{d.shares.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Div/Share: </span>
                      <span className="font-medium">${Number(d.dividend_per_share).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Frequency: </span>
                      <span className="font-medium">{d.frequency}x/year</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Next: </span>
                      <span className="font-medium">
                        {d.next_pay_date ? payDate(d.next_pay_date) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.symbol}` : "Add dividend stock"}</DialogTitle>
            <DialogDescription>
              Enter the ticker and we will fetch the payout, how often it pays, and the current
              yield.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="div-symbol">Symbol</Label>
                <Input
                  id="div-symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  onBlur={(e) => void lookup(e.target.value)}
                  placeholder="KO"
                  autoCapitalize="characters"
                  maxLength={12}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="div-shares">Shares</Label>
                <Input
                  id="div-shares"
                  type="number"
                  step="any"
                  min="0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="100"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm min-h-5">
              {lookingUp ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Looking up dividend history…</span>
                </>
              ) : (
                lookupNote && <span className="text-muted-foreground">{lookupNote}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="div-company">Company</Label>
              <Input
                id="div-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="The Coca-Cola Company"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="div-per-share">Div/share</Label>
                <Input
                  id="div-per-share"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={perShare}
                  onChange={(e) => setPerShare(e.target.value)}
                  placeholder="0.53"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="div-frequency">Per year</Label>
                <Input
                  id="div-frequency"
                  type="number"
                  min="1"
                  max={MAX_FREQUENCY}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  placeholder="4"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="div-yield">Yield %</Label>
                <Input
                  id="div-yield"
                  type="number"
                  step="0.01"
                  min="0"
                  value={yieldPct}
                  onChange={(e) => setYieldPct(e.target.value)}
                  placeholder="2.36"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.symbol}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the entry from your dividend tracker. It does not affect your portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DividendTracker;
