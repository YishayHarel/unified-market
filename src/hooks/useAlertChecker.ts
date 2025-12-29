import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SmartAlert {
  type: 'big_move' | 'stock_news' | 'market_news';
  symbol?: string;
  title: string;
  message: string;
  url?: string;
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export const useAlertChecker = () => {
  const { user } = useAuth();
  const { sendNotification, isEnabled: notificationsEnabled } = usePushNotifications();
  const { toast } = useToast();
  
  const intervalRef = useRef<number | null>(null);
  const lastCheckRef = useRef<number>(0);
  const notifiedAlertsRef = useRef<Set<string>>(new Set());

  const checkAlerts = useCallback(async () => {
    if (!user) return;

    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS - 5000) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      console.log('Checking smart alerts...');

      const response = await supabase.functions.invoke('smart-alerts', {
        body: { lastCheckTime: lastCheckRef.current },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      lastCheckRef.current = now;

      if (response.error) {
        console.error('Error checking alerts:', response.error);
        return;
      }

      const { alerts } = response.data as { alerts: SmartAlert[] };

      if (alerts && alerts.length > 0) {
        console.log(`Received ${alerts.length} alerts`);
        
        for (const alert of alerts) {
          const alertKey = `${alert.type}-${alert.symbol || 'market'}-${alert.message.slice(0, 30)}`;
          
          if (notifiedAlertsRef.current.has(alertKey)) {
            continue;
          }
          notifiedAlertsRef.current.add(alertKey);
          
          if (notifiedAlertsRef.current.size > 100) {
            const firstKey = notifiedAlertsRef.current.values().next().value;
            if (firstKey) notifiedAlertsRef.current.delete(firstKey);
          }

          if (notificationsEnabled) {
            sendNotification(alert.title, {
              body: alert.message,
              tag: alertKey,
              requireInteraction: alert.type === 'market_news',
            });
          }

          toast({
            title: alert.title,
            description: alert.message,
            duration: alert.type === 'market_news' ? 10000 : 6000,
          });
        }
      }
    } catch (error) {
      console.error('Alert check failed:', error);
    }
  }, [user, sendNotification, notificationsEnabled, toast]);

  useEffect(() => {
    if (!user) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      notifiedAlertsRef.current.clear();
      return;
    }

    const initialTimeout = window.setTimeout(() => {
      checkAlerts();
    }, 10000);

    intervalRef.current = window.setInterval(checkAlerts, CHECK_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimeout);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, checkAlerts]);

  return { checkAlerts };
};
