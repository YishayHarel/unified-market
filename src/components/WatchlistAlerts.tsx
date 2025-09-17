import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  target_price?: number;
  message?: string;
  is_active: boolean;
  created_at: string;
}

const WatchlistAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    alert_type: 'price_above',
    target_price: '',
    message: ''
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('watchlist_alerts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch watchlist alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addAlert = async () => {
    if (!newAlert.symbol || (!newAlert.target_price && newAlert.alert_type.includes('price'))) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const alertData = {
        user_id: user?.id,
        symbol: newAlert.symbol.toUpperCase(),
        alert_type: newAlert.alert_type,
        target_price: newAlert.alert_type.includes('price') ? parseFloat(newAlert.target_price) : null,
        message: newAlert.message || null,
      };

      const { error } = await supabase
        .from('watchlist_alerts')
        .insert([alertData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Alert added successfully",
      });

      setNewAlert({ symbol: '', alert_type: 'price_above', target_price: '', message: '' });
      setShowAddForm(false);
      fetchAlerts();
    } catch (error) {
      console.error('Error adding alert:', error);
      toast({
        title: "Error",
        description: "Failed to add alert",
        variant: "destructive",
      });
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      const { error } = await supabase
        .from('watchlist_alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Alert deleted successfully",
      });

      fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast({
        title: "Error",
        description: "Failed to delete alert",
        variant: "destructive",
      });
    }
  };

  const toggleAlert = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('watchlist_alerts')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      fetchAlerts();
    } catch (error) {
      console.error('Error toggling alert:', error);
      toast({
        title: "Error",
        description: "Failed to update alert",
        variant: "destructive",
      });
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'price_above':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'price_below':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAlertTypeLabel = (alertType: string) => {
    switch (alertType) {
      case 'price_above':
        return 'Price Above';
      case 'price_below':
        return 'Price Below';
      case 'earnings':
        return 'Earnings Date';
      case 'dividend':
        return 'Dividend Date';
      default:
        return alertType;
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please sign in to view watchlist alerts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Watchlist Alerts
        </CardTitle>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          size="sm"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Alert
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="symbol">Stock Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="AAPL"
                    value={newAlert.symbol}
                    onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="alert-type">Alert Type</Label>
                  <Select
                    value={newAlert.alert_type}
                    onValueChange={(value) => setNewAlert({ ...newAlert, alert_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price_above">Price Above</SelectItem>
                      <SelectItem value="price_below">Price Below</SelectItem>
                      <SelectItem value="earnings">Earnings Date</SelectItem>
                      <SelectItem value="dividend">Dividend Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {newAlert.alert_type.includes('price') && (
                <div>
                  <Label htmlFor="target-price">Target Price</Label>
                  <Input
                    id="target-price"
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={newAlert.target_price}
                    onChange={(e) => setNewAlert({ ...newAlert, target_price: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="message">Message (Optional)</Label>
                <Input
                  id="message"
                  placeholder="Custom alert message"
                  value={newAlert.message}
                  onChange={(e) => setNewAlert({ ...newAlert, message: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button onClick={addAlert}>
                  Add Alert
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No alerts set up yet.</p>
            <p className="text-sm text-muted-foreground">Add your first alert to get notified about price movements.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className={`${!alert.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getAlertIcon(alert.alert_type)}
                      <div>
                        <div className="font-semibold">{alert.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          {getAlertTypeLabel(alert.alert_type)}
                          {alert.target_price && ` $${alert.target_price}`}
                        </div>
                        {alert.message && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {alert.message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAlert(alert.id, alert.is_active)}
                      >
                        {alert.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAlert(alert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WatchlistAlerts;