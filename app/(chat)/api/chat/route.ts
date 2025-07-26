import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

/**
 * Maximum duration for API route execution in seconds
 * Set to 60 seconds to handle long-running AI inference operations
 */
export const maxDuration = 60;

/**
 * Global resumable stream context for handling interrupted streams
 * Allows clients to resume streaming from where they left off
 * Requires Redis connection for persistence across server instances
 */
let globalStreamContext: ResumableStreamContext | null = null;

/**
 * Gets or creates the global resumable stream context
 * Handles Redis connection errors gracefully by disabling resumable streams
 * 
 * @returns ResumableStreamContext instance or null if Redis unavailable
 * 
 * @example
 * ```typescript
 * const streamContext = getStreamContext();
 * if (streamContext) {
 *   // Use resumable streaming
 *   return streamContext.resumableStream(streamId, streamFactory);
 * } else {
 *   // Fall back to regular streaming
 *   return regularStream();
 * }
 * ```
 */
export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

/**
 * POST /api/chat - Main chat endpoint for AI conversations
 * 
 * Handles real-time AI chat interactions with support for:
 * - Message streaming with Server-Sent Events
 * - File attachments and multimodal inputs
 * - Tool usage (weather, document creation, suggestions)
 * - Rate limiting and user authentication
 * - Chat persistence and history management
 * - Resumable streams for interrupted connections
 * 
 * @param request - HTTP request containing chat message and configuration
 * @returns Streaming response with AI-generated messages
 * 
 * Request Body:
 * - id: Chat session identifier
 * - message: User message with optional file attachments
 * - selectedChatModel: AI model to use for generation
 * - selectedVisibilityType: Chat visibility (public/private)
 * 
 * Response:
 * - Server-Sent Events stream with AI responses
 * - Tool usage results and artifact generation
 * - Error messages with appropriate HTTP status codes
 * 
 * Rate Limiting:
 * - Enforces daily message limits based on user type
 * - Returns 429 status when limits exceeded
 * 
 * Authentication:
 * - Requires valid user session
 * - Returns 401 for unauthorized requests
 * - Returns 403 for forbidden chat access
 * 
 * Error Handling:
 * - Validates request schema with Zod
 * - Returns structured error responses using ChatSDKError
 * - Handles tool execution failures gracefully
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/chat', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     id: 'chat-123',
 *     message: {
 *       id: 'msg-456',
 *       role: 'user',
 *       parts: [{ type: 'text', text: 'Hello!' }]
 *     },
 *     selectedChatModel: 'gpt-4',
 *     selectedVisibilityType: 'private'
 *   })
 * });
 * ```
 */
export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
  }
}

/**
 * DELETE /api/chat - Delete a chat session and all its messages
 * 
 * Permanently removes a chat session and all associated data including:
 * - All messages in the conversation
 * - Chat metadata and settings
 * - Associated artifacts and documents
 * 
 * @param request - HTTP request with chat ID in query parameters
 * @returns JSON response with deleted chat data or error
 * 
 * Query Parameters:
 * - id: Chat session identifier to delete
 * 
 * Authentication:
 * - Requires valid user session
 * - User must own the chat to delete it
 * 
 * Authorization:
 * - Returns 401 for unauthorized requests
 * - Returns 403 if user doesn't own the chat
 * - Returns 400 if chat ID is missing
 * 
 * Response:
 * - 200: Chat successfully deleted with deleted chat data
 * - 400: Bad request (missing chat ID)
 * - 401: Unauthorized (no valid session)
 * - 403: Forbidden (user doesn't own chat)
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/chat?id=chat-123', {
 *   method: 'DELETE',
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * 
 * if (response.ok) {
 *   const deletedChat = await response.json();
 *   console.log('Chat deleted:', deletedChat);
 * }
 * ```
 * 
 * Security Considerations:
 * - Validates chat ownership before deletion
 * - Permanent deletion with no recovery option
 * - Cascades to delete all related data
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
