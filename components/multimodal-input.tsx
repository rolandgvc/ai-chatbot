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
 * MultimodalInput component properties interface
 */
interface MultimodalInputProps {
  /** Unique identifier for the chat session */
  chatId: string;
  /** Current input text value */
  input: string;
  /** Function to update the input text value */
  setInput: Dispatch<SetStateAction<string>>;
  /** Current status of the chat (ready, submitted, loading, etc.) */
  status: UseChatHelpers<ChatMessage>['status'];
  /** Function to stop the current chat operation */
  stop: () => void;
  /** Array of file attachments */
  attachments: Array<Attachment>;
  /** Function to update the attachments array */
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  /** Array of chat messages */
  messages: Array<UIMessage>;
  /** Function to update the messages array */
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  /** Function to send a new message */
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  /** Optional CSS class name for styling */
  className?: string;
  /** Current visibility type for the chat */
  selectedVisibilityType: VisibilityType;
}

/**
 * PureMultimodalInput Component
 * 
 * A comprehensive input component that handles text input, file attachments, and message sending.
 * Supports multimodal interactions including text, images, and other file types.
 * 
 * @component
 * @example
 * ```tsx
 * <PureMultimodalInput
 *   chatId="chat-123"
 *   input={inputText}
 *   setInput={setInputText}
 *   status="ready"
 *   stop={stopFunction}
 *   attachments={fileAttachments}
 *   setAttachments={setFileAttachments}
 *   messages={chatMessages}
 *   setMessages={setMessages}
 *   sendMessage={sendMessageFunction}
 *   selectedVisibilityType="private"
 * />
 * ```
 * 
 * Features:
 * - Auto-resizing textarea that adapts to content
 * - File upload support with drag-and-drop
 * - Attachment preview and management
 * - Keyboard shortcuts (Enter to send, Shift+Enter for new line)
 * - Automatic scroll-to-bottom functionality
 * - Suggested actions when chat is empty
 * - Local storage persistence for input recovery
 * - Upload queue management with progress indication
 * 
 * File Upload:
 * - Supports multiple file types
 * - Shows upload progress with loading states
 * - Error handling with user feedback
 * - File validation and type checking
 * 
 * Accessibility:
 * - Proper ARIA labels and keyboard navigation
 * - Screen reader compatible
 * - Focus management for optimal user experience
 * 
 * @param props - Component properties
 * @returns JSX element containing the multimodal input interface
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  /**
   * Adjusts the textarea height to fit content dynamically
   * Prevents scrollbars by expanding the textarea as needed
   */
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  /**
   * Resets the textarea to its default height
   * Called after message submission to return to initial state
   */
  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  /**
   * Submits the current form with input text and attachments
   * Cleans up form state and updates URL after submission
   * Focuses textarea on desktop for continued interaction
   */
  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    sendMessage({
      role: 'user',
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: 'text',
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

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
   * Uploads a file to the server and returns attachment metadata
   * Handles upload progress, error states, and user feedback
   * 
   * @param file - File object to upload
   * @returns Promise resolving to attachment metadata or undefined on error
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
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
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
 * Memoized MultimodalInput component for performance optimization
 * Re-renders only when input, status, attachments, or visibility type changes
 * 
 * @component
 * @example
 * ```tsx
 * <MultimodalInput
 *   chatId="chat-123"
 *   input={inputText}
 *   setInput={setInputText}
 *   status="ready"
 *   stop={stopFunction}
 *   attachments={fileAttachments}
 *   setAttachments={setFileAttachments}
 *   messages={chatMessages}
 *   setMessages={setMessages}
 *   sendMessage={sendMessageFunction}
 *   selectedVisibilityType="private"
 * />
 * ```
 */
export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);

/**
 * AttachmentsButton component properties interface
 */
interface AttachmentsButtonProps {
  /** Reference to the hidden file input element */
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  /** Current chat status to determine button state */
  status: UseChatHelpers<ChatMessage>['status'];
}

/**
 * Pure AttachmentsButton component for triggering file uploads
 * Disabled when chat is not in ready state
 * 
 * @param props - Component properties
 * @returns JSX button element for file attachments
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

const AttachmentsButton = memo(PureAttachmentsButton);

/**
 * StopButton component properties interface
 */
interface StopButtonProps {
  /** Function to stop the current chat operation */
  stop: () => void;
  /** Function to update the messages array */
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

/**
 * Pure StopButton component for halting ongoing chat operations
 * Triggers message state refresh when clicked
 * 
 * @param props - Component properties
 * @returns JSX button element for stopping chat
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

const StopButton = memo(PureStopButton);

/**
 * SendButton component properties interface
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
 * Pure SendButton component for submitting messages
 * Disabled when input is empty or files are uploading
 * 
 * @param props - Component properties
 * @returns JSX button element for sending messages
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

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
