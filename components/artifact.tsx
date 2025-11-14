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
 * Available artifact type definitions
 * Extensible system supporting text, code, image, and spreadsheet artifacts
 */
export const artifactDefinitions = [
  textArtifact,
  codeArtifact,
  imageArtifact,
  sheetArtifact,
];

/**
 * Union type of all supported artifact kinds
 */
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind'];

/**
 * Core artifact interface defining structure and state
 */
export interface UIArtifact {
  /** Display title for the artifact */
  title: string;
  /** Unique document identifier for persistence */
  documentId: string;
  /** Type of artifact (text, code, image, sheet) */
  kind: ArtifactKind;
  /** Current content of the artifact */
  content: string;
  /** Whether the artifact panel is currently visible */
  isVisible: boolean;
  /** Current processing status */
  status: 'streaming' | 'idle';
  /** Animation bounding box for smooth transitions */
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/**
 * Props for the Artifact component
 */
interface ArtifactProps {
  /** Unique identifier for the chat session */
  chatId: string;
  /** Current input text value */
  input: string;
  /** Function to update the input text */
  setInput: Dispatch<SetStateAction<string>>;
  /** Current chat status from useChat hook */
  status: UseChatHelpers<ChatMessage>['status'];
  /** Function to stop the current streaming response */
  stop: UseChatHelpers<ChatMessage>['stop'];
  /** Array of file attachments */
  attachments: Attachment[];
  /** Function to update attachments */
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  /** Current chat messages */
  messages: ChatMessage[];
  /** Function to update messages */
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  /** Vote data for messages */
  votes: Array<Vote> | undefined;
  /** Function to send a new message */
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  /** Function to regenerate the last AI message */
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  /** Whether the chat is in read-only mode */
  isReadonly: boolean;
  /** Current visibility type for the chat */
  selectedVisibilityType: VisibilityType;
}

/**
 * PureArtifact Component
 * 
 * A comprehensive artifact display and interaction system that provides:
 * - Full-screen overlay with animated transitions
 * - Version control and document history management
 * - Real-time content editing with auto-save
 * - Multi-format artifact support (text, code, images, sheets)
 * - Integrated chat interface for artifact-focused conversations
 * - Responsive design with mobile and desktop optimizations
 * 
 * Architecture:
 * - Uses plugin-based artifact system with extensible definitions
 * - Manages document persistence through /api/document endpoints
 * - Provides real-time collaboration features with debounced saves
 * - Integrates with chat system for contextual AI interactions
 * 
 * State Management:
 * - Artifact state managed through useArtifact hook
 * - Document versions fetched via SWR with automatic revalidation
 * - Content changes debounced and auto-saved to prevent data loss
 * - Version history with diff view and rollback capabilities
 * 
 * Animation System:
 * - Smooth transitions from message previews to full-screen
 * - Respects user's motion preferences and system settings
 * - Coordinated animations between chat and artifact panels
 * 
 * @param props - ArtifactProps
 * @returns JSX element with artifact interface
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
  // Core artifact state management
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  // Fetch document versions and history from the server
  const {
    data: documents,            // Array of document versions
    isLoading: isDocumentsFetching,  // Loading state for document fetch
    mutate: mutateDocuments,    // Function to revalidate document data
  } = useSWR<Array<Document>>(
    // Only fetch if artifact has a valid document ID and isn't streaming
    artifact.documentId !== 'init' && artifact.status !== 'streaming'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  );

  // Local state for version control and editing
  const [mode, setMode] = useState<'edit' | 'diff'>('edit');  // Edit or diff view mode
  const [document, setDocument] = useState<Document | null>(null);  // Current document
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);  // Selected version index

  // Get sidebar state for responsive layout calculations
  const { open: isSidebarOpen } = useSidebar();

  // Update local state when documents are fetched or updated
  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);  // Set to latest version
        // Sync artifact content with the most recent document
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? '',
        }));
      }
    }
  }, [documents, setArtifact]);

  // Revalidate documents when artifact status changes
  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  // SWR configuration for manual cache updates
  const { mutate } = useSWRConfig();
  const [isContentDirty, setIsContentDirty] = useState(false);

  /**
   * Handles content changes and persists them to the server
   * 
   * Content Save Process:
   * 1. Check if content actually changed
   * 2. POST updated content to /api/document endpoint
   * 3. Create new document version with updated content
   * 4. Update local cache without revalidation for performance
   * 5. Clear dirty state when save completes
   * 
   * @param updatedContent - New content to save
   */
  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!artifact) return;

      // Optimistically update cache and persist to server
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
            // Persist to server
            await fetch(`/api/document?id=${artifact.documentId}`, {
              method: 'POST',
              body: JSON.stringify({
                title: artifact.title,
                content: updatedContent,
                kind: artifact.kind,
              }),
            });

            setIsContentDirty(false);

            // Create new document version for version history
            const newDocument = {
              ...currentDocument,
              content: updatedContent,
              createdAt: new Date(),
            };

            return [...currentDocuments, newDocument];
          }
          return currentDocuments;
        },
        { revalidate: false },  // Don't revalidate to avoid overwriting optimistic update
      );
    },
    [artifact, mutate],
  );

  // Debounce content changes to avoid excessive API calls during typing
  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,  // 2 second delay
  );

  /**
   * Public interface for saving content changes
   * 
   * @param updatedContent - New content to save
   * @param debounce - Whether to debounce the save operation
   */
  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);  // Show "saving" indicator

        if (debounce) {
          debouncedHandleContentChange(updatedContent);  // Debounced for typing
        } else {
          handleContentChange(updatedContent);  // Immediate for explicit saves
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  /**
   * Retrieves document content by version index
   * Used for version history and diff comparisons
   * 
   * @param index - Version index to retrieve
   * @returns Document content or empty string if not found
   */
  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return documents[index].content ?? '';
  }

  /**
   * Handles version navigation and mode changes
   * 
   * Version Control Features:
   * - Navigate through document versions (next/prev)
   * - Toggle between edit and diff view modes
   * - Jump to latest version quickly
   * 
   * @param type - Type of version change to perform
   */
  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;

    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1);  // Go to most recent version
      setMode('edit');  // Switch to edit mode
    }

    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));  // Toggle view mode
    }

    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);  // Go to previous version
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);  // Go to next version
      }
    }
  };

  // Toolbar visibility state for artifact actions
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /**
   * Determines if the currently viewed version is the latest
   * Used to control editing capabilities and UI state
   * 
   * Note: If no documents exist or they're being fetched,
   * we consider it the current version to allow editing
   */
  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  // Get window dimensions for responsive layout
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  // Find the artifact definition for the current artifact type
  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  );

  // Fail fast if artifact type is not supported
  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!');
  }

  // Initialize artifact-specific functionality when document ID changes
  useEffect(() => {
    if (artifact.documentId !== 'init') {
      // Some artifact types require initialization (e.g., setting up editors)
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
          {/* Main artifact overlay container with smooth transitions */}
          {/* Background overlay - desktop only */}
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

          {/* Left chat panel - desktop only */}
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
              {/* Overlay when viewing historical versions */}
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

              {/* Chat interface within artifact view */}
              <div className="flex flex-col h-full justify-between items-center">
                {/* Message history display */}
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

                {/* Input form for continued conversation */}
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
              {/* Dynamic artifact content renderer based on artifact type */}
              <artifactDefinition.content
                title={artifact.title}
                content={
                  isCurrentVersion
                    ? artifact.content  // Show live content for current version
                    : getDocumentContentById(currentVersionIndex)  // Show historical content
                }
                mode={mode}  // Edit or diff view
                status={artifact.status}  // Streaming or idle
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}  // Future: AI-generated suggestions
                onSaveContent={saveContent}  // Callback for content changes
                isInline={false}  // Full-screen mode
                isCurrentVersion={isCurrentVersion}  // Controls edit capabilities
                getDocumentContentById={getDocumentContentById}  // Version history access
                isLoading={isDocumentsFetching && !artifact.content}  // Loading state
                metadata={metadata}  // Artifact-specific metadata
                setMetadata={setMetadata}  // Metadata update function
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
 * Memoized Artifact component with optimized re-render logic
 * 
 * Re-renders only when essential props change:
 * - Chat status changes (affects UI state)
 * - Vote data changes (affects message display)
 * - Input text changes (affects input synchronization)
 * - Message count changes (affects chat history)
 * - Visibility type changes (affects permissions)
 * 
 * This optimization is crucial for performance since the artifact component
 * is complex and expensive to re-render unnecessarily.
 */
export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  // Re-render if chat status changed
  if (prevProps.status !== nextProps.status) return false;
  // Re-render if vote data changed (deep comparison)
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  // Re-render if input text changed
  if (prevProps.input !== nextProps.input) return false;
  // Re-render if message count changed (intentionally comparing length, not full array)
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;
  // Re-render if visibility type changed
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  // Props are essentially equal, skip re-render
  return true;
});
