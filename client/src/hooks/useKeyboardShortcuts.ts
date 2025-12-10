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
}

export function useKeyboardShortcuts({
  handleZoomIn,
  handleZoomOut,
  handleSave,
  handleSaveAs,
  handleLoad,
  handlePrint,
  handleExportPDF,
  handleQuit
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
    };
  }, [handleZoomIn, handleZoomOut, handleSave, handleSaveAs, handleLoad, handlePrint, handleExportPDF, handleQuit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Zoom shortcuts (no modifier needed)
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
      // Ctrl/Cmd + O - Open
      else if (modifier && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        console.log('🎹 Keyboard shortcut: Ctrl+O triggered');
        handlersRef.current.handleLoad();
      } 
      // Ctrl/Cmd + P - Print
      else if (modifier && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlersRef.current.handlePrint();
      } 
      // Ctrl/Cmd + E - Export PDF
      else if (modifier && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handlersRef.current.handleExportPDF();
      } 
      // Ctrl/Cmd + Q - Quit (Mac only, Windows uses Alt+F4)
      else if (modifier && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        handlersRef.current.handleQuit();
      }
      // Alt+F4 - Quit (Windows/Linux)
      else if (!isMac && e.altKey && e.key === 'F4') {
        e.preventDefault();
        handlersRef.current.handleQuit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array - handlers accessed via ref
}