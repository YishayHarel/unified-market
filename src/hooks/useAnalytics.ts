import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface AnalyticsEvent {
  type: 'page_view' | 'user_action' | 'feature_usage';
  data: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

class SimpleAnalytics {
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  track(type: AnalyticsEvent['type'], data: Record<string, any>) {
    const event: AnalyticsEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    // Store locally for now (could be sent to analytics service later)
    try {
      const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      events.unshift(event);
      // Keep only last 100 events
      localStorage.setItem('analytics_events', JSON.stringify(events.slice(0, 100)));
      
      if (import.meta.env.DEV) {
        console.log('Analytics event:', event);
      }
    } catch (e) {
      console.warn('Failed to store analytics event:', e);
    }
  }

  pageView(path: string, title?: string) {
    this.track('page_view', {
      path,
      title: title || document.title,
      referrer: document.referrer,
    });
  }

  userAction(action: string, details?: Record<string, any>) {
    this.track('user_action', {
      action,
      ...details,
    });
  }

  featureUsage(feature: string, details?: Record<string, any>) {
    this.track('feature_usage', {
      feature,
      ...details,
    });
  }
}

export const analytics = new SimpleAnalytics();

export const useAnalytics = () => {
  const location = useLocation();

  // Track page views
  useEffect(() => {
    analytics.pageView(location.pathname);
  }, [location.pathname]);

  return analytics;
};

// Helper function to get stored analytics
export const getAnalyticsData = (): AnalyticsEvent[] => {
  try {
    return JSON.parse(localStorage.getItem('analytics_events') || '[]');
  } catch (e) {
    console.warn('Failed to retrieve analytics data:', e);
    return [];
  }
};
