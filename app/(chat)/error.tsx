'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ChatErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChatError({ error, reset }: ChatErrorProps) {
  useEffect(() => {
    // Log chat-specific error
    console.error('Chat error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      context: 'chat_route',
    });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-destructive">
              Chat Error
            </h1>
            <p className="text-muted-foreground">
              Something went wrong while loading the chat. This could be due to a network issue or server error.
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
              Retry chat
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { window.location.href = '/'; }}
              className="w-full"
            >
              New chat
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}