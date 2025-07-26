'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import type { Attachment, ChatMessage } from '@/lib/types';
import { useDataStream } from './data-stream-provider';

/**
 * Props for the Chat component
 * @interface ChatProps
 */
interface ChatProps {
  /** Unique identifier for the chat session */
  id: string;
  /** Initial messages to display in the chat */
  initialMessages: ChatMessage[];
  /** The AI model to use for chat responses */
  initialChatModel: string;
  /** Initial visibility type for the chat (public, private, etc.) */
  initialVisibilityType: VisibilityType;
  /** Whether the chat is in read-only mode */
  isReadonly: boolean;
  /** User session information */
  session: Session;
  /** Whether to automatically resume streaming if interrupted */
  autoResume: boolean;
}

/**
 * Main chat interface component that orchestrates the entire chat experience.
 * 
 * This component manages the core chat functionality including:
 * - Message display and interaction
 * - Real-time streaming of AI responses
 * - File attachments and multimodal input
 * - Artifact rendering and interaction
 * - Chat persistence and history
 * - Auto-resume functionality for interrupted streams
 * 
 * @example
 * ```tsx
 * <Chat
 *   id="chat-123"
 *   initialMessages={[]}
 *   initialChatModel="gpt-4"
 *   initialVisibilityType="private"
 *   isReadonly={false}
 *   session={userSession}
 *   autoResume={true}
 * />
 * ```
 * 
 * @component
 * @param {ChatProps} props - The chat component props
 * @returns {JSX.Element} The rendered chat interface
 */
export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: ChatProps) {
  // Hook to manage chat visibility state
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  // SWR configuration for cache management  
  const { mutate } = useSWRConfig();
  
  // Data stream provider for real-time updates
  const { setDataStream } = useDataStream();

  // Local state for user input
  const [input, setInput] = useState<string>('');

  // Main chat hook that handles message streaming and state management
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      // Update data stream with new chunks as they arrive
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      // Revalidate chat history cache when message completes
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      // Display user-friendly error messages
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  // Handle URL query parameters for direct message sending
  const searchParams = useSearchParams();
  const query = searchParams.get('query');
  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  // Auto-send message from URL query parameter once
  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: 'user' as const,
        parts: [{ type: 'text', text: query }],
      });

      setHasAppendedQuery(true);
      // Clean up URL after processing query
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  // Fetch voting data for message feedback (only when there are enough messages)
  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  // State for file attachments
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  
  // Check if artifact panel is currently visible
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Enable automatic resumption of interrupted streams
  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}
