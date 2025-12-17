import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFilename: string;
  onSave: (filename: string) => Promise<void>;
}

export default function SaveAsDialog({
  open,
  onOpenChange,
  currentFilename,
  onSave,
}: SaveAsDialogProps) {
  const [filename, setFilename] = useState(currentFilename);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFilename(currentFilename);
      setIsSaving(false);
    }
  }, [open, currentFilename]);

  const handleSave = async () => {
    if (filename.trim() && !isSaving) {
      setIsSaving(true);
      try {
        await onSave(filename.trim());
        // Close immediately on successful save
        onOpenChange(false);
      } catch (error) {
        // Don't close on error, allow retry
        console.error('Save failed:', error);
        // Reset saving state to allow retry
        setIsSaving(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        // Reset state when closing
        setIsSaving(false);
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" data-testid="dialog-save-as">
        <DialogHeader>
          <DialogTitle>Save Project As</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
              placeholder="Enter filename"
              disabled={isSaving}
              data-testid="input-filename"
            />
            <p className="text-xs text-muted-foreground">
              File will be saved with .enc extension
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            data-testid="button-cancel-save"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!filename.trim() || isSaving}
            data-testid="button-confirm-save"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}