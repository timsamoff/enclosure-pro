import { ComponentType, COMPONENT_TYPES } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { mmToFraction } from "@/lib/utils";

interface ComponentPaletteProps {
  onComponentSelect: (type: ComponentType) => void;
  onClose: () => void;
  unit: "metric" | "imperial";
}

export default function ComponentPalette({
  onComponentSelect,
  onClose,
  unit,
}: ComponentPaletteProps) {
  const categories = {
    Potentiometers: [] as ComponentType[],
    Jacks: [] as ComponentType[],
    Switches: [] as ComponentType[],
    LEDs: [] as ComponentType[],
    Fixtures: [] as ComponentType[],
    Screws: [] as ComponentType[],
  };

  Object.entries(COMPONENT_TYPES).forEach(([key, value]) => {
    // Skip legacy components (kept for backward compatibility only)
    if (key === 'toggle-spdt' || key === 'potentiometer') return;
    const category = value.category as keyof typeof categories;
    categories[category].push(key as ComponentType);
  });

  const formatDrillSize = (type: ComponentType) => {
    const compData = COMPONENT_TYPES[type];
    if (unit === "metric") {
      return `${compData.drillSize.toFixed(1)}mm`;
    } else {
      return compData.imperialLabel;
    }
  };

  return (
    <div className="absolute right-4 top-20 w-80 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">Components</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-palette"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-4">
          {Object.entries(categories).map(([category, components]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {components.map((compType) => {
                  const comp = COMPONENT_TYPES[compType];
                  return (
                    <button
                      key={compType}
                      onClick={() => {
                        onComponentSelect(compType);
                        console.log(`Selected ${comp.name}`);
                      }}
                      className="w-full flex items-center justify-between gap-2 p-2 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left"
                      data-testid={`button-component-${compType}`}
                    >
                      <span className="text-sm font-medium">
                        {comp.name}
                      </span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {formatDrillSize(compType)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
