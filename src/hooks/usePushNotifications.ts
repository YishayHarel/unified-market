import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PushNotificationState {
  isSupported: boolean;
  isEnabled: boolean;
  permission: NotificationPermission | 'default';
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isEnabled: false,
    permission: 'default',
  });
  const { toast } = useToast();

  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
      isEnabled: isSupported && Notification.permission === 'granted',
    }));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const isEnabled = permission === 'granted';
      
      setState(prev => ({
        ...prev,
        permission,
        isEnabled,
      }));

      if (isEnabled) {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive push notifications for your alerts.',
        });
        
        // Store preference
        localStorage.setItem('push_notifications_enabled', 'true');
      } else if (permission === 'denied') {
        toast({
          title: 'Permission Denied',
          description: 'Please enable notifications in your browser settings.',
          variant: 'destructive',
        });
      }

      return isEnabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to request notification permission.',
        variant: 'destructive',
      });
      return false;
    }
  }, [state.isSupported, toast]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!state.isEnabled) {
      console.warn('Notifications not enabled');
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [state.isEnabled]);

  const disableNotifications = useCallback(() => {
    localStorage.setItem('push_notifications_enabled', 'false');
    setState(prev => ({
      ...prev,
      isEnabled: false,
    }));
    toast({
      title: 'Notifications Disabled',
      description: 'You will no longer receive push notifications.',
    });
  }, [toast]);

  return {
    ...state,
    requestPermission,
    sendNotification,
    disableNotifications,
  };
};
