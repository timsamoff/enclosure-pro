import { ComponentType, COMPONENT_TYPES } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronRight } from "lucide-react";
import { mmToFraction } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useFocusManagement } from "@/hooks/useFocusManagement";

interface ComponentPaletteProps {
  onComponentSelect: (type: ComponentType) => void;
  onClose: () => void;
  unit: "metric" | "imperial";
}

const categorizeFootprintGuides = (compType: ComponentType): string => {
  const comp = COMPONENT_TYPES[compType];
  
  // Check for slide potentiometers first (they have "slide" in type)
  if (compType.includes("slide")) {
    return "Slide Potentiometers";
  }
  
  if (comp.name.toLowerCase().includes("potentiometer") || compType.includes("pot-")) {
    return "Potentiometers";
  } else if (comp.name.toLowerCase().includes("jack") || compType.includes("jack-")) {
    return "Jacks";
  } else if (
    comp.name.toLowerCase().includes("switch") || 
    comp.name.toLowerCase().includes("toggle") ||
    comp.name.toLowerCase().includes("dip") ||
    comp.name.toLowerCase().includes("pushbutton") ||
    comp.name.toLowerCase().includes("washer") ||
    comp.name.toLowerCase().includes("nut") ||
    comp.name.toLowerCase().includes("dress") ||
    comp.name.toLowerCase().includes("rotary") ||
    compType.includes("spst") ||
    compType.includes("dpdt") ||
    compType.includes("3pdt") ||
    compType.includes("4pdt") ||
    compType.includes("5pdt") ||
    compType.includes("rotary")
  ) {
    return "Switches";
  } else if (comp.name.toLowerCase().includes("knob") || compType.includes("knob-")) {
    return "Knobs";
  }
  return "Other";
};

export default function ComponentPalette({
  onComponentSelect,
  onClose,
  unit,
}: ComponentPaletteProps) {
  const { releaseFocus } = useFocusManagement();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFootprintSubcategory, setSelectedFootprintSubcategory] = useState<string | null>(null);

  // Dynamically generate categories from COMPONENT_TYPES
  const { categories, categoryKeys } = useMemo(() => {
    const categoriesMap: Record<string, ComponentType[]> = {};
    
    Object.entries(COMPONENT_TYPES).forEach(([key, value]) => {
      const category = value.category;
      if (!categoriesMap[category]) {
        categoriesMap[category] = [];
      }
      categoriesMap[category].push(key as ComponentType);
    });
    
    // Sort categories alphabetically but keep "Footprint Guides" at the end
    const sortedCategories = Object.keys(categoriesMap).sort((a, b) => {
      // If either is "Footprint Guides", handle specially
      if (a === "Footprint Guides" && b === "Footprint Guides") return 0;
      if (a === "Footprint Guides") return 1; // "Footprint Guides" comes after
      if (b === "Footprint Guides") return -1; // Other comes before "Footprint Guides"
      
      // Otherwise, sort alphabetically
      return a.localeCompare(b);
    });
    
    return {
      categories: categoriesMap,
      categoryKeys: sortedCategories
    };
  }, []);

  // Dynamically generate footprint subcategories
  const footprintSubcategories = useMemo(() => {
    const allFootprints = categories["Footprint Guides"] || [];
    const subcategoriesMap: Record<string, ComponentType[]> = {};
    
    allFootprints.forEach((compType) => {
      const subcategory = categorizeFootprintGuides(compType);
      if (!subcategoriesMap[subcategory]) {
        subcategoriesMap[subcategory] = [];
      }
      subcategoriesMap[subcategory].push(compType);
    });
    
    // Sort subcategories alphabetically
    const sortedSubcategories = Object.keys(subcategoriesMap).sort((a, b) => {
      return a.localeCompare(b);
    });
    
    return {
      subcategoriesMap,
      subcategoryKeys: sortedSubcategories
    };
  }, [categories]);

  const formatDrillSize = (type: ComponentType) => {
    const compData = COMPONENT_TYPES[type];
    
    // Handle rectangular components (Footprint Guides, Slide Potentiometers, etc.)
    if (compData.shape === 'rectangle' || compData.shape === 'square') {
      if (unit === "metric") {
        // Metric mode for rectangular components
        return `${compData.width || 0}mm×${compData.height || 0}mm`;
      } else {
        // Imperial mode for rectangular components - use imperialLabel if available
        if (compData.imperialLabel && compData.imperialLabel !== "") {
          return compData.imperialLabel;
        }
        // Fallback: convert mm to inches
        const widthInches = (compData.width || 0) / 25.4;
        const heightInches = (compData.height || 0) / 25.4;
        return `${widthInches.toFixed(3)}"×${heightInches.toFixed(3)}"`;
      }
    }
    
    // Handle circular components with drill size
    if (unit === "metric") {
      // Metric mode for circular components
      return `${(compData.drillSize || 0).toFixed(1)}mm`;
    } else {
      // Imperial mode for circular components - use imperialLabel if available
      if (compData.imperialLabel && compData.imperialLabel !== "") {
        return compData.imperialLabel;
      }
      // Fallback: convert mm to inches
      const inches = (compData.drillSize || 0) / 25.4;
      return `${inches.toFixed(3)}"`;
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

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSelectedFootprintSubcategory(null);
    releaseFocus();
  };

  const handleFootprintSubcategorySelect = (subcategory: string) => {
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
    if (!selectedFootprintSubcategory) {
      return categories["Footprint Guides"] || [];
    }
    
    return footprintSubcategories.subcategoriesMap[selectedFootprintSubcategory] || [];
  };

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
              ? selectedFootprintSubcategory
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
            categoryKeys.map((category) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                onMouseUp={releaseFocus}
                className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-all text-left cursor-pointer"
                data-testid={`button-category-${category}`}
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                  {category}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {categories[category]?.length || 0} items
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </button>
            ))
          ) : selectedCategory === "Footprint Guides" && !selectedFootprintSubcategory ? (
            <div className="space-y-3">
              {footprintSubcategories.subcategoryKeys.map((subcategory) => (
                <button
                  key={subcategory}
                  onClick={() => handleFootprintSubcategorySelect(subcategory)}
                  onMouseUp={releaseFocus}
                  className="w-full flex items-center justify-between gap-2 p-3 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-all text-left cursor-pointer"
                >
                  <span className="text-sm font-medium flex-1 min-w-0 truncate pr-2">
                    {subcategory}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {footprintSubcategories.subcategoriesMap[subcategory]?.length || 0} items
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {(selectedCategory === "Footprint Guides" 
                ? getFilteredFootprintGuides() 
                : categories[selectedCategory] || []
              ).map((compType) => {
                const comp = COMPONENT_TYPES[compType];
                return (
                  <button
                    key={compType}
                    onClick={() => handleComponentSelect(compType)}
                    onMouseUp={releaseFocus}
                    className="w-full flex items-center justify-between gap-2 p-2 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-all text-left cursor-pointer"
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