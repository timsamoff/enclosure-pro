import { useState } from "react";

interface UseConfirmDialogsProps {
  onNewConfirmSave: () => void;
  onNewConfirmDiscard: () => void;
  onQuitConfirmSave: () => void;
  onQuitConfirmDiscard: () => void;
  onOpenConfirmSave: () => void;
  onOpenConfirmDiscard: () => void;
  onOpenConfirmCancel: () => void;
}

export function useConfirmDialogs({
  onNewConfirmSave,
  onNewConfirmDiscard,
  onQuitConfirmSave,
  onQuitConfirmDiscard,
  onOpenConfirmSave,
  onOpenConfirmDiscard,
  onOpenConfirmCancel
}: UseConfirmDialogsProps) {
  const [showNewConfirmDialog, setShowNewConfirmDialog] = useState(false);
  const [showQuitConfirmDialog, setShowQuitConfirmDialog] = useState(false);
  const [showOpenConfirmDialog, setShowOpenConfirmDialog] = useState(false);

  const newConfirmDialog = {
    open: showNewConfirmDialog,
    onOpenChange: setShowNewConfirmDialog,
    title: "Unsaved Changes",
    description: "You have unsaved changes. Would you like to save before starting a new project?",
    onConfirm: () => {
      setShowNewConfirmDialog(false);
      onNewConfirmSave();
    },
    onDestructive: () => {
      setShowNewConfirmDialog(false);
      onNewConfirmDiscard();
    },
    testId: "dialog-new-confirm"
  };

  const quitConfirmDialog = {
    open: showQuitConfirmDialog,
    onOpenChange: setShowQuitConfirmDialog,
    title: "Unsaved Changes",
    description: "You have unsaved changes. Would you like to save before quitting?",
    onConfirm: () => {
      setShowQuitConfirmDialog(false);
      onQuitConfirmSave();
    },
    onDestructive: () => {
      setShowQuitConfirmDialog(false);
      onQuitConfirmDiscard();
    },
    testId: "dialog-quit-confirm"
  };

  const openConfirmDialog = {
    open: showOpenConfirmDialog,
    onOpenChange: (open: boolean) => {
      if (!open) {
        onOpenConfirmCancel();
      } else {
        setShowOpenConfirmDialog(open);
      }
    },
    title: "Unsaved Changes",
    description: "You have unsaved changes. What would you like to do before opening the new file?",
    onConfirm: () => {
      setShowOpenConfirmDialog(false);
      onOpenConfirmSave();
    },
    onDestructive: () => {
      setShowOpenConfirmDialog(false);
      onOpenConfirmDiscard();
    },
    onCancel: () => {
      setShowOpenConfirmDialog(false);
      onOpenConfirmCancel();
    },
    testId: "dialog-open-confirm"
  };

  return {
    showNewConfirmDialog,
    showQuitConfirmDialog,
    showOpenConfirmDialog,
    setShowNewConfirmDialog,
    setShowQuitConfirmDialog,
    setShowOpenConfirmDialog,
    newConfirmDialog,
    quitConfirmDialog,
    openConfirmDialog
  };
}