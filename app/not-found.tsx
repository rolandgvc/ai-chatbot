import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
            <h2 className="text-xl font-semibold">Page not found</h2>
            <p className="text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/">
                Go home
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/chat">
                Start a new chat
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}