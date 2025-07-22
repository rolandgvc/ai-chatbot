'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ChatErrorBoundaryProps {
  children: React.ReactNode;
  chatId?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function ChatErrorBoundary({ children, chatId, onError }: ChatErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Chat component error:', {
      chatId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    if (onError) {
      onError(error, errorInfo);
    }
  };

  const fallback = (error: Error, errorInfo: React.ErrorInfo, retry: () => void) => (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6 text-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-destructive">
              Chat Error
            </h2>
            <p className="text-muted-foreground">
              The chat component encountered an error and couldn&apos;t render properly. 
              This might be due to a network issue, data corruption, or a temporary server problem.
            </p>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="text-left">
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
                  Chat ID: {chatId || 'Unknown'}
                  {'\n'}
                  Error: {error.message}
                  {'\n'}
                  Component Stack: {errorInfo.componentStack}
                </pre>
              </details>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button onClick={retry} className="w-full">
              Retry chat
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { window.location.href = '/'; }}
              className="w-full"
            >
              Start new chat
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Reload page
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={fallback}
      isolate
    >
      {children}
    </ErrorBoundary>
  );
}