import { useState, useEffect, useRef, useCallback } from "react";

interface StockChartProps {
  symbol: string;
  period: string;
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

const StockChart = ({ symbol, period }: StockChartProps) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [dayStartPrice, setDayStartPrice] = useState<number>(175.43);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    
    const generateRealtimeData = (period: string) => {
      const now = new Date();
      const data: ChartData[] = [];
      let basePrice = 175.43;
      let points = 50;
      let intervalMinutes = 5; // 5-minute intervals for granular data
      
      switch (period) {
        case '1H':
          points = 12; // 12 points for 1 hour (5-min intervals)
          intervalMinutes = 5;
          break;
        case '1D':
          points = 78; // Trading day ~6.5 hours * 12 (5-min intervals)
          intervalMinutes = 5;
          break;
        case '1W':
          points = 35; // 5 trading days, hourly
          intervalMinutes = 60;
          break;
        case '1M':
          points = 22; // ~22 trading days
          intervalMinutes = 60 * 24; // Daily
          break;
        case '3M':
          points = 66; // ~66 trading days
          intervalMinutes = 60 * 24;
          break;
        case '1Y':
          points = 252; // Trading days in a year
          intervalMinutes = 60 * 24;
          break;
        case 'MAX':
          points = 1260; // 5 years of trading days
          intervalMinutes = 60 * 24;
          break;
      }

      // Generate more realistic stock movement
      const volatility = period === '1H' ? 0.3 : period === '1D' ? 0.8 : 1.2;
      
      for (let i = points; i >= 0; i--) {
        const time = new Date(now);
        time.setMinutes(time.getMinutes() - (i * intervalMinutes));

        // More sophisticated price movement
        const trend = Math.sin(i / 10) * 0.5; // Slight trending
        const randomWalk = (Math.random() - 0.5) * volatility;
        const dayOfWeekEffect = time.getDay() === 1 ? 0.2 : 0; // Monday effect
        
        basePrice += trend + randomWalk + dayOfWeekEffect;
        basePrice = Math.max(basePrice, 140);
        basePrice = Math.min(basePrice, 210);

        let formattedTime = '';
        let formattedDate = '';
        
        if (period === '1H') {
          formattedTime = time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
          });
          formattedDate = time.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
        } else if (period === '1D') {
          formattedTime = time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit' 
          });
          formattedDate = 'Today';
        } else if (period === '1W' || period === '1M') {
          formattedTime = time.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          formattedDate = time.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric' 
          });
        } else {
          formattedTime = time.toLocaleDateString('en-US', { 
            month: 'short', 
            year: '2-digit' 
          });
          formattedDate = time.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          });
        }

        data.push({
          time: time.toISOString(),
          price: parseFloat(basePrice.toFixed(2)),
          timestamp: time.getTime(),
          formattedTime,
          formattedDate
        });
      }

      return data;
    };

    const mockData = generateRealtimeData(period);
    setDayStartPrice(mockData[0]?.price || 175.43);
    
    setTimeout(() => {
      setChartData(mockData);
      setLoading(false);
    }, 150);
  }, [symbol, period]);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartData.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width - 80; // Account for padding
    const padding = 40;
    
    // Calculate which data point we're closest to
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
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  // Calculate chart dimensions and scaling
  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const priceRange = maxPrice - minPrice;
  const padding = 40;
  const chartWidth = 800;
  const chartHeight = 300;

  // Determine if stock is up or down based on hover or current price
  const currentPrice = hoverData?.price || chartData[chartData.length - 1]?.price || 0;
  const isUp = currentPrice >= dayStartPrice;
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
        <div className="text-2xl font-bold">
          ${currentPrice.toFixed(2)}
        </div>
        {hoverData && (
          <div className="text-sm text-muted-foreground">
            {hoverData.time} • {hoverData.date}
          </div>
        )}
        {!hoverData && (
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