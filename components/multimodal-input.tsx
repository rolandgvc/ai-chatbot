'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { ArrowUpIcon, PaperclipIcon, StopIcon } from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SuggestedActions } from './suggested-actions';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';

/**
 * Props for the MultimodalInput component
 * @interface MultimodalInputProps
 */
interface MultimodalInputProps {
  /** Unique identifier for the chat session */
  chatId: string;
  /** Current input text value */
  input: string;
  /** Setter function for input text */
  setInput: Dispatch<SetStateAction<string>>;
  /** Current chat status (ready, submitted, etc.) */
  status: UseChatHelpers<ChatMessage>['status'];
  /** Function to stop the current chat request */
  stop: () => void;
  /** Array of file attachments */
  attachments: Array<Attachment>;
  /** Setter function for attachments */
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  /** Array of chat messages */
  messages: Array<UIMessage>;
  /** Setter function for messages */
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  /** Function to send a new message */
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  /** Optional CSS class name */
  className?: string;
  /** Current visibility type setting */
  selectedVisibilityType: VisibilityType;
}

/**
 * Internal pure component for multimodal input functionality.
 * 
 * This component handles:
 * - Text input with auto-resizing textarea
 * - File upload and attachment preview
 * - Message submission and validation
 * - Suggested actions when chat is empty
 * - Scroll-to-bottom functionality
 * - Input persistence using localStorage
 * 
 * @component
 * @param {MultimodalInputProps} props - The component props
 * @returns {JSX.Element} The rendered multimodal input interface
 */
function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
}: MultimodalInputProps) {
  // Ref for the textarea element to control height and focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  // Initialize textarea height on mount
  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  /**
   * Adjusts textarea height based on content to prevent scrollbars
   */
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  /**
   * Resets textarea to default height
   */
  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  // Persist input across browser sessions
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  // Restore input from localStorage on hydration, preferring DOM value
  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration correctly
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save input to localStorage whenever it changes
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  /**
   * Handles textarea input changes and adjusts height accordingly
   * @param event - The change event from the textarea
   */
  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  // File input handling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  /**
   * Submits the current form with text input and attachments.
   * Clears the form after submission and manages focus/history.
   */
  const submitForm = useCallback(() => {
    // Clean up URL parameters after submission
    window.history.replaceState({}, '', `/chat/${chatId}`);

    // Send message with both attachments and text
    sendMessage({
      role: 'user',
      parts: [
        // Convert attachments to message parts
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        // Add text content
        {
          type: 'text',
          text: input,
        },
      ],
    });

    // Reset form state
    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    // Refocus on desktop for better UX
    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  /**
   * Uploads a single file to the server and returns attachment metadata.
   * Shows appropriate error messages if upload fails.
   * 
   * @param file - The file to upload
   * @returns Promise resolving to attachment metadata or undefined if failed
   */
  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      // Show server-provided error message
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      // Generic error for network/parsing issues
      toast.error('Failed to upload file, please try again!');
    }
  };

  /**
   * Handles file selection from the file input.
   * Uploads multiple files concurrently and adds successful uploads to attachments.
   * Shows upload progress via upload queue state.
   * 
   * @param event - The file input change event
   */
  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      // Show upload progress for all selected files
      setUploadQueue(files.map((file) => file.name));

      try {
        // Upload all files concurrently
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        
        // Filter out failed uploads (undefined values)
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        // Add successful uploads to current attachments
        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        // Clear upload queue regardless of success/failure
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: '',
                name: filename,
                contentType: '',
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700',
          className,
        )}
        rows={2}
        autoFocus
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            if (status !== 'ready') {
              toast.error('Please wait for the model to finish its response!');
            } else {
              submitForm();
            }
          }
        }}
      />

      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start">
        <AttachmentsButton fileInputRef={fileInputRef} status={status} />
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
        {status === 'submitted' ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Memoized multimodal input component that handles text input, file uploads,
 * and message submission for the chat interface.
 * 
 * Features:
 * - Auto-resizing textarea with input persistence
 * - Drag & drop file upload with progress indication
 * - Suggested actions for new conversations
 * - Keyboard shortcuts (Enter to submit, Shift+Enter for new line)
 * - Scroll-to-bottom functionality
 * - Input validation and error handling
 * 
 * The component is optimized with React.memo to prevent unnecessary re-renders
 * by comparing key props that affect the input behavior.
 * 
 * @example
 * ```tsx
 * <MultimodalInput
 *   chatId="chat-123"
 *   input={inputText}
 *   setInput={setInputText}
 *   status="ready"
 *   stop={stopGeneration}
 *   attachments={files}
 *   setAttachments={setFiles}
 *   messages={chatMessages}
 *   setMessages={updateMessages}
 *   sendMessage={handleSendMessage}
 *   selectedVisibilityType="private"
 * />
 * ```
 */
export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    // Re-render if input text changes
    if (prevProps.input !== nextProps.input) return false;
    // Re-render if chat status changes (ready, submitted, etc.)
    if (prevProps.status !== nextProps.status) return false;
    // Re-render if attachments array changes
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    // Re-render if visibility type changes
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    // Skip re-render if none of the key props changed
    return true;
  },
);

/**
 * Props for the AttachmentsButton component
 */
interface AttachmentsButtonProps {
  /** Reference to the file input element */
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  /** Current chat status to determine if button should be enabled */
  status: UseChatHelpers<ChatMessage>['status'];
}

/**
 * Button component that triggers the file picker for uploading attachments.
 * Disabled when chat is not in ready state.
 * 
 * @param props - The component props
 * @returns JSX element for the attachments button
 */
function PureAttachmentsButton({
  fileInputRef,
  status,
}: AttachmentsButtonProps) {
  return (
    <Button
      data-testid="attachments-button"
      className="rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready'}
      variant="ghost"
    >
      <PaperclipIcon size={14} />
    </Button>
  );
}

/**
 * Memoized attachments button component
 */
const AttachmentsButton = memo(PureAttachmentsButton);

/**
 * Props for the StopButton component
 */
interface StopButtonProps {
  /** Function to stop the current chat request */
  stop: () => void;
  /** Function to update the messages array */
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

/**
 * Button component that stops the current AI response generation.
 * Visible only when a message is being generated.
 * 
 * @param props - The component props
 * @returns JSX element for the stop button
 */
function PureStopButton({
  stop,
  setMessages,
}: StopButtonProps) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

/**
 * Memoized stop button component
 */
const StopButton = memo(PureStopButton);

/**
 * Props for the SendButton component
 */
interface SendButtonProps {
  /** Function to submit the current form */
  submitForm: () => void;
  /** Current input text */
  input: string;
  /** Array of files currently being uploaded */
  uploadQueue: Array<string>;
}

/**
 * Button component that submits the current message.
 * Disabled when input is empty or files are still uploading.
 * 
 * @param props - The component props
 * @returns JSX element for the send button
 */
function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: SendButtonProps) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

/**
 * Memoized send button component with optimized re-rendering.
 * Only re-renders when upload queue length or input text changes.
 */
const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  // Re-render if upload queue length changes
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  // Re-render if input text changes (affects button disabled state)
  if (prevProps.input !== nextProps.input) return false;
  // Skip re-render if neither key prop changed
  return true;
});
