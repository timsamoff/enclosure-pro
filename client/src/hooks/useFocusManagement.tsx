import { useCallback } from 'react';

/**
 * Hook to manage focus and prevent UI elements from trapping keyboard events
 */
export function useFocusManagement() {
  const releaseFocus = useCallback(() => {
    // Use setTimeout to ensure this runs after the click event
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      
      // Blur any focused element (not just buttons)
      if (activeElement && activeElement !== document.body) {
        activeElement.blur();
      }
      
      // Ensure window has focus for keyboard shortcuts
      window.focus();
    }, 50);
  }, []);

  const preventFocusTrap = useCallback((e: React.KeyboardEvent) => {
    // Prevent Enter key from keeping focus trapped
    if (e.key === 'Enter') {
      releaseFocus();
    }
    
    // Allow Escape to blur the element
    if (e.key === 'Escape') {
      const target = e.target as HTMLElement;
      if (target) {
        target.blur();
        window.focus();
      }
    }
  }, [releaseFocus]);

  return { releaseFocus, preventFocusTrap };
}