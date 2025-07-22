'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useParams } from 'next/navigation';

interface ChatIdErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChatIdError({ error, reset }: ChatIdErrorProps) {
  const params = useParams();

  useEffect(() => {
    // Log chat-specific error with ID context
    console.error('Chat ID error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      chatId: params.id,
      timestamp: new Date().toISOString(),
      context: 'chat_id_route',
    });
  }, [error, params.id]);

  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-destructive">
              Chat Loading Error
            </h1>
            <p className="text-muted-foreground">
              Failed to load the requested chat. The chat may not exist, you may not have access to it, or there was a server error.
            </p>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="text-left">
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
                  Chat ID: {params.id}
                  {'\n'}
                  Error: {error.message}
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
              onClick={() => { window.location.href = '/'; }}
              className="w-full"
            >
              Start new chat
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}