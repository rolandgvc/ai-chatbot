'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AuthErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps) {
  useEffect(() => {
    // Log auth-specific error
    console.error('Authentication error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context: 'auth_route',
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-destructive">
              Authentication Error
            </h1>
            <p className="text-muted-foreground">
              Something went wrong during authentication. Please try signing in again.
            </p>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="text-left">
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
                  {error.message}
                </pre>
              </details>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button onClick={reset} className="w-full">
              Try again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { window.location.href = '/login'; }}
              className="w-full"
            >
              Go to login
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}