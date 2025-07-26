import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import { imageArtifact } from '@/artifacts/image/client';
import { codeArtifact } from '@/artifacts/code/client';
import { sheetArtifact } from '@/artifacts/sheet/client';
import { textArtifact } from '@/artifacts/text/client';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';

/**
 * Registry of all available artifact types and their definitions.
 * Each artifact type defines how to render and interact with specific content types.
 */
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
];

/**
 * Union type of all possible artifact kinds
 */
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

/**
 * Interface for artifact UI state and metadata
 * @interface UIArtifact
 */
export interface UIArtifact {
  /** Display title of the artifact */
  title: string;
  /** Unique identifier for the document */
  documentId: string;
  /** Type of artifact (text, code, image, sheet) */
  kind: ArtifactKind;
  /** Current content of the artifact */
  content: string;
  /** Whether the artifact panel is currently visible */
  isVisible: boolean;
  /** Current status of the artifact */
  status: 'streaming' | 'idle';
  /** Bounding box for animation positioning */
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * Props for the Artifact component
 * @interface ArtifactProps
 */
interface ArtifactProps {
  /** Unique identifier for the chat session */
  chatId: string;
  /** Current input text value */
  input: string;
  /** Setter function for input text */
  setInput: Dispatch<SetStateAction<string>>;
  /** Current chat status */
  status: UseChatHelpers<ChatMessage>['status'];
  /** Function to stop the current chat request */
  stop: UseChatHelpers<ChatMessage>['stop'];
  /** Array of file attachments */
  attachments: Attachment[];
  /** Setter function for attachments */
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  /** Array of chat messages */
  messages: ChatMessage[];
  /** Setter function for messages */
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  /** Array of user votes on messages */
  votes: Array<Vote> | undefined;
  /** Function to send a new message */
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  /** Function to regenerate the last message */
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  /** Whether the chat is in read-only mode */
  isReadonly: boolean;
  /** Current visibility type setting */
  selectedVisibilityType: VisibilityType;
}

/**
 * Internal pure component for artifact functionality.
 * 
 * The Artifact component provides a full-screen overlay for viewing and editing
 * AI-generated artifacts like code, text documents, images, and spreadsheets.
 * 
 * Key features:
 * - Multi-type artifact support (text, code, images, sheets)
 * - Version history and comparison (edit/diff modes)
 * - Real-time content editing with auto-save
 * - Animated entrance/exit with bounding box positioning
 * - Mobile-responsive layout
 * - Integrated chat interface for artifact refinement
 * 
 * @component
 * @param {ArtifactProps} props - The component props
 * @returns {JSX.Element} The rendered artifact interface
 */
function PureArtifact({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  sendMessage,
  messages,
  setMessages,
  regenerate,
  votes,
  isReadonly,
  selectedVisibilityType,
}: ArtifactProps) {
  // Hook to manage artifact state and metadata
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  // Fetch document versions from the server
  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    artifact.documentId !== 'init' && artifact.status !== 'streaming'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  );

  // Local state for version management and editing
  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);

  // Check if sidebar is open for layout calculations
  const { open: isSidebarOpen } = useSidebar();

  // Update local state when documents are fetched
  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);
        // Update artifact content with the latest document version
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? '',
        }));
      }
    }
  }, [documents, setArtifact]);

  // Refetch documents when artifact status changes
  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  // SWR mutate function for optimistic updates
  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  /**
   * Handles content changes by saving to server and updating local cache.
   * Uses optimistic updates for immediate UI feedback.
   * 
   * @param updatedContent - The new content to save
   */
  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;

      // Optimistically update the SWR cache
      mutate<Array<Document>>(
        `/api/document?id=${artifact.documentId}`,
        async (currentDocuments) => {
          if (!currentDocuments) return undefined;

          const currentDocument = currentDocuments.at(-1);

          if (!currentDocument || !currentDocument.content) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          // Only save if content actually changed
          if (currentDocument.content !== updatedContent) {
            // Save to server
            await fetch(`/api/document?id=${artifact.documentId}`, {
              method: 'POST',
              body: JSON.stringify({
                title: artifact.title,
                content: updatedContent,
                kind: artifact.kind,
              }),
            });

            setIsContentDirty(false);

            // Create new document version for cache
            const newDocument = {
              ...currentDocument,
              content: updatedContent,
              createdAt: new Date(),
            };

            return [...currentDocuments, newDocument];
          }
          return currentDocuments;
        },
        { revalidate: false },
      );
    },
    [artifact, mutate],
  );

  // Debounced version of content change handler to reduce server requests
  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  /**
   * Saves content changes with optional debouncing.
   * Shows "saving" indicator while content is dirty.
   * 
   * @param updatedContent - The new content to save
   * @param debounce - Whether to debounce the save operation
   */
  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);

        if (debounce) {
          // Use debounced save for frequent changes (typing)
          debouncedHandleContentChange(updatedContent);
        } else {
          // Save immediately for explicit actions
          handleContentChange(updatedContent);
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  /**
   * Gets content of a document by its version index.
   * 
   * @param index - The version index to retrieve
   * @returns The document content or empty string if not found
   */
  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return documents[index].content ?? '';
  }

  /**
   * Handles version navigation and mode switching.
   * 
   * @param type - The type of version change to perform
   */
  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;

    if (type === 'latest') {
      // Jump to the most recent version and enable editing
      setCurrentVersionIndex(documents.length - 1);
      setMode('edit');
    }

    if (type === 'toggle') {
      // Switch between edit and diff view modes
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
    }

    if (type === 'prev') {
      // Navigate to previous version if available
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === 'next') {
      // Navigate to next version if available
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
        });
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata]);

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid="artifact"
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="relative w-[400px] bg-muted dark:bg-background h-dvh shrink-0"
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: 0,
                scale: 1,
                transition: { duration: 0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[400px] top-0 bg-zinc-900/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full justify-between items-center">
                <ArtifactMessages
                  chatId={chatId}
                  status={status}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  regenerate={regenerate}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                />

                <form className="flex flex-row gap-2 relative items-end w-full px-4 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    input={input}
                    setInput={setInput}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    sendMessage={sendMessage}
                    className="bg-background dark:bg-muted"
                    setMessages={setMessages}
                    selectedVisibilityType={selectedVisibilityType}
                  />
                </form>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
                : {
                    opacity: 1,
                    x: 400,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth
                      ? windowWidth - 400
                      : 'calc(100dvw-400px)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: 'spring',
                stiffness: 600,
                damping: 30,
              },
            }}
          >
            <div className="p-2 flex flex-row justify-between items-start">
              <div className="flex flex-row gap-4 items-start">
                <ArtifactCloseButton />

                <div className="flex flex-col">
                  <div className="font-medium">{artifact.title}</div>

                  {isContentDirty ? (
                    <div className="text-sm text-muted-foreground">
                      Saving changes...
                    </div>
                  ) : document ? (
                    <div className="text-sm text-muted-foreground">
                      {`Updated ${formatDistance(
                        new Date(document.createdAt),
                        new Date(),
                        {
                          addSuffix: true,
                        },
                      )}`}
                    </div>
                  ) : (
                    <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                  )}
                </div>
              </div>

              <ArtifactActions
                artifact={artifact}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              <artifactDefinition.content
                title={artifact.title}
                content={
                  isCurrentVersion
                    ? artifact.content
                    : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={artifact.status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={metadata}
                setMetadata={setMetadata}
              />

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    sendMessage={sendMessage}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Memoized artifact component that provides a full-screen interface for
 * viewing and editing AI-generated artifacts.
 * 
 * The Artifact component creates an immersive editing environment with:
 * - Multi-type artifact support (text, code, images, spreadsheets)
 * - Version history with diff/edit modes
 * - Real-time collaborative editing with auto-save
 * - Animated transitions and responsive design
 * - Integrated chat for artifact refinement
 * - Toolbar for artifact-specific actions
 * 
 * The component uses sophisticated animation and layout logic to provide
 * smooth transitions from the chat interface to the full-screen artifact view.
 * 
 * @example
 * ```tsx
 * <Artifact
 *   chatId="chat-123"
 *   input={currentInput}
 *   setInput={setInput}
 *   status="ready"
 *   stop={stopGeneration}
 *   attachments={files}
 *   setAttachments={setFiles}
 *   sendMessage={sendMessage}
 *   messages={messages}
 *   setMessages={setMessages}
 *   regenerate={regenerateResponse}
 *   votes={messageVotes}
 *   isReadonly={false}
 *   selectedVisibilityType="private"
 * />
 * ```
 */
export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  // Re-render if chat status changes
  if (prevProps.status !== nextProps.status) return false;
  // Re-render if votes data changes
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  // Re-render if input text changes
  if (prevProps.input !== nextProps.input) return false;
  // Re-render if messages array changes (note: comparing length for performance)
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;
  // Re-render if visibility type changes
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  // Skip re-render if none of the key props changed
  return true;
});
