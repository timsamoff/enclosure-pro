import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { EnclosureType, ENCLOSURE_TYPES, MeasurementUnit } from "@/types/schema";
import { mmToFraction } from "@/lib/utils";

interface EnclosureSelectorProps {
  open: boolean;
  onClose: () => void;
  currentType: EnclosureType;
  onSelect: (type: EnclosureType) => void;
  unit: MeasurementUnit;
}

export default function EnclosureSelector({
  open,
  onClose,
  currentType,
  onSelect,
  unit,
}: EnclosureSelectorProps) {
  const formatDimension = (mm: number) => {
    if (unit === "metric") {
      return `${mm}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute left-4 top-20 w-80 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">Enclosures</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-enclosure-selector"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-3">
          {Object.entries(ENCLOSURE_TYPES).map(([type, dimensions]) => {
            const isSelected = type === currentType;
            return (
              <button
                key={type}
                onClick={() => {
                  onSelect(type as EnclosureType);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-4 border rounded-lg text-left transition-all hover-elevate active-elevate-2 ${
                  isSelected ? "border-primary bg-primary/5" : "border-border"
                }`}
                data-testid={`button-enclosure-${type}`}
              >
                <div>
                  <div className="font-semibold text-lg">{type}</div>
                  <div className="text-sm text-muted-foreground font-mono mt-1">
                    {formatDimension(dimensions.width)} × {formatDimension(dimensions.height)} × {formatDimension(dimensions.depth)}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
