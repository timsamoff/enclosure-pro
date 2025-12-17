import { useEffect, useRef } from "react";

interface UseKeyboardShortcutsProps {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleSave: () => void;
  handleSaveAs: () => void;
  handleLoad: () => void;
  handlePrint: () => void;
  handleExportPDF: () => void;
  handleQuit: () => void;
  handleNew: () => void;
  isEnclosureSelected: boolean;
}

export function useKeyboardShortcuts({
  handleZoomIn,
  handleZoomOut,
  handleSave,
  handleSaveAs,
  handleLoad,
  handlePrint,
  handleExportPDF,
  handleQuit,
  handleNew,
  isEnclosureSelected
}: UseKeyboardShortcutsProps) {
  // Store handlers in refs so they're always current
  const handlersRef = useRef({
    handleZoomIn,
    handleZoomOut,
    handleSave,
    handleSaveAs,
    handleLoad,
    handlePrint,
    handleExportPDF,
    handleQuit,
    handleNew,
  });

  // Update refs when handlers change
  useEffect(() => {
    handlersRef.current = {
      handleZoomIn,
      handleZoomOut,
      handleSave,
      handleSaveAs,
      handleLoad,
      handlePrint,
      handleExportPDF,
      handleQuit,
      handleNew,
    };
  }, [handleZoomIn, handleZoomOut, handleSave, handleSaveAs, handleLoad, handlePrint, handleExportPDF, handleQuit, handleNew]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      
      // Always allowed shortcuts (no enclosure needed)
      if (modifier && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handlersRef.current.handleNew();
        return;
      } else if (modifier && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handlersRef.current.handleLoad();
        return;
      } else if (modifier && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        handlersRef.current.handleQuit();
        return;
      } else if (!isMac && e.altKey && e.key === 'F4') {
        e.preventDefault();
        handlersRef.current.handleQuit();
        return;
      }

      // Enclosure-dependent shortcuts
      if (!isEnclosureSelected) {
        return; // Block all other shortcuts if no enclosure
      }

      // Zoom shortcuts (only when enclosure is selected)
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handlersRef.current.handleZoomOut();
      } else if (e.key === '=' || e.key === '+' || (e.code === 'Equal' && e.shiftKey)) {
        e.preventDefault();
        handlersRef.current.handleZoomIn();
      }
      // Ctrl/Cmd + S - Save / Save As
      else if (modifier && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handlersRef.current.handleSaveAs();
        } else {
          handlersRef.current.handleSave();
        }
      } 
      // Ctrl/Cmd + P - Print/Export PDF (CHANGED: Now calls handleExportPDF)
      else if (modifier && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlersRef.current.handleExportPDF(); // Changed from handlePrint
      } 
      // Ctrl/Cmd + E - Export PDF (still works)
      else if (modifier && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handlersRef.current.handleExportPDF();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnclosureSelected]);
}