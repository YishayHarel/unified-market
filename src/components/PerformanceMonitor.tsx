import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Activity, Bug, BarChart3, ChevronDown, Trash2 } from 'lucide-react';
import { getStoredErrors } from '@/hooks/useErrorTracking';
import { getAnalyticsData } from '@/hooks/useAnalytics';

const PerformanceMonitor = () => {
  const [errors, setErrors] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [perfData, setPerfData] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load stored data
    setErrors(getStoredErrors());
    setAnalytics(getAnalyticsData());

    // Get performance metrics
    if ('performance' in window && window.performance) {
      try {
        const wp = window.performance as any;
        let pageLoad = 0;
        let domReady = 0;
        let firstPaint = 0;

        try {
          // Try modern Navigation Timing API first
          if (wp.getEntriesByType) {
            const navEntries = wp.getEntriesByType('navigation') as any[];
            if (navEntries && navEntries.length > 0) {
              const nav = navEntries[0];
              if (nav) {
                pageLoad = Math.round((nav.loadEventEnd || 0) - (nav.startTime || 0));
                domReady = Math.round((nav.domContentLoadedEventEnd || 0) - (nav.startTime || 0));
              }
            }
          }
          
          // Fallback to legacy timing API
          if (pageLoad === 0 && wp.timing) {
            const t = wp.timing;
            if (t && t.navigationStart) {
              pageLoad = Math.round((t.loadEventEnd || 0) - (t.navigationStart || 0));
              domReady = Math.round((t.domContentLoadedEventEnd || 0) - (t.navigationStart || 0));
            }
          }
        } catch (navError) {
          console.log('Navigation timing not available:', navError);
        }

        try {
          // Get First Contentful Paint
          if (wp.getEntriesByType) {
            const paints = wp.getEntriesByType('paint') as any[];
            const fcp = paints?.find((e: any) => e?.name === 'first-contentful-paint');
            firstPaint = Math.round(fcp?.startTime || 0);
          }
        } catch (paintError) {
          console.log('Paint timing not available:', paintError);
        }

        setPerfData({ pageLoad, domReady, firstPaint });
      } catch (error) {
        console.log('Performance API not fully available:', error);
        setPerfData({ pageLoad: 0, domReady: 0, firstPaint: 0 });
      }
    } else {
      setPerfData({ pageLoad: 0, domReady: 0, firstPaint: 0 });
    }
  }, [isOpen]);

  const clearErrors = () => {
    localStorage.removeItem('app_errors');
    setErrors([]);
  };

  const clearAnalytics = () => {
    localStorage.removeItem('analytics_events');
    setAnalytics([]);
  };

  const getPerformanceStatus = (value: number, thresholds: [number, number]) => {
    if (value < thresholds[0]) return 'good';
    if (value < thresholds[1]) return 'fair';
    return 'poor';
  };

  // Only show in development or for debugging
  if (import.meta.env.PROD && !window.location.search.includes('debug=true')) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Activity className="h-4 w-4" />
            Debug Panel
            <ChevronDown className="h-4 w-4" />
            {errors.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {errors.length}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="w-96 max-h-96 overflow-y-auto mt-2">
          <div className="space-y-3">
            {/* Performance Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {perfData && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>Page Load:</span>
                      <Badge variant={getPerformanceStatus(perfData.pageLoad, [2000, 4000]) === 'good' ? 'default' : 'destructive'}>
                        {perfData.pageLoad}ms
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>DOM Ready:</span>
                      <Badge variant={getPerformanceStatus(perfData.domReady, [1000, 2000]) === 'good' ? 'default' : 'destructive'}>
                        {perfData.domReady}ms
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>First Paint:</span>
                      <Badge variant={getPerformanceStatus(perfData.firstPaint, [1000, 2000]) === 'good' ? 'default' : 'destructive'}>
                        {Math.round(perfData.firstPaint)}ms
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Error Tracking */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Errors ({errors.length})
                  </div>
                  {errors.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearErrors}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {errors.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No errors recorded</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-xs p-2 bg-destructive/10 rounded">
                        <div className="font-mono text-destructive">{error.message}</div>
                        <div className="text-muted-foreground">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analytics Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Analytics ({analytics.length})
                  </div>
                  {analytics.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAnalytics}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No events recorded</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {analytics.slice(0, 10).map((event, index) => (
                      <div key={index} className="text-xs flex justify-between">
                        <span className="truncate">
                          {event.type}: {event.data.action || event.data.feature || event.data.path}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default PerformanceMonitor;