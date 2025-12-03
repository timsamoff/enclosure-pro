import { 
  ComponentType, 
  PlacedComponent, 
  EnclosureSide, 
  COMPONENT_TYPES, 
  EnclosureType,
  ENCLOSURE_TYPES
} from "@/types/schema";

interface UseComponentManagementProps {
  components: PlacedComponent[];
  setComponents: (components: PlacedComponent[]) => void;
  selectedComponent: string | null;
  setSelectedComponent: (id: string | null) => void;
  gridEnabled: boolean;
  gridSize: number;
  setShowPalette: (show: boolean) => void;
  markDirty: () => void;
  enclosureType: EnclosureType;
  rotation: number;
}

export function useComponentManagement({
  components,
  setComponents,
  selectedComponent,
  setSelectedComponent,
  gridEnabled,
  gridSize,
  setShowPalette,
  markDirty,
  enclosureType,
  rotation
}: UseComponentManagementProps) {
  const handleComponentMove = (id: string, x: number, y: number, side?: EnclosureSide) => {
    console.log("handleComponentMove called:", { id, x, y, side, componentsCount: components.length });
    
    const rotatesLabels = ENCLOSURE_TYPES[enclosureType].rotatesLabels || false;
    
    setComponents(
      components.map(c => {
        if (c.id === id) {
          console.log("Moving component:", c);
          let targetSide = side || c.side;
          if (side && rotatesLabels && rotation !== 0) {
            const reverseMap = {
              'Front': 'Front',
              'Top': 'Left',
              'Right': 'Top',
              'Bottom': 'Right',
              'Left': 'Bottom'
            };
            targetSide = reverseMap[side] || side;
          }
          
          return { ...c, x, y, side: targetSide };
        }
        return c;
      })
    );
    markDirty();
  };

  const handleComponentDelete = (id: string) => {
    console.log("Deleting component:", id);
    setComponents(components.filter(c => c.id !== id));
    markDirty();
  };

  const handleComponentSelect = (type: ComponentType) => {
    console.log("Adding new component of type:", type);
    
    let initialX = 0;
    let initialY = 0;
    
    if (gridEnabled && gridSize > 0) {
      const mmToPixels = 3.7795275591;
      const gridPixels = gridSize * mmToPixels;
      initialX = Math.round(initialX / gridPixels) * gridPixels;
      initialY = Math.round(initialY / gridPixels) * gridPixels;
    }
    
    const compData = COMPONENT_TYPES[type];
    const isFootprintGuide = compData.category === "Footprint Guides (not printed)";
    
    // Create ID with timestamp for proper z-ordering
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    
    const newComponent: PlacedComponent = {
      id: `comp-${timestamp}-${randomStr}`, // FIXED: Include timestamp
      type,
      x: initialX,
      y: initialY,
      side: "Front",
      rotation: 0,
      excludeFromPrint: isFootprintGuide,
    };
    
    console.log("New component created:", newComponent);
    setComponents([...components, newComponent]);
    setSelectedComponent(newComponent.id);
    setShowPalette(false);
    markDirty();
  };

  return {
    handleComponentMove,
    handleComponentDelete,
    handleComponentSelect
  };
}