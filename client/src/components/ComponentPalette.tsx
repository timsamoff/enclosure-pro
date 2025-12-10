import { ComponentType, COMPONENT_TYPES } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronRight } from "lucide-react";
import { mmToFraction } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useFocusManagement } from "@/hooks/useFocusManagement";

interface ComponentPaletteProps {
  onComponentSelect: (type: ComponentType) => void;
  onClose: () => void;
  unit: "metric" | "imperial";
}

type Category = keyof typeof categories;
type FootprintSubcategory = "potentiometers" | "jacks" | "switches" | "knobs";

export default function ComponentPalette({
  onComponentSelect,
  onClose,
  unit,
}: ComponentPaletteProps) {
  const { releaseFocus } = useFocusManagement();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFootprintSubcategory, setSelectedFootprintSubcategory] = useState<FootprintSubcategory | null>(null);

  const categories = {
    Potentiometers: [] as ComponentType[],
    Jacks: [] as ComponentType[],
    Switches: [] as ComponentType[],
    LEDs: [] as ComponentType[],
    Fixtures: [] as ComponentType[],
    Screws: [] as ComponentType[],
    "Footprint Guides": [] as ComponentType[],
  };

  Object.entries(COMPONENT_TYPES).forEach(([key, value]) => {
    const category = value.category as keyof typeof categories;
    categories[category].push(key as ComponentType);
  });

  const categorizeFootprintGuides = (compType: ComponentType): "potentiometers" | "jacks" | "switches" | "knobs" | "other" => {
    const comp = COMPONENT_TYPES[compType];
    
    if (comp.name.toLowerCase().includes("potentiometer") || compType.includes("pot-")) {
      return "potentiometers";
    } else if (comp.name.toLowerCase().includes("jack") || compType.includes("jack-")) {
      return "jacks";
    } else if (
      comp.name.toLowerCase().includes("switch") || 
      comp.name.toLowerCase().includes("toggle") ||
      comp.name.toLowerCase().includes("dip") ||
      comp.name.toLowerCase().includes("pushbutton") ||
      comp.name.toLowerCase().includes("washer") ||
      comp.name.toLowerCase().includes("nut") ||
      comp.name.toLowerCase().includes("dress") ||
      compType.includes("spst") ||
      compType.includes("dpdt") ||
      compType.includes("3pdt") ||
      compType.includes("4pdt") ||
      compType.includes("5pdt")
    ) {
      return "switches";
    } else if (comp.name.toLowerCase().includes("knob") || compType.includes("knob-")) {
      return "knobs";
    }
    return "other";
  };

  const formatDrillSize = (type: ComponentType) => {
    const compData = COMPONENT_TYPES[type];
    
    if (compData.category === "Footprint Guides") {
      if (compData.shape === 'rectangle' || compData.shape === 'square') {
        if (unit === "metric") {
          return `${compData.width}mm×${compData.height}mm`;
        } else {
          return compData.imperialLabel;
        }
      } else {
        if (unit === "metric") {
          return `${compData.drillSize}mm`;
        } else {
          return compData.imperialLabel;
        }
      }
    }
    
    if (unit === "metric") {
      return `${compData.drillSize.toFixed(1)}mm`;
    } else {
      return compData.imperialLabel;
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedFootprintSubcategory(null);
    releaseFocus();
  };

  const handleBackToFootprintSubmenu = () => {
    setSelectedFootprintSubcategory(null);
    releaseFocus();
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setSelectedFootprintSubcategory(null);
    releaseFocus();
  };

  const handleFootprintSubcategorySelect = (subcategory: FootprintSubcategory) => {
    setSelectedFootprintSubcategory(subcategory);
    releaseFocus();
  };

  const handleComponentSelect = (compType: ComponentType) => {
    onComponentSelect(compType);
    releaseFocus();
  };

  const handleClose = () => {
    onClose();
    releaseFocus();
  };

  // Release focus when palette unmounts
  useEffect(() => {
    return () => {
      releaseFocus();
    };
  }, [releaseFocus]);

  const getFilteredFootprintGuides = () => {
    const allFootprints = categories["Footprint Guides"];
    
    if (!selectedFootprintSubcategory) {
      return allFootprints;
    }
    
    return allFootprints.filter(compType => {
      const category = categorizeFootprintGuides(compType);
      return category === selectedFootprintSubcategory;
    });
  };

  const getFootprintSubcategoryCounts = () => {
    const allFootprints = categories["Footprint Guides"];
    
    return {
      potentiometers: allFootprints.filter(compType => categorizeFootprintGuides(compType) === "potentiometers").length,
      jacks: allFootprints.filter(compType => categorizeFootprintGuides(compType) === "jacks").length,
      switches: allFootprints.filter(compType => categorizeFootprintGuides(compType) === "switches").length,
      knobs: allFootprints.filter(compType => categorizeFootprintGuides(compType) === "knobs").length,
    };
  };

  const subcategoryCounts = getFootprintSubcategoryCounts();

  return (
    <div className="absolute right-4 top-20 w-80 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {(selectedCategory || selectedFootprintSubcategory) && (
            <Button
              size="icon"
              variant="ghost"
              onClick={selectedFootprintSubcategory ? handleBackToFootprintSubmenu : handleBackToCategories}
              onMouseUp={releaseFocus}
              className="w-6 h-6"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </Button>
          )}
          <h3 className="font-semibold">
            {selectedFootprintSubcategory 
              ? selectedFootprintSubcategory === "potentiometers" 
                ? "Potentiometers"
                : selectedFootprintSubcategory === "jacks" 
                ? "Jacks" 
                : selectedFootprintSubcategory === "switches" 
                ? "Switches" 
                : "Knobs"
              : selectedCategory 
                ? selectedCategory 
                : "Components"
            }
          </h3>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleClose}
          onMouseUp={releaseFocus}
          data-testid="button-close-palette"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-4">
          {!selectedCategory ? (
            Object.entries(categories).map(([category, components]) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category as Category)}
                onMouseUp={releaseFocus}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
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
          ) : selectedCategory === "Footprint Guides" && !selectedFootprintSubcategory ? (
            <div className="space-y-3">
              <button
                onClick={() => handleFootprintSubcategorySelect("potentiometers")}
                onMouseUp={releaseFocus}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                  Potentiometers
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {subcategoryCounts.potentiometers} items
                </span>
              </button>
              
              <button
                onClick={() => handleFootprintSubcategorySelect("jacks")}
                onMouseUp={releaseFocus}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                  Jacks
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {subcategoryCounts.jacks} items
                </span>
              </button>
              
              <button
                onClick={() => handleFootprintSubcategorySelect("switches")}
                onMouseUp={releaseFocus}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                  Switches
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {subcategoryCounts.switches} items
                </span>
              </button>
              
              <button
                onClick={() => handleFootprintSubcategorySelect("knobs")}
                onMouseUp={releaseFocus}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                  Knobs
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {subcategoryCounts.knobs} items
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {(selectedCategory === "Footprint Guides" 
                ? getFilteredFootprintGuides() 
                : categories[selectedCategory]
              ).map((compType) => {
                const comp = COMPONENT_TYPES[compType];
                return (
                  <button
                    key={compType}
                    onClick={() => handleComponentSelect(compType)}
                    onMouseUp={releaseFocus}
                    className="w-full flex items-center justify-between gap-2 p-2 border border-border rounded-md hover-elevate active-elevate-2 transition-all text-left cursor-pointer"
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