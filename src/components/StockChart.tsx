import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface StockChartProps {
  symbol: string;
  period: string;
}

interface ChartData {
  time: string;
  price: number;
  formattedTime: string;
}

const StockChart = ({ symbol, period }: StockChartProps) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // Generate mock data based on period
    const generateMockData = (period: string) => {
      const now = new Date();
      const data: ChartData[] = [];
      let basePrice = 175.43;
      let points = 50;
      let timeUnit = 'hour';
      
      switch (period) {
        case '1D':
          points = 24;
          timeUnit = 'hour';
          break;
        case '1W':
          points = 7;
          timeUnit = 'day';
          break;
        case '1M':
          points = 30;
          timeUnit = 'day';
          break;
        case '3M':
          points = 90;
          timeUnit = 'day';
          break;
        case '1Y':
          points = 365;
          timeUnit = 'day';
          break;
        case '5Y':
          points = 1825;
          timeUnit = 'day';
          break;
      }

      for (let i = points; i >= 0; i--) {
        const time = new Date(now);
        
        if (timeUnit === 'hour') {
          time.setHours(time.getHours() - i);
        } else {
          time.setDate(time.getDate() - i);
        }

        // Generate realistic price movement
        const randomChange = (Math.random() - 0.5) * 4; // ±2 price change
        basePrice += randomChange;
        basePrice = Math.max(basePrice, 150); // Minimum price
        basePrice = Math.min(basePrice, 200); // Maximum price

        let formattedTime = '';
        if (period === '1D') {
          formattedTime = time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
          });
        } else if (period === '1W') {
          formattedTime = time.toLocaleDateString('en-US', { 
            weekday: 'short' 
          });
        } else {
          formattedTime = time.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
        }

        data.push({
          time: time.toISOString(),
          price: parseFloat(basePrice.toFixed(2)),
          formattedTime
        });
      }

      return data;
    };

    const mockData = generateMockData(period);
    
    setTimeout(() => {
      setChartData(mockData);
      setLoading(false);
    }, 300);
  }, [symbol, period]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">{data.formattedTime}</p>
          <p className="font-semibold">
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  // Determine if stock is up or down overall
  const firstPrice = chartData[0]?.price || 0;
  const lastPrice = chartData[chartData.length - 1]?.price || 0;
  const isUp = lastPrice >= firstPrice;

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <XAxis 
            dataKey="formattedTime"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={['dataMin - 1', 'dataMax + 1']}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="price"
            stroke={isUp ? 'hsl(142 71% 60%)' : 'hsl(0 72% 60%)'}
            strokeWidth={2}
            dot={false}
            activeDot={{ 
              r: 4, 
              fill: isUp ? 'hsl(142 71% 60%)' : 'hsl(0 72% 60%)',
              stroke: 'hsl(var(--background))',
              strokeWidth: 2
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;