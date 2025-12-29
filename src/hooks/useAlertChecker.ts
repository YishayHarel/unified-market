import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TriggeredAlert {
  id: string;
  symbol: string;
  message: string;
  alert_type: string;
}

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds

export const useAlertChecker = () => {
  const { user } = useAuth();
  const { sendNotification, isEnabled: notificationsEnabled } = usePushNotifications();
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(0);

  const checkAlerts = useCallback(async () => {
    if (!user) return;

    // Prevent checking too frequently
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_INTERVAL_MS - 1000) {
      return;
    }
    lastCheckRef.current = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('check-alerts', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        console.error('Error checking alerts:', response.error);
        return;
      }

      const { triggered } = response.data as { triggered: TriggeredAlert[] };

      if (triggered && triggered.length > 0) {
        // Show notifications for each triggered alert
        for (const alert of triggered) {
          // Show browser notification if enabled
          if (notificationsEnabled) {
            sendNotification(`🔔 ${alert.symbol} Alert`, {
              body: alert.message,
              tag: alert.id, // Prevent duplicate notifications
              requireInteraction: true,
            });
          }

          // Also show in-app toast
          toast({
            title: `${alert.symbol} Alert Triggered`,
            description: alert.message,
            duration: 8000,
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
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      checkAlerts();
    }, 5000);

    // Set up interval for regular checks
    intervalRef.current = setInterval(checkAlerts, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, checkAlerts]);

  return { checkAlerts };
};
