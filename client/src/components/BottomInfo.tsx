import { EnclosureType, ENCLOSURE_TYPES, MeasurementUnit } from "@/types/schema";
import { Box, Grid3x3, Package } from "lucide-react";
import { mmToFraction } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface BottomInfoProps {
  gridEnabled: boolean;
  gridSize: number;
  enclosureType: EnclosureType;
  unit: MeasurementUnit;
  onEnclosureClick: () => void;
  onGridClick: () => void;
  onComponentsClick: () => void;
  onUnitChange: (unit: MeasurementUnit) => void;
}

export default function BottomInfo({
  gridEnabled,
  gridSize,
  enclosureType,
  unit,
  onEnclosureClick,
  onGridClick,
  onComponentsClick,
  onUnitChange,
}: BottomInfoProps) {
  const enclosure = ENCLOSURE_TYPES[enclosureType];
  
  const formatDimension = (mm: number) => {
    if (unit === "metric") {
      return `${mm}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-2 bg-background/95 backdrop-blur-md border-t border-border z-50 pointer-events-none">
      {/* Left: Enclosure selector */}
      <div className="flex items-center gap-6 text-sm pointer-events-auto">
        <button
          onClick={onEnclosureClick}
          className="flex items-center gap-2 px-3 min-h-9 rounded-md hover-elevate active-elevate-2 border border-border w-32"
          data-testid="button-enclosure-select-bottom cursor-pointer"
        >
          <Box className="w-4 h-4" />
          <span>{enclosureType}</span>
        </button>
      </div>

      {/* Center: Unit toggle and Grid selector */}
      <div className="flex items-center gap-3 text-sm pointer-events-auto">
        <ToggleGroup 
          type="single" 
          value={unit}
          onValueChange={(value) => {
            if (value) onUnitChange(value as MeasurementUnit);
          }}
          data-testid="toggle-unit"
          className="rounded-full border border-border h-9 w-24"
        >
          <ToggleGroupItem 
            value="metric" 
            aria-label="Metric units"
            data-testid="toggle-unit-metric"
            className="px-4 h-9 text-xs rounded-l-full data-[state=on]:bg-[#ff8c42] data-[state=on]:text-white flex-1"
          >
            mm
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="imperial" 
            aria-label="Imperial units"
            data-testid="toggle-unit-imperial"
            className="px-4 h-9 text-xs rounded-r-full data-[state=on]:bg-[#ff8c42] data-[state=on]:text-white flex-1"
          >
            in
          </ToggleGroupItem>
        </ToggleGroup>
        <button
          onClick={onGridClick}
          className="flex items-center justify-center gap-2 px-3 min-h-9 rounded-md hover-elevate active-elevate-2 border border-border w-24"
          data-testid="button-grid-toggle cursor-pointer"
        >
          <Grid3x3 className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs truncate">{gridEnabled ? formatDimension(gridSize) : "Off"}</span>
        </button>
      </div>

      {/* Right: Components button */}
      <div className="flex items-center gap-3 text-sm pointer-events-auto">
        <button
          onClick={onComponentsClick}
          className="flex items-center gap-2 px-3 min-h-9 rounded-md hover-elevate active-elevate-2 border border-border w-32"
          data-testid="button-components-bottom cursor-pointer"
        >
          <Package className="w-4 h-4" />
          <span>Components</span>
        </button>
      </div>
    </div>
  );
}
