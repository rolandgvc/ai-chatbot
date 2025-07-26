/**
 * Chat API Route Handler
 * 
 * This module provides the main chat API endpoints for the AI chatbot application.
 * It handles message processing, streaming responses, authentication, rate limiting,
 * and chat persistence.
 * 
 * @fileoverview Chat API route with streaming AI responses
 */

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
 * Maximum duration for the API route in seconds.
 * Prevents long-running requests from timing out.
 */
export const maxDuration = 60;

/**
 * Global stream context for resumable streams.
 * Allows interruption and resumption of streaming responses.
 */
let globalStreamContext: ResumableStreamContext | null = null;

/**
 * Gets or creates the global stream context for resumable streaming.
 * Uses Redis if available, otherwise logs a warning and continues without resumability.
 * 
 * @returns The stream context or null if Redis is not available
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
 * POST /api/chat - Main chat endpoint for processing user messages
 * 
 * This endpoint handles incoming chat messages and returns streaming AI responses.
 * It includes comprehensive validation, authentication, rate limiting, and error handling.
 * 
 * @example
 * ```typescript
 * // Request body structure
 * {
 *   id: "chat-123",
 *   message: {
 *     id: "msg-456", 
 *     role: "user",
 *     parts: [{ type: "text", text: "Hello!" }]
 *   },
 *   selectedChatModel: "gpt-4",
 *   selectedVisibilityType: "private"
 * }
 * ```
 * 
 * @param request - The incoming HTTP request
 * @returns Streaming response with AI-generated content or error response
 * 
 * @throws {ChatSDKError} 'bad_request:api' - Invalid request body format
 * @throws {ChatSDKError} 'unauthorized:chat' - User not authenticated
 * @throws {ChatSDKError} 'rate_limit:chat' - Daily message limit exceeded
 * @throws {ChatSDKError} 'forbidden:chat' - User doesn't own the chat
 */
export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  // Parse and validate request body
  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    // Extract validated request parameters
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

    // Authenticate the user
    const session = await auth();
    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    // Check rate limits based on user type
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    // Get or create the chat session
    const chat = await getChatById({ id });

    if (!chat) {
      // Create new chat with AI-generated title
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
      // Verify user owns the existing chat
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    // Load existing messages and append the new user message
    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    // Extract geolocation data for context-aware responses
    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Persist the user message to database
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

    // Create stream ID for resumable streaming
    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Create streaming response with AI model
    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        // Configure AI model with appropriate settings
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5), // Prevent excessive tool usage
          
          // Enable tools based on model type (reasoning model doesn't use tools)
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          
          // Apply smooth streaming for better UX
          experimental_transform: smoothStream({ chunking: 'word' }),
          
          // Configure available AI tools
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          
          // Enable telemetry in production
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        // Start consuming the stream
        result.consumeStream();

        // Merge AI response stream with data stream
        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true, // Include reasoning steps in response
          }),
        );
      },
      generateId: generateUUID,
      
      // Save AI response messages when stream completes
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
      
      // Handle streaming errors gracefully
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    // Set up resumable streaming if available
    const streamContext = getStreamContext();

    if (streamContext) {
      // Use resumable stream with Redis backing
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      // Fall back to regular streaming without resumability
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    // Handle known SDK errors
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * DELETE /api/chat - Delete a chat session and all associated messages
 * 
 * This endpoint allows users to permanently delete their chat sessions.
 * Includes authentication and authorization checks to ensure users can only
 * delete their own chats.
 * 
 * @example
 * ```
 * DELETE /api/chat?id=chat-123
 * ```
 * 
 * @param request - The incoming HTTP request with chat ID in search params
 * @returns JSON response with deleted chat data or error response
 * 
 * @throws {ChatSDKError} 'bad_request:api' - Missing chat ID parameter
 * @throws {ChatSDKError} 'unauthorized:chat' - User not authenticated
 * @throws {ChatSDKError} 'forbidden:chat' - User doesn't own the chat
 */
export async function DELETE(request: Request) {
  // Extract chat ID from URL parameters
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  // Authenticate the user
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  // Verify user owns the chat before deletion
  const chat = await getChatById({ id });
  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  // Perform the deletion
  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
