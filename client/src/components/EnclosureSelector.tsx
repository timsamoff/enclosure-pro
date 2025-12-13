import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X, ChevronRight } from "lucide-react";
import { EnclosureType, ENCLOSURE_TYPES, MeasurementUnit, EnclosureManufacturer, getEnclosureDisplayName } from "@/types/schema";
import { mmToFraction } from "@/lib/utils";
import { useFocusManagement } from "@/hooks/useFocusManagement";

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
  const { releaseFocus } = useFocusManagement();
  const [selectedManufacturer, setSelectedManufacturer] = useState<EnclosureManufacturer | null>(null);

  const formatDimension = (mm: number) => {
    if (unit === "metric") {
      return `${mm}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  useEffect(() => {
    if (!open) {
      // Reset to top level when menu closes
      setSelectedManufacturer(null);
      return;
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedManufacturer) {
          setSelectedManufacturer(null);
        } else {
          onClose();
        }
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, selectedManufacturer, onClose]);

  useEffect(() => {
    return () => {
      releaseFocus();
    };
  }, [releaseFocus]);

  const handleClose = () => {
    onClose();
    releaseFocus();
  };

  const handleBackToManufacturers = () => {
    setSelectedManufacturer(null);
    releaseFocus();
  };

  const handleManufacturerSelect = (manufacturer: EnclosureManufacturer) => {
    setSelectedManufacturer(manufacturer);
    releaseFocus();
  };

  const handleEnclosureSelect = (type: EnclosureType) => {
    onSelect(type);
    onClose();
    releaseFocus();
  };

  if (!open) return null;

  // Safety check for ENCLOSURE_TYPES
  if (!ENCLOSURE_TYPES || typeof ENCLOSURE_TYPES !== 'object') {
    console.error('ENCLOSURE_TYPES is not available');
    return null;
  }

  // Group enclosures by manufacturer (exclude legacy entries)
  const enclosuresByManufacturer: Record<EnclosureManufacturer, EnclosureType[]> = {
    "Hammond": [],
    "CNC Pro": [],
    "GØRVA design": [],
    "Tayda": []
  };

  try {
    Object.entries(ENCLOSURE_TYPES).forEach(([key, value]) => {
      // Safety check
      if (!value || !value.manufacturer) {
        console.warn('Invalid enclosure entry:', key, value);
        return;
      }
      
      // Only include prefixed versions (exclude legacy names)
      if (key.includes('-')) {
        const manufacturer = value.manufacturer;
        
        // Safety check: make sure the manufacturer exists in our object
        if (enclosuresByManufacturer[manufacturer]) {
          enclosuresByManufacturer[manufacturer].push(key as EnclosureType);
        } else {
          console.warn('Unknown manufacturer:', manufacturer, 'for enclosure:', key);
        }
      }
    });
  } catch (error) {
    console.error('Error grouping enclosures:', error);
  }

  const manufacturers: EnclosureManufacturer[] = ["Hammond", "CNC Pro", "GØRVA design", "Tayda"];

  return (
    <div className="absolute left-4 top-20 w-80 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {selectedManufacturer && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleBackToManufacturers}
              onMouseUp={releaseFocus}
              className="w-6 h-6"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
          )}
          <h3 className="font-semibold">
            {selectedManufacturer || "Enclosures"}
          </h3>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleClose}
          onMouseUp={releaseFocus}
          data-testid="button-close-enclosure-selector"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-3">
          {!selectedManufacturer ? (
            // Show manufacturer list
            manufacturers.map((manufacturer) => {
              const count = enclosuresByManufacturer[manufacturer]?.length || 0;
              return (
                <button
                  key={manufacturer}
                  onClick={() => handleManufacturerSelect(manufacturer)}
                  onMouseUp={releaseFocus}
                  className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
                  data-testid={`button-manufacturer-${manufacturer}`}
                >
                  <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                    {manufacturer}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              );
            })
          ) : (
            // Show enclosure list for selected manufacturer
            <div className="space-y-3">
              {enclosuresByManufacturer[selectedManufacturer]?.map((type) => {
              const dimensions = ENCLOSURE_TYPES[type];
              if (!dimensions) return null; // Safety check
              
              // Check if this enclosure is selected (handle both legacy and prefixed names)
              const isSelected = type === currentType || 
                                 (currentType && !currentType.includes('-') && type === `Hammond-${currentType}`);
              const displayName = getEnclosureDisplayName(type);
              return (
                <button
                  key={type}
                  onClick={() => handleEnclosureSelect(type)}
                  onMouseUp={releaseFocus}
                  className={`w-full flex items-center justify-between p-4 border rounded-lg text-left transition-all hover-elevate active-elevate-2 ${
                    isSelected ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`button-enclosure-${type}`}
                >
                  <div>
                    <div className="font-semibold text-lg">{displayName}</div>
                    <div className="text-sm text-muted-foreground font-mono mt-1">
                      {formatDimension(dimensions.width)} × {formatDimension(dimensions.height)} × {formatDimension(dimensions.depth)}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            }) || <div className="text-sm text-muted-foreground p-4 text-center">No enclosures found</div>}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}