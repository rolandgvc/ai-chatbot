import useSWR from 'swr';
import { useRef, useEffect, useCallback } from 'react';

type ScrollFlag = ScrollBehavior | false;

export function useScrollToBottom(): {
  containerRef: React.RefObject<HTMLDivElement>;
  endRef: React.RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  scrollToBottom: (scrollBehavior?: ScrollBehavior) => void;
  onViewportEnter: () => void;
  onViewportLeave: () => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: isAtBottom = false, mutate: setIsAtBottom } = useSWR(
    'messages:is-at-bottom',
    null,
    { fallbackData: false },
  );

  const { data: scrollBehavior = false, mutate: setScrollBehavior } =
    useSWR<ScrollFlag>('messages:should-scroll', null, { fallbackData: false });

  useEffect(() => {
    if (scrollBehavior) {
      endRef.current?.scrollIntoView({ behavior: scrollBehavior });
      setScrollBehavior(false);
    }
  }, [setScrollBehavior, scrollBehavior]);

  const scrollToBottom = useCallback(
    (scrollBehavior: ScrollBehavior = 'smooth') => {
      setScrollBehavior(scrollBehavior);
    },
    [setScrollBehavior],
  );

  function onViewportEnter(): void {
    setIsAtBottom(true);
  }

  function onViewportLeave(): void {
    setIsAtBottom(false);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
