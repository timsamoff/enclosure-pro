import { useEffect } from "react";
import { snapZoom } from "@/lib/zoom";

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '=' || e.key === '+' || (e.code === 'Equal' && e.shiftKey)) {
        e.preventDefault();
        handleZoomIn();
      }
      else if (modifier && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
      } else if (modifier && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleLoad();
      } else if (modifier && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (modifier && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportPDF();
      } else if (modifier && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        handleQuit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleSave, handleSaveAs, handleLoad, handlePrint, handleExportPDF, handleQuit]);
}