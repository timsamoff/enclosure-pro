import { EnclosureType, ENCLOSURE_TYPES, MeasurementUnit, getManufacturerPrefix, getEnclosureDisplayName, getManufacturerBadgeColor } from "@/types/schema";
import { Box, Grid3x3, Package, CircleDot } from "lucide-react";
import { mmToFraction } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFocusManagement } from "@/hooks/useFocusManagement";

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
  const { releaseFocus } = useFocusManagement();
  const enclosure = ENCLOSURE_TYPES[enclosureType];
  
  const formatDimension = (mm: number) => {
    if (unit === "metric") {
      return `${mm}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  const handleClick = (callback: () => void) => {
    callback();
    releaseFocus();
  };

  const manufacturerPrefix = getManufacturerPrefix(enclosure.manufacturer);
  const displayName = getEnclosureDisplayName(enclosureType);
  const badgeColor = getManufacturerBadgeColor(enclosureType);

  return (
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-2 bg-background/95 backdrop-blur-md border-t border-border z-50 pointer-events-none">
      {/* Left: Enclosure selector - fixed width container */}
      <div className="flex-1 flex justify-start">
        <div className="flex items-center gap-6 text-sm pointer-events-auto">
          <button
            onClick={() => handleClick(onEnclosureClick)}
            onMouseUp={releaseFocus}
            className="flex items-center gap-2 px-3 min-h-9 rounded-md hover-elevate active-elevate-2 border border-border w-40 cursor-pointer"
            data-testid="button-enclosure-select-bottom"
          >
            <Box className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate text-center">{displayName}</span>
            <span 
              className="flex-shrink-0 px-2 py-0.5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white min-w-[2.5rem]"
              title={enclosure.manufacturer}
              style={{ backgroundColor: badgeColor }}
            >
              {manufacturerPrefix}
            </span>
          </button>
        </div>
      </div>

      {/* Center: Unit toggle and Grid selector - centered */}
      <div className="flex items-center gap-3 text-sm pointer-events-auto">
        <ToggleGroup 
          type="single" 
          value={unit}
          onValueChange={(value) => {
            if (value) {
              onUnitChange(value as MeasurementUnit);
              releaseFocus();
            }
          }}
          data-testid="toggle-unit"
          className="rounded-full border border-border h-9 w-24"
        >
          <ToggleGroupItem 
            value="metric" 
            aria-label="Metric units"
            data-testid="toggle-unit-metric"
            className="px-4 h-9 text-xs rounded-l-full data-[state=on]:bg-[#ff8c42] data-[state=on]:text-white flex-1"
            onMouseUp={releaseFocus}
          >
            mm
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="imperial" 
            aria-label="Imperial units"
            data-testid="toggle-unit-imperial"
            className="px-4 h-9 text-xs rounded-r-full data-[state=on]:bg-[#ff8c42] data-[state=on]:text-white flex-1"
            onMouseUp={releaseFocus}
          >
            in
          </ToggleGroupItem>
        </ToggleGroup>
        <button
          onClick={() => handleClick(onGridClick)}
          onMouseUp={releaseFocus}
          className="flex items-center justify-center gap-2 px-3 min-h-9 rounded-md hover-elevate active-elevate-2 border border-border w-24 cursor-pointer"
          data-testid="button-grid-toggle"
        >
          <Grid3x3 className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs truncate">{gridEnabled ? formatDimension(gridSize) : "Off"}</span>
        </button>
      </div>

      {/* Right: Components button - fixed width container */}
      <div className="flex-1 flex justify-end">
        <div className="flex items-center gap-3 text-sm pointer-events-auto">
          <button
            onClick={() => handleClick(onComponentsClick)}
            onMouseUp={releaseFocus}
            className="flex items-center gap-2 px-3 min-h-9 rounded-md hover-elevate active-elevate-2 border border-border w-40 cursor-pointer"
            data-testid="button-components-bottom"
          >
            <CircleDot className="w-4 h-4" />
            <span className="flex-1 text-center">Components</span>
          </button>
        </div>
      </div>
    </div>
  );
}