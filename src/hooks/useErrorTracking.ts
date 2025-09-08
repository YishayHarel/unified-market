import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ErrorInfo {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  timestamp: string;
  userAgent: string;
}

export const useErrorTracking = () => {
  const { toast } = useToast();

  const logError = (error: Error, errorInfo?: any) => {
    const errorData: ErrorInfo = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error tracked:', errorData);
    }

    // Store in localStorage for debugging (last 10 errors)
    try {
      const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      storedErrors.unshift(errorData);
      localStorage.setItem('app_errors', JSON.stringify(storedErrors.slice(0, 10)));
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e);
    }

    // Show user-friendly error message
    toast({
      title: "Something went wrong",
      description: "We've logged the error and will look into it.",
      variant: "destructive",
    });
  };

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError(new Error(`Unhandled Promise Rejection: ${event.reason}`));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return { logError };
};

// Helper function to get stored errors
export const getStoredErrors = (): ErrorInfo[] => {
  try {
    return JSON.parse(localStorage.getItem('app_errors') || '[]');
  } catch (e) {
    console.warn('Failed to retrieve stored errors:', e);
    return [];
  }
};