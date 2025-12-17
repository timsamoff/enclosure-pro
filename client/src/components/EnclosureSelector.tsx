import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, AlertTriangle } from "lucide-react";
import { 
  EnclosureType, 
  ENCLOSURE_TYPES,
  EnclosureManufacturer, 
  MANUFACTURERS,
  getEnclosureDisplayName,
  getEnclosureManufacturer,
  getAllEnclosuresGrouped,
  normalizeEnclosureType,
  is125BMigrationCase,
  getManufacturerBadge,
  getManufacturerBadgeColor,
  MeasurementUnit 
} from "@/types/schema";
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
  const [enclosuresByManufacturer, setEnclosuresByManufacturer] = useState<Record<EnclosureManufacturer, EnclosureType[]>>(
    {} as Record<EnclosureManufacturer, EnclosureType[]>
  );

  // Normalize current type for display
  const normalizedCurrentType = normalizeEnclosureType(currentType);
  const isLegacy125B = is125BMigrationCase(currentType || "");
  const currentBadge = getManufacturerBadge(currentType);
  const currentBadgeColor = getManufacturerBadgeColor(currentType);

  const formatDimension = (mm: number) => {
    if (unit === "metric") {
      return `${mm}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  // Initialize enclosures on component mount
  useEffect(() => {
    const grouped = getAllEnclosuresGrouped();
    setEnclosuresByManufacturer(grouped);
  }, []);

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

  const manufacturers = Object.keys(MANUFACTURERS) as EnclosureManufacturer[];

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
            {selectedManufacturer ? MANUFACTURERS[selectedManufacturer].displayName : "Enclosures"}
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

      {/* Legacy 125B warning with LEG badge */}
      {isLegacy125B && (
        <div className="mx-4 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-sm text-amber-800">
          <div 
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: currentBadgeColor }}
          >
            {currentBadge}
          </div>
          <div className="flex-1">
            <div className="font-medium">Legacy 125B enclosure detected</div>
            <div className="text-xs mt-1">
              Please select a manufacturer's 125B version from the list below
            </div>
          </div>
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="p-4 space-y-3">
          {!selectedManufacturer ? (
            // Show manufacturer list
            manufacturers.map((manufacturer) => {
              const count = enclosuresByManufacturer[manufacturer]?.length || 0;
              const manufacturerData = MANUFACTURERS[manufacturer];
              
              return (
                <button
                  key={manufacturer}
                  onClick={() => handleManufacturerSelect(manufacturer)}
                  onMouseUp={releaseFocus}
                  className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
                  data-testid={`button-manufacturer-${manufacturer}`}
                  style={{
                    borderLeftColor: manufacturerData.color,
                    borderLeftWidth: '4px'
                  }}
                >
                  <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                    {manufacturerData.displayName}
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
              {enclosuresByManufacturer[selectedManufacturer]?.length > 0 ? (
                enclosuresByManufacturer[selectedManufacturer].map((type) => {
                  const dimensions = ENCLOSURE_TYPES[type];
                  if (!dimensions) return null;
                  
                  const isSelected = type === normalizedCurrentType;
                  const displayName = getEnclosureDisplayName(type);
                  const manufacturer = getEnclosureManufacturer(type);
                  const manufacturerColor = manufacturer ? MANUFACTURERS[manufacturer]?.color : "#ff8c42";
                  const is125BOption = type.includes("125B");
                  const isRecommendedForLegacy = isLegacy125B && is125BOption;
                  
                  return (
                    <button
                      key={type}
                      onClick={() => handleEnclosureSelect(type)}
                      onMouseUp={releaseFocus}
                      className={`w-full flex items-center justify-between p-4 border rounded-lg text-left transition-all hover-elevate active-elevate-2 ${
                        isSelected ? "border-[#ff8c42] bg-[#ff8c42]/5" : "border-border"
                      } ${isRecommendedForLegacy ? "ring-1 ring-amber-300" : ""}`}
                      data-testid={`button-enclosure-${type}`}
                      style={{
                        borderLeftColor: manufacturerColor,
                        borderLeftWidth: '4px'
                      }}
                    >
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {displayName}
                          {isRecommendedForLegacy && (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              Update recommended
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground font-mono mt-1">
                          {formatDimension(dimensions.width)} × {formatDimension(dimensions.height)} × {formatDimension(dimensions.depth)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {dimensions.manufacturer}
                        </div>
                      </div>
                      {isSelected && (
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: manufacturerColor }}
                        />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No enclosures found for this manufacturer
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}