import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ChatNotFound() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
            <h2 className="text-xl font-semibold">Chat not found</h2>
            <p className="text-muted-foreground">
              The chat you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/">
                Start new chat
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                Browse recent chats
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}