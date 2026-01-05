import { useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ErrorInfo {
  errorId: string;
  message: string;
  componentStack?: string;
  url: string;
  timestamp: string;
}

// Generate a short unique error ID for user reference
function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// Sanitize error messages to prevent information leakage
function sanitizeErrorMessage(message: string): string {
  // Remove file paths, line numbers, and other sensitive info
  return message
    .replace(/at\s+.*\(.*:\d+:\d+\)/g, '') // Remove stack trace lines
    .replace(/\/[^\s]+\.(ts|tsx|js|jsx)/g, '[file]') // Remove file paths
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]') // Remove IP addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]') // Remove emails
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/g, '[token]') // Remove JWT tokens
    .replace(/key[=:]\s*["']?[A-Za-z0-9-_]+["']?/gi, 'key=[redacted]') // Remove API keys
    .slice(0, 200) // Limit message length
    .trim();
}

export const useErrorTracking = () => {
  const { toast } = useToast();

  const logError = useCallback((error: Error, errorInfo?: any) => {
    const errorId = generateErrorId();
    
    const errorData: ErrorInfo = {
      errorId,
      message: sanitizeErrorMessage(error.message),
      componentStack: errorInfo?.componentStack 
        ? errorInfo.componentStack.split('\n').slice(0, 3).join('\n')
        : undefined,
      url: window.location.pathname, // Only log path, not full URL with params
      timestamp: new Date().toISOString(),
    };

    // Log sanitized error to console in development
    if (import.meta.env.DEV) {
      console.error('Error tracked:', errorData);
    }

    // Store in localStorage for debugging (last 5 errors, sanitized)
    try {
      const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      storedErrors.unshift(errorData);
      localStorage.setItem('app_errors', JSON.stringify(storedErrors.slice(0, 5)));
    } catch (e) {
      // Silently fail - localStorage might be full or disabled
    }

    // Show user-friendly error message with reference ID
    toast({
      title: "Something went wrong",
      description: `Please try again. Reference: ${errorId}`,
      variant: "destructive",
    });

    return errorId;
  }, [toast]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Prevent default browser error handling
      event.preventDefault();
      
      logError(new Error(sanitizeErrorMessage(event.message)), {
        filename: '[file]', // Don't log actual file paths
        lineno: 0,
        colno: 0,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Prevent default browser error handling  
      event.preventDefault();
      
      const message = event.reason instanceof Error 
        ? event.reason.message 
        : String(event.reason);
      logError(new Error(`Unhandled Promise Rejection: ${sanitizeErrorMessage(message)}`));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [logError]);

  return { logError };
};

// Helper function to get stored errors (sanitized)
export const getStoredErrors = (): ErrorInfo[] => {
  try {
    return JSON.parse(localStorage.getItem('app_errors') || '[]');
  } catch (e) {
    return [];
  }
};