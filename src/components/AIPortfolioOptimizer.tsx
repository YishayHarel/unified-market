import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Brain, TrendingUp, AlertTriangle, Target, PieChart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Holding {
  id: string;
  symbol: string;
  company_name?: string;
  shares: number;
  avg_cost: number;
  current_price?: number;
  sector?: string;
}

interface Recommendation {
  type: string;
  symbol: string;
  action: string;
  reason: string;
}

interface OptimizationResult {
  portfolioAnalysis: any[];
  totalValue: string;
  optimization: {
    diversificationScore: number;
    riskScore: number;
    recommendations: Recommendation[];
    sectorAnalysis: Record<string, number>;
    targetAllocations: Record<string, number>;
    summary: string;
  };
}

const AIPortfolioOptimizer = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [preferences, setPreferences] = useState({
    risk_tolerance: 'moderate',
    max_position_size: 10,
    rebalance_threshold: 5
  });
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [newHolding, setNewHolding] = useState({
    symbol: '',
    company_name: '',
    shares: '',
    avg_cost: '',
    current_price: '',
    sector: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchHoldings();
      fetchPreferences();
    }
  }, [user]);

  const fetchHoldings = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_holdings')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;
      setHoldings(data || []);
    } catch (error) {
      console.error('Error fetching holdings:', error);
    }
  };

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setPreferences({
          risk_tolerance: data.risk_tolerance || 'moderate',
          max_position_size: data.max_position_size || 10,
          rebalance_threshold: data.rebalance_threshold || 5
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const addHolding = async () => {
    if (!newHolding.symbol || !newHolding.shares || !newHolding.avg_cost) {
      toast({
        title: "Error",
        description: "Please fill in required fields (symbol, shares, avg cost)",
        variant: "destructive",
      });
      return;
    }

    try {
      const holdingData = {
        user_id: user?.id,
        symbol: newHolding.symbol.toUpperCase(),
        company_name: newHolding.company_name || null,
        shares: parseFloat(newHolding.shares),
        avg_cost: parseFloat(newHolding.avg_cost),
        current_price: newHolding.current_price ? parseFloat(newHolding.current_price) : null,
        sector: newHolding.sector || null,
      };

      const { error } = await supabase
        .from('portfolio_holdings')
        .upsert([holdingData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Holding added successfully",
      });

      setNewHolding({
        symbol: '',
        company_name: '',
        shares: '',
        avg_cost: '',
        current_price: '',
        sector: ''
      });
      setShowAddHolding(false);
      fetchHoldings();
    } catch (error) {
      console.error('Error adding holding:', error);
      toast({
        title: "Error",
        description: "Failed to add holding",
        variant: "destructive",
      });
    }
  };

  const optimizePortfolio = async () => {
    if (holdings.length === 0) {
      toast({
        title: "Error",
        description: "Please add some portfolio holdings first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-portfolio-optimizer', {
        body: {}
      });

      if (error) throw error;
      setOptimization(data);
      
      toast({
        title: "Success",
        description: "Portfolio optimization complete",
      });
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to optimize portfolio",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async () => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert([{
          user_id: user?.id,
          risk_tolerance: preferences.risk_tolerance,
          max_position_size: preferences.max_position_size,
          rebalance_threshold: preferences.rebalance_threshold
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Preferences updated successfully",
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'reduce':
      case 'sell':
        return 'destructive';
      case 'increase':
        return 'default';
      case 'rebalance':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please sign in to use the AI Portfolio Optimizer.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Portfolio Optimizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Risk Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investment Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
                  <Select
                    value={preferences.risk_tolerance}
                    onValueChange={(value) => setPreferences({ ...preferences, risk_tolerance: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max-position">Max Position Size (%)</Label>
                  <Input
                    id="max-position"
                    type="number"
                    value={preferences.max_position_size}
                    onChange={(e) => setPreferences({ ...preferences, max_position_size: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="rebalance-threshold">Rebalance Threshold (%)</Label>
                  <Input
                    id="rebalance-threshold"
                    type="number"
                    value={preferences.rebalance_threshold}
                    onChange={(e) => setPreferences({ ...preferences, rebalance_threshold: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={updatePreferences} variant="outline">
                Save Preferences
              </Button>
            </CardContent>
          </Card>

          {/* Portfolio Holdings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Portfolio Holdings</CardTitle>
              <Button
                onClick={() => setShowAddHolding(!showAddHolding)}
                variant="outline"
                size="sm"
              >
                Add Holding
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddHolding && (
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="symbol">Symbol</Label>
                        <Input
                          id="symbol"
                          placeholder="AAPL"
                          value={newHolding.symbol}
                          onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="company">Company Name</Label>
                        <Input
                          id="company"
                          placeholder="Apple Inc."
                          value={newHolding.company_name}
                          onChange={(e) => setNewHolding({ ...newHolding, company_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="shares">Shares</Label>
                        <Input
                          id="shares"
                          type="number"
                          step="0.001"
                          value={newHolding.shares}
                          onChange={(e) => setNewHolding({ ...newHolding, shares: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="avg-cost">Avg Cost</Label>
                        <Input
                          id="avg-cost"
                          type="number"
                          step="0.01"
                          value={newHolding.avg_cost}
                          onChange={(e) => setNewHolding({ ...newHolding, avg_cost: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="current-price">Current Price</Label>
                        <Input
                          id="current-price"
                          type="number"
                          step="0.01"
                          value={newHolding.current_price}
                          onChange={(e) => setNewHolding({ ...newHolding, current_price: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="sector">Sector</Label>
                        <Input
                          id="sector"
                          placeholder="Technology"
                          value={newHolding.sector}
                          onChange={(e) => setNewHolding({ ...newHolding, sector: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddHolding(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addHolding}>
                        Add Holding
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {holdings.length === 0 ? (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No portfolio holdings yet.</p>
                  <p className="text-sm text-muted-foreground">Add your first holding to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {holdings.map((holding) => (
                    <Card key={holding.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{holding.symbol}</div>
                            <div className="text-sm text-muted-foreground">
                              {holding.company_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {holding.sector && `Sector: ${holding.sector}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{holding.shares} shares</div>
                            <div className="text-sm text-muted-foreground">
                              Avg: ${holding.avg_cost.toFixed(2)}
                            </div>
                            {holding.current_price && (
                              <div className="text-sm text-muted-foreground">
                                Current: ${holding.current_price.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {holdings.length > 0 && (
                <Button
                  onClick={optimizePortfolio}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Brain className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing Portfolio...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Optimize Portfolio with AI
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Optimization Results */}
          {optimization && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Optimization Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scores */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-muted-foreground">Diversification</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {optimization.optimization.diversificationScore}/10
                      </div>
                      <Progress value={optimization.optimization.diversificationScore * 10} className="mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-muted-foreground">Risk Score</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {optimization.optimization.riskScore}/10
                      </div>
                      <Progress value={optimization.optimization.riskScore * 10} className="mt-2" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-muted-foreground">Total Value</div>
                      <div className="text-2xl font-bold text-green-600">
                        ${optimization.totalValue}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">AI Analysis Summary</h3>
                    <p className="text-sm text-muted-foreground">
                      {optimization.optimization.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Recommendations</h3>
                    <div className="space-y-3">
                      {optimization.optimization.recommendations.map((rec, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getRecommendationColor(rec.type)}>
                                    {rec.type.toUpperCase()}
                                  </Badge>
                                  <span className="font-semibold">{rec.symbol}</span>
                                </div>
                                <div className="text-sm font-medium">{rec.action}</div>
                                <div className="text-sm text-muted-foreground">{rec.reason}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AIPortfolioOptimizer;