import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

const DividendTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dividends, setDividends] = useState<UserDividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    symbol: "",
    company: "",
    shares: "",
    dividend_per_share: "",
    frequency: "4",
    yield_percentage: "",
  });

  useEffect(() => {
    if (user) {
      fetchDividends();
    }
  }, [user]);

  const fetchDividends = async () => {
    try {
      const { data, error } = await supabase
        .from("user_dividends")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDividends(data || []);
    } catch (error) {
      console.error("Error fetching dividends:", error);
      toast({
        title: "Error",
        description: "Failed to load dividend data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      symbol: "",
      company: "",
      shares: "",
      dividend_per_share: "",
      frequency: "4",
      yield_percentage: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.symbol || !formData.company || !formData.shares || !formData.dividend_per_share) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const dividendData = {
        user_id: user!.id,
        symbol: formData.symbol.toUpperCase(),
        company: formData.company,
        shares: parseFloat(formData.shares),
        dividend_per_share: parseFloat(formData.dividend_per_share),
        frequency: parseInt(formData.frequency),
        yield_percentage: formData.yield_percentage ? parseFloat(formData.yield_percentage) : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("user_dividends")
          .update(dividendData)
          .eq("id", editingId);
        
        if (error) throw error;
        
        toast({
          title: "Updated",
          description: "Dividend stock updated successfully",
        });
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from("user_dividends")
          .insert(dividendData);
        
        if (error) throw error;
        
        toast({
          title: "Added",
          description: "New dividend stock added successfully",
        });
        setIsAddingNew(false);
      }

      resetForm();
      fetchDividends();
    } catch (error) {
      console.error("Error saving dividend:", error);
      toast({
        title: "Error",
        description: "Failed to save dividend data",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (dividend: UserDividend) => {
    setFormData({
      symbol: dividend.symbol,
      company: dividend.company,
      shares: dividend.shares.toString(),
      dividend_per_share: dividend.dividend_per_share.toString(),
      frequency: dividend.frequency.toString(),
      yield_percentage: dividend.yield_percentage?.toString() || "",
    });
    setEditingId(dividend.id);
  };

  const handleDelete = async (id: string, symbol: string) => {
    try {
      const { error } = await supabase
        .from("user_dividends")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: `${symbol} removed from dividend tracker`,
      });
      fetchDividends();
    } catch (error) {
      console.error("Error deleting dividend:", error);
      toast({
        title: "Error",
        description: "Failed to delete dividend",
        variant: "destructive",
      });
    }
  };

  const calculateTotals = () => {
    const totalAnnual = dividends.reduce((sum, div) => 
      sum + (div.shares * div.dividend_per_share * div.frequency), 0
    );
    const monthlyEstimate = totalAnnual / 12;
    
    return { totalAnnual, monthlyEstimate };
  };

  const { totalAnnual, monthlyEstimate } = calculateTotals();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>💰 Dividend Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Annual</div>
            <div className="text-2xl font-bold text-primary">
              ${totalAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
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
            <div className="text-2xl font-bold text-accent">
              ${monthlyEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Button */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Your Dividend Stocks</CardTitle>
          <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Stock
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Dividend Stock</DialogTitle>
                <DialogDescription>
                  Add a new dividend-paying stock to your portfolio
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="symbol">Symbol *</Label>
                    <Input
                      id="symbol"
                      value={formData.symbol}
                      onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                      placeholder="AAPL"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company *</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      placeholder="Apple Inc."
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shares">Shares *</Label>
                    <Input
                      id="shares"
                      type="number"
                      step="0.01"
                      value={formData.shares}
                      onChange={(e) => setFormData({...formData, shares: e.target.value})}
                      placeholder="100"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dividend_per_share">Dividend per Share *</Label>
                    <Input
                      id="dividend_per_share"
                      type="number"
                      step="0.01"
                      value={formData.dividend_per_share}
                      onChange={(e) => setFormData({...formData, dividend_per_share: e.target.value})}
                      placeholder="0.94"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="frequency">Frequency (per year)</Label>
                    <Input
                      id="frequency"
                      type="number"
                      value={formData.frequency}
                      onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                      placeholder="4"
                    />
                  </div>
                  <div>
                    <Label htmlFor="yield_percentage">Yield %</Label>
                    <Input
                      id="yield_percentage"
                      type="number"
                      step="0.01"
                      value={formData.yield_percentage}
                      onChange={(e) => setFormData({...formData, yield_percentage: e.target.value})}
                      placeholder="2.5"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddingNew(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Stock</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {dividends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-2">No dividend stocks yet</p>
              <p className="text-sm">Add your first dividend-paying stock to start tracking</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dividends.map((dividend) => (
                <div key={dividend.id} className="p-4 rounded-lg bg-muted/50 relative">
                  {editingId === dividend.id ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Symbol</Label>
                          <Input
                            value={formData.symbol}
                            onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>Company</Label>
                          <Input
                            value={formData.company}
                            onChange={(e) => setFormData({...formData, company: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Shares</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.shares}
                            onChange={(e) => setFormData({...formData, shares: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label>Dividend/Share</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.dividend_per_share}
                            onChange={(e) => setFormData({...formData, dividend_per_share: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm">
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          setEditingId(null);
                          resetForm();
                        }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="absolute top-3 right-3 flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(dividend)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(dividend.id, dividend.symbol)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3 pr-20">
                        <div>
                          <Badge variant="secondary" className="mb-1">
                            {dividend.symbol}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {dividend.company}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">
                            ${(dividend.shares * dividend.dividend_per_share * dividend.frequency).toFixed(0)} annual
                          </div>
                          {dividend.yield_percentage && (
                            <div className="text-sm text-muted-foreground">
                              {dividend.yield_percentage.toFixed(2)}% yield
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Shares: </span>
                          <span className="font-medium">{dividend.shares}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Div/Share: </span>
                          <span className="font-medium">${dividend.dividend_per_share.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Frequency: </span>
                          <span className="font-medium">{dividend.frequency}x/year</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DividendTracker;