import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockChartProps {
  symbol: string;
  period: string;
  currentPrice?: number;
  dayChange?: number;
}

interface ChartData {
  time: string;
  price: number;
  timestamp: number;
  formattedTime: string;
  formattedDate: string;
}

interface HoverData {
  price: number;
  time: string;
  date: string;
  x: number;
}

const StockChart = ({ symbol, period, currentPrice = 0, dayChange = 0 }: StockChartProps) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [dayStartPrice, setDayStartPrice] = useState<number>(currentPrice);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-stock-candles', {
        body: { symbol: symbol.toUpperCase(), period }
      });
      
      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch chart data');
      }
      
      if (!data?.candles || data.candles.length === 0) {
        setError('No chart data available for this period');
        setChartData([]);
        return;
      }
      
      // Transform candle data to chart format
      const candles = data.candles;
      const transformedData: ChartData[] = candles.map((candle: any) => {
        const date = new Date(candle.timestamp);
        
        let formattedTime = '';
        let formattedDate = '';
        
        if (period === '1H' || period === '1D') {
          formattedTime = date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            timeZone: 'America/New_York'
          });
          formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/New_York'
          });
        } else if (period === '1W' || period === '1M') {
          formattedTime = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          formattedDate = date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric' 
          });
        } else {
          formattedTime = date.toLocaleDateString('en-US', { 
            month: 'short', 
            year: '2-digit' 
          });
          formattedDate = date.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          });
        }
        
        return {
          time: date.toISOString(),
          price: candle.close,
          timestamp: candle.timestamp,
          formattedTime,
          formattedDate
        };
      });
      
      setChartData(transformedData);
      
      // Set day start price from first candle
      if (transformedData.length > 0) {
        setDayStartPrice(transformedData[0].price);
      }
    } catch (err: any) {
      console.error('Error fetching chart data:', err);
      setError(err.message || 'Failed to load chart data');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartData.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width - 80;
    const padding = 40;
    
    const dataIndex = Math.round(((x - padding) / width) * (chartData.length - 1));
    const clampedIndex = Math.max(0, Math.min(dataIndex, chartData.length - 1));
    
    const dataPoint = chartData[clampedIndex];
    if (dataPoint) {
      setHoverData({
        price: dataPoint.price,
        time: dataPoint.formattedTime,
        date: dataPoint.formattedDate,
        x: padding + (clampedIndex / (chartData.length - 1)) * width
      });
      setIsHovering(true);
    }
  }, [chartData]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setHoverData(null);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
      </div>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <div className="text-muted-foreground text-center">
          <p className="font-medium">{error || 'No chart data available'}</p>
          <p className="text-sm">Chart data could not be loaded for {symbol}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCandles}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Calculate chart dimensions and scaling
  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const priceRange = maxPrice - minPrice || 1;
  const padding = 40;
  const chartWidth = 800;
  const chartHeight = 300;

  // Determine if stock is up or down
  const displayPrice = hoverData?.price || chartData[chartData.length - 1]?.price || 0;
  const isUp = displayPrice >= dayStartPrice;
  const strokeColor = isUp ? 'hsl(142 71% 60%)' : 'hsl(0 72% 60%)';

  // Create SVG path
  const pathData = chartData.map((point, index) => {
    const x = padding + (index / (chartData.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((point.price - minPrice) / priceRange) * (chartHeight - padding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div ref={containerRef} className="h-full w-full relative">
      {/* Price Display */}
      <div className="absolute top-0 left-0 z-10 mb-4">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">
            ${displayPrice.toFixed(2)}
          </div>
        </div>
        {hoverData && (
          <div className="text-sm text-muted-foreground">
            {hoverData.time} • {hoverData.date}
          </div>
        )}
        {!hoverData && chartData.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Latest • {chartData[chartData.length - 1]?.formattedDate}
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Dotted Reference Line at Day Start Price */}
        <line
          x1={padding}
          y1={chartHeight - padding - ((dayStartPrice - minPrice) / priceRange) * (chartHeight - padding * 2)}
          x2={chartWidth - padding}
          y2={chartHeight - padding - ((dayStartPrice - minPrice) / priceRange) * (chartHeight - padding * 2)}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.5"
        />

        {/* Chart Line */}
        <path
          d={pathData}
          stroke={strokeColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-colors duration-200"
        />

        {/* Hover Elements */}
        {isHovering && hoverData && (
          <>
            {/* Vertical Line */}
            <line
              x1={hoverData.x}
              y1={padding}
              x2={hoverData.x}
              y2={chartHeight - padding}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.6"
            />
            
            {/* Hover Dot */}
            <circle
              cx={hoverData.x}
              cy={chartHeight - padding - ((hoverData.price - minPrice) / priceRange) * (chartHeight - padding * 2)}
              r="4"
              fill={strokeColor}
              stroke="hsl(var(--background))"
              strokeWidth="2"
            />
          </>
        )}

        {/* X-axis (minimal) */}
        <line
          x1={padding}
          y1={chartHeight - padding}
          x2={chartWidth - padding}
          y2={chartHeight - padding}
          stroke="hsl(var(--border))"
          strokeWidth="1"
          opacity="0.3"
        />
      </svg>

      {/* Period Labels (minimal) */}
      <div className="absolute bottom-2 left-10 right-10 flex justify-between text-xs text-muted-foreground">
        <span>{chartData[0]?.formattedTime}</span>
        <span>{chartData[chartData.length - 1]?.formattedTime}</span>
      </div>
    </div>
  );
};

export default StockChart;
