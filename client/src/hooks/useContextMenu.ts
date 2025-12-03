import { useState, useRef, useEffect } from "react";
import { PlacedComponent } from "@/types/schema";

interface UseContextMenuProps {
  components: PlacedComponent[];
  selectedComponent: string | null;
  setComponents: (components: PlacedComponent[]) => void;
  setSelectedComponent: (id: string | null) => void;
  markDirty: () => void;
  toast: any;
}

export function useContextMenu({
  components,
  selectedComponent,
  setComponents,
  setSelectedComponent,
  markDirty,
  toast
}: UseContextMenuProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    componentId: string | null;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [preventCanvasClick, setPreventCanvasClick] = useState(false);
  const justDuplicatedRef = useRef<string | null>(null); // Track the ID we just duplicated to

  const handleCanvasRightClick = (e: React.MouseEvent, componentId: string | null) => {
    e.preventDefault();
    
    console.log("Right click - componentId:", componentId, "selectedComponent:", selectedComponent);
    
    // Always close any existing context menu first
    if (contextMenu) {
      setContextMenu(null);
      setPreventCanvasClick(false);
      justDuplicatedRef.current = null;
    }
    
    // Only show context menu if:
    // 1. We have a selected component
    // 2. AND we're right-clicking on that same component
    if (componentId && selectedComponent && componentId === selectedComponent) {
      console.log("Showing context menu for selected component");
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        componentId
      });
      setPreventCanvasClick(true);
    } else if (!componentId) {
      // If right-clicking on empty canvas, clear selection
      console.log("Right-click on empty canvas - clearing selection");
      setSelectedComponent(null);
    }
  };

  const handleDuplicate = () => {
    if (!contextMenu?.componentId) return;
    
    console.log("Duplicating component:", contextMenu.componentId);
    
    const original = components.find(c => c.id === contextMenu.componentId);
    if (!original) return;
    
    const originalId = contextMenu.componentId; // Store this
    
    // Create a unique ID with timestamp for proper z-ordering
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const newId = `comp-${timestamp}-${randomStr}`;
    const duplicated: PlacedComponent = {
      ...original,
      id: newId,
      x: original.x + 10,
      y: original.y + 10,
      excludeFromPrint: original.excludeFromPrint,
      rotation: original.rotation,
    };
    
    console.log("Created duplicate with new ID:", newId);
    
    // Track the new duplicated ID
    justDuplicatedRef.current = newId;
    
    // Close context menu and prevent further interactions
    setContextMenu(null);
    console.log("Setting preventCanvasClick to TRUE, blocking original:", originalId);
    setPreventCanvasClick(true);
    
    // Add component first
    setComponents(prev => [...prev, duplicated]);
    
    // Then select it (don't clear selection first - go straight from old to new)
    setSelectedComponent(newId);
    markDirty();
    
    // Clear the justDuplicatedRef after the next microtask to allow the selection to happen
    // Using requestAnimationFrame for minimal delay - just enough for React to process the state update
    requestAnimationFrame(() => {
      justDuplicatedRef.current = null;
      setPreventCanvasClick(false);
    });
    
    toast({
      title: "Component Duplicated",
      description: "Component duplicated and selected",
    });
  };

  const handleRotate = () => {
    if (!contextMenu?.componentId) return;
    
    console.log("Rotating component:", contextMenu.componentId);
    
    setComponents(
      components.map(c => {
        if (c.id === contextMenu.componentId) {
          const currentRotation = c.rotation || 0;
          // Toggle between 0° and 90° only
          const newRotation = currentRotation === 0 ? 90 : 0;
          console.log(`Rotating from ${currentRotation}° to ${newRotation}°`);
          return { ...c, rotation: newRotation };
        }
        return c;
      })
    );
    
    markDirty();
    
    const currentComponent = components.find(c => c.id === contextMenu.componentId);
    const newRotation = currentComponent?.rotation === 0 ? 90 : 0;
    
    toast({
      title: "Component Rotated",
      description: `Component rotated ${newRotation}°`,
    });
  };

  const handleTogglePrint = () => {
    if (!contextMenu?.componentId) return;
    
    console.log("Toggling print for component:", contextMenu.componentId);
    
    const currentComponent = components.find(c => c.id === contextMenu.componentId);
    if (!currentComponent) return;
    
    const newExcludeFromPrint = !currentComponent.excludeFromPrint;
    
    setComponents(
      components.map(c => {
        if (c.id === contextMenu.componentId) {
          return { ...c, excludeFromPrint: newExcludeFromPrint };
        }
        return c;
      })
    );
    
    markDirty();
    
    toast({
      title: "Print Setting Updated",
      description: `Component will ${newExcludeFromPrint ? 'not print' : 'print'}`,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setPreventCanvasClick(false);
    justDuplicatedRef.current = null; // Clear the ref when closing menu
  };

  // Check if we should prevent canvas clicks
  const shouldPreventCanvasClick = () => {
    return preventCanvasClick || contextMenu !== null;
  };

  return {
    contextMenu,
    setContextMenu,
    handleCanvasRightClick,
    handleDuplicate,
    handleRotate,
    handleTogglePrint,
    closeContextMenu,
    shouldPreventCanvasClick,
    menuRef,
    justDuplicatedRef  // Export this so Designer can check it
  };
}