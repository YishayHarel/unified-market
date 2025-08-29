import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EarningsData {
  symbol: string;
  date: string;
  epsEstimate: number;
  epsActual?: number;
  hour: string;
  quarter: number;
  year: number;
}

const EarningsCalendar = () => {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData[]>([]);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        // Get earnings for the next 30 days
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setDate(today.getDate() + 30);

        const fromDate = today.toISOString().split('T')[0];
        const toDate = nextMonth.toISOString().split('T')[0];

        const { data, error } = await supabase.functions.invoke('get-earnings', {
          body: { 
            from: fromDate,
            to: toDate
          }
        });

        if (error) throw error;

        if (data?.earningsCalendar) {
          setEarnings(data.earningsCalendar.slice(0, 9)); // Show first 9 results
        }
      } catch (error) {
        console.error('Error fetching earnings:', error);
        // Keep loading state true to show loading message if API fails
      } finally {
        setLoading(false);
      }
    };

    fetchEarnings();
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>
        <p>Loading earnings...</p>
      </section>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (hour: string) => {
    switch (hour) {
      case 'bmo': return 'Before Market Open';
      case 'amc': return 'After Market Close';
      case 'dmh': return 'During Market Hours';
      default: return 'TBD';
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">🗓 Earnings Calendar</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {earnings.map((earning, index) => (
          <div key={`${earning.symbol}-${index}`} className="bg-card p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              {earning.symbol}
            </h3>
            <p className="text-sm mb-1">Date: {formatDate(earning.date)}</p>
            <p className="text-sm mb-1">EPS Estimate: ${earning.epsEstimate?.toFixed(2) || 'N/A'}</p>
            <p className="text-sm mb-1">Time: {formatTime(earning.hour)}</p>
            <p className="text-sm">Q{earning.quarter} {earning.year}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EarningsCalendar;