import { ComponentType, COMPONENT_TYPES } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronRight } from "lucide-react";
import { mmToFraction } from "@/lib/utils";
import { useState } from "react";

interface ComponentPaletteProps {
  onComponentSelect: (type: ComponentType) => void;
  onClose: () => void;
  unit: "metric" | "imperial";
}

type Category = keyof typeof categories;

export default function ComponentPalette({
  onComponentSelect,
  onClose,
  unit,
}: ComponentPaletteProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const categories = {
    Potentiometers: [] as ComponentType[],
    Jacks: [] as ComponentType[],
    Switches: [] as ComponentType[],
    LEDs: [] as ComponentType[],
    Fixtures: [] as ComponentType[],
    Screws: [] as ComponentType[],
    "Footprint Guides (not printed)": [] as ComponentType[],
  };

  Object.entries(COMPONENT_TYPES).forEach(([key, value]) => {
    // Skip legacy components (kept for backward compatibility only)
    if (key === 'toggle-spdt' || key === 'potentiometer') return;
    const category = value.category as keyof typeof categories;
    categories[category].push(key as ComponentType);
  });

  const formatDrillSize = (type: ComponentType) => {
    const compData = COMPONENT_TYPES[type];
    
    // Handle Footprint guides specially
    if (compData.category === "Footprint Guides (not printed)") {
      if (compData.shape === 'rectangle' || compData.shape === 'square') {
        if (unit === "metric") {
          return `${compData.width}mm×${compData.height}mm`;
        } else {
          return compData.imperialLabel;
        }
      } else {
        // Circles
        if (unit === "metric") {
          return `${compData.drillSize}mm`;
        } else {
          return compData.imperialLabel;
        }
      }
    }
    
    // Regular components
    if (unit === "metric") {
      return `${compData.drillSize.toFixed(1)}mm`;
    } else {
      return compData.imperialLabel;
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleComponentSelect = (compType: ComponentType) => {
    onComponentSelect(compType);
    console.log(`Selected ${COMPONENT_TYPES[compType].name}`);
  };

  return (
    <div className="absolute right-4 top-20 w-80 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleBackToCategories}
              className="w-6 h-6"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
          )}
          <h3 className="font-semibold">
            {selectedCategory ? selectedCategory : "Components"}
          </h3>
        </div>
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
          {!selectedCategory ? (
            // Category List View
            Object.entries(categories).map(([category, components]) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category as Category)}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left"
                data-testid={`button-category-${category}`}
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                  {category}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {components.length} items
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </button>
            ))
          ) : (
            // Component List View for Selected Category
            <div className="space-y-1">
              {categories[selectedCategory].map((compType) => {
                const comp = COMPONENT_TYPES[compType];
                return (
                  <button
                    key={compType}
                    onClick={() => handleComponentSelect(compType)}
                    className="w-full flex items-center justify-between gap-2 p-2 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left"
                    data-testid={`button-component-${compType}`}
                  >
                    <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                      {comp.name}
                    </span>
                    <span className="text-sm text-muted-foreground font-mono whitespace-nowrap flex-shrink-0">
                      {formatDrillSize(compType)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}