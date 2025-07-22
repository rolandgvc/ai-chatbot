'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log critical error to monitoring service
    console.error('Critical application error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md p-6 text-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-destructive">
                  Critical Error
                </h1>
                <p className="text-muted-foreground">
                  A critical error has occurred. Please refresh the page to continue.
                </p>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <div className="text-left">
                  <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">
                      Error details
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">
                      {error.message}
                    </pre>
                  </details>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={reset}
                  className="w-full"
                >
                  Reset application
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Reload page
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </body>
    </html>
  );
}