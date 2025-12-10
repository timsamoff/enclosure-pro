import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MeasurementUnit } from "@/types/schema";
import { mmToFraction } from "@/lib/utils";
import { useEffect } from "react";
import { useFocusManagement } from "@/hooks/useFocusManagement";

interface GridSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gridEnabled: boolean;
  onGridEnabledChange: (enabled: boolean) => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  unit: MeasurementUnit;
}

const GRID_SIZES = [1, 2.5, 5, 10];

export default function GridSelector({
  open,
  onOpenChange,
  gridEnabled,
  onGridEnabledChange,
  gridSize,
  onGridSizeChange,
  unit,
}: GridSelectorProps) {
  const { releaseFocus } = useFocusManagement();

  const formatGridSize = (mm: number) => {
    if (unit === "metric") {
      return `${mm}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  // Release focus when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.focus();
      }, 100);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      releaseFocus();
    }
  };

  const handleGridEnabledChange = (enabled: boolean) => {
    onGridEnabledChange(enabled);
    releaseFocus();
  };

  const handleGridSizeChange = (size: number) => {
    onGridSizeChange(size);
    releaseFocus();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" data-testid="dialog-grid-selector">
        <DialogHeader>
          <DialogTitle>Grid Settings</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="space-y-6 py-4 pr-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="grid-enabled">Enable Grid Snapping</Label>
              <Switch
                id="grid-enabled"
                checked={gridEnabled}
                onCheckedChange={handleGridEnabledChange}
                data-testid="switch-grid-enabled-dialog"
              />
            </div>

            {gridEnabled && (
              <div className="space-y-3">
                <Label>Grid Size</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GRID_SIZES.map((size) => {
                    const isSelected = gridSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => handleGridSizeChange(size)}
                        onMouseUp={releaseFocus}
                        className={`px-4 py-3 border rounded-lg text-left transition-all hover-elevate active-elevate-2 cursor-pointer ${
                          isSelected ? "border-primary bg-primary/5" : "border-border"
                        }`}
                        data-testid={`button-grid-size-${size}`}
                      >
                        <div className="font-semibold">{formatGridSize(size)}</div>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}