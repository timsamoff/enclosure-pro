import { useState, useEffect, useRef } from "react";
import UnwrappedCanvas from "@/components/UnwrappedCanvas";
import TopControls from "@/components/TopControls";
import BottomInfo from "@/components/BottomInfo";
import ComponentPalette from "@/components/ComponentPalette";
import EnclosureSelector from "@/components/EnclosureSelector";
import GridSelector from "@/components/GridSelector";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Copy, RotateCw, RotateCcw, Printer, Check, Square } from "lucide-react"; // Added RotateCcw

import {
  EnclosureSide,
  MeasurementUnit,
  EnclosureType,
  ENCLOSURE_TYPES,
  getUnwrappedDimensions,
} from "@/types/schema";
import { useToast } from "@/hooks/use-toast";
import { snapZoom } from "@/lib/zoom";

// Import modular hooks
import { useFileOperations } from "@/hooks/useFileOperations";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePDFExport } from "@/hooks/usePDFExport";
import { usePrint } from "@/hooks/usePrint";
import { useComponentManagement } from "@/hooks/useComponentManagement";
import { useConfirmDialogs } from "@/hooks/useConfirmDialogs";

export default function Designer() {
  const { toast } = useToast();
  
  // State
  const [enclosureType, setEnclosureType] = useState<EnclosureType>("125B");
  const [components, setComponents] = useState<any[]>([]);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(5);
  const [unit, setUnit] = useState<MeasurementUnit>("metric");
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  
  // Wrap setSelectedComponent to track who's calling it
  const wrappedSetSelectedComponent = (id: string | null) => {
    console.log("SET SELECTED COMPONENT CALLED:", id);
    console.trace(); // This will show the call stack
    setSelectedComponent(id);
  };
  
  const [showPalette, setShowPalette] = useState(false);
  const [showEnclosureSelector, setShowEnclosureSelector] = useState(false);
  const [showGridSelector, setShowGridSelector] = useState(false);
  const [zoom, setZoom] = useState<number>(snapZoom(1));
  const [rotation, setRotation] = useState<number>(0);
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null);

  // Refs
  const enclosureTypeRef = useRef(enclosureType);
  const componentsRef = useRef(components);
  const unitRef = useRef(unit);
  const rotationRef = useRef(rotation);

  // Update refs when state changes
  useEffect(() => {
    enclosureTypeRef.current = enclosureType;
  }, [enclosureType]);

  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  // Load icon on mount
  useEffect(() => {
    const loadIcon = async () => {
      try {
        const iconPath = window.electronAPI?.isElectron 
          ? './images/EnclosureProIcon.png'
          : '/images/EnclosureProIcon.png';
        
        const response = await fetch(iconPath);
        if (!response.ok) return;
        
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setAppIcon(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        // Icon is optional
      }
    };
    loadIcon();
  }, []);

  // Track selection changes
  useEffect(() => {
    console.log("SELECTION CHANGED:", selectedComponent);
  }, [selectedComponent]);

  // Also log when components change
  useEffect(() => {
    console.log("COMPONENTS UPDATED, count:", components.length);
    console.log("Component IDs:", components.map(c => c.id));
  }, [components]);

  // Use modular hooks
  const fileOperations = useFileOperations({
    enclosureType,
    components,
    gridEnabled,
    gridSize,
    zoom,
    rotation,
    unit,
    appIcon,
    setEnclosureType,
    setComponents,
    setGridEnabled,
    setGridSize,
    setZoom,
    setRotation,
    setUnit,
    setProjectName,
    setProjectFilePath,
    toast
  });

  const contextMenu = useContextMenu({
    components,
    selectedComponent,
    setComponents,
    setSelectedComponent: wrappedSetSelectedComponent,
    markDirty: fileOperations.markDirty,
    toast
  });

  const componentManagement = useComponentManagement({
    components,
    setComponents,
    selectedComponent,
    setSelectedComponent: wrappedSetSelectedComponent,
    gridEnabled,
    gridSize,
    setShowPalette,
    markDirty: fileOperations.markDirty,
    enclosureType,
    rotation
  });

  const pdfExport = usePDFExport({
  enclosureTypeRef,
  componentsRef,
  unitRef,
  rotationRef,
  projectName: fileOperations.projectName, // Use the project name from fileOperations
  enclosureType, // Pass the current enclosureType
  toast
});

const print = usePrint({
  enclosureTypeRef,
  componentsRef,
  unitRef,
  rotationRef,
  projectName: fileOperations.projectName, // Use the project name from fileOperations
  enclosureType, // Pass the current enclosureType
  toast
});

  const confirmDialogs = useConfirmDialogs({
    onNewConfirmSave: fileOperations.handleNewConfirmSave,
    onNewConfirmDiscard: fileOperations.handleNewConfirmDiscard,
    onQuitConfirmSave: fileOperations.handleQuitConfirmSave,
    onQuitConfirmDiscard: fileOperations.handleQuitConfirmDiscard,
    onOpenConfirmSave: fileOperations.handleOpenConfirmSave,
    onOpenConfirmDiscard: fileOperations.handleOpenConfirmDiscard,
    onOpenConfirmCancel: fileOperations.handleOpenConfirmCancel
  });

  useKeyboardShortcuts({
    handleZoomIn: () => setZoom(prev => snapZoom(prev + 0.1)),
    handleZoomOut: () => setZoom(prev => snapZoom(prev - 0.1)),
    handleSave: fileOperations.handleSave,
    handleSaveAs: fileOperations.handleSaveAs,
    handleLoad: fileOperations.handleLoad,
    handlePrint: print.handlePrint,
    handleExportPDF: pdfExport.handleExportPDF,
    handleQuit: fileOperations.handleQuit
  });

  // UI Handlers
  const handleZoomIn = () => {
    setZoom(prev => snapZoom(prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(prev => snapZoom(prev - 0.1));
  };

  const handleRotateCanvas = () => {
    setRotation(prev => prev === 0 ? 90 : 0);
    fileOperations.markDirty();
  };

  const rotationDirection: 'cw' | 'ccw' = rotation === 0 ? 'cw' : 'ccw';

  const enclosure = ENCLOSURE_TYPES[enclosureType];
  
  const getSideDimensions = (side: EnclosureSide) => {
    const unwrapped = getUnwrappedDimensions(enclosureType);
    return unwrapped[side.toLowerCase() as keyof ReturnType<typeof getUnwrappedDimensions>];
  };

  // Helper function to get rotation icon and label
  const getRotationInfo = (componentId: string | null) => {
    if (!componentId) return { icon: RotateCw, label: "Rotate 90°" };
    
    const component = components.find(c => c.id === componentId);
    const currentRotation = component?.rotation || 0;
    
    // If component is at 0° or 180°, show clockwise icon (will rotate to 90°/270°)
    // If component is at 90° or 270°, show counter-clockwise icon (will rotate back to 0°/180°)
    const isAlignedWithGrid = currentRotation === 0 || currentRotation === 180;
    
    return {
      icon: isAlignedWithGrid ? RotateCw : RotateCcw,
      label: isAlignedWithGrid ? "Rotate 90°" : "Rotate 90°"
    };
  };

  // Electron event listeners
  useEffect(() => {
    if (window.electronAPI?.isElectron && window.electronAPI.onCloseRequested) {
      const unsubscribe = window.electronAPI.onCloseRequested(() => {
        if (fileOperations.isDirty) {
          confirmDialogs.setShowQuitConfirmDialog(true);
        } else {
          window.electronAPI.closeWindow();
        }
      });
      return unsubscribe;
    }
  }, [fileOperations.isDirty]);

  useEffect(() => {
    if (window.electronAPI?.isElectron && window.electronAPI.onFileOpenRequest) {
      const handleFileOpenRequest = (event: any, filePath: string) => {
        if (fileOperations.isDirty) {
          fileOperations.setPendingFilePath(filePath);
          confirmDialogs.setShowOpenConfirmDialog(true);
        } else {
          fileOperations.openFileFromPath(filePath);
        }
      };

      const removeListener = window.electronAPI.onFileOpenRequest(handleFileOpenRequest);
      
      return () => {
        removeListener();
      };
    }
  }, [fileOperations.isDirty]);

  useEffect(() => {
    if (window.electronAPI) {
      const handleMenuNew = () => {
        fileOperations.handleNew();
      };
      const handleMenuOpen = () => {
        fileOperations.handleLoad();
      };
      const handleMenuSave = () => {
        fileOperations.handleSave();
      };
      const handleMenuSaveAs = () => {
        fileOperations.handleSaveAs();
      };
      const handleMenuPrint = () => {
        print.handlePrint();
      };
      const handleMenuExportPDF = () => {
        pdfExport.handleExportPDF();
      };

      window.electronAPI.onMenuNew(handleMenuNew);
      window.electronAPI.onMenuOpen(handleMenuOpen);
      window.electronAPI.onMenuSave(handleMenuSave);
      window.electronAPI.onMenuSaveAs(handleMenuSaveAs);
      window.electronAPI.onMenuPrint(handleMenuPrint);
      window.electronAPI.onMenuExportPDF(handleMenuExportPDF);

      return () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('menu-new-file');
          window.electronAPI.removeAllListeners('menu-open-file');
          window.electronAPI.removeAllListeners('menu-save-file');
          window.electronAPI.removeAllListeners('menu-save-as-file');
          window.electronAPI.removeAllListeners('menu-print');
          window.electronAPI.removeAllListeners('menu-export-pdf');
        }
      };
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <UnwrappedCanvas
        enclosureType={enclosureType}
        components={components}
        zoom={zoom}
        rotation={rotation}
        gridEnabled={gridEnabled}
        gridSize={gridSize}
        unit={unit}
        onComponentMove={componentManagement.handleComponentMove}
        onComponentDelete={componentManagement.handleComponentDelete}
        selectedComponent={selectedComponent}
        onSelectComponent={(id) => {
          const shouldPrevent = contextMenu.shouldPreventCanvasClick();
          const duplicatedId = contextMenu.justDuplicatedRef?.current;
          const isSelectingDuplicate = id === duplicatedId;
          
          console.log("onSelectComponent - shouldPrevent:", shouldPrevent, "id:", id, "duplicatedId:", duplicatedId, "isSelectingDuplicate:", isSelectingDuplicate);
          
          // If we're preventing clicks, ONLY allow selecting the duplicated component
          if (shouldPrevent && !isSelectingDuplicate) {
            console.log("BLOCKED - preventing canvas click for non-duplicate, clearing flag now");
            // Clear the flag after blocking the FIRST unwanted event
            contextMenu.closeContextMenu(); // This sets preventCanvasClick to false
            return;
          }
          
          // If we're selecting the duplicate, clear the ref immediately
          if (isSelectingDuplicate && contextMenu.justDuplicatedRef) {
            contextMenu.justDuplicatedRef.current = null;
            contextMenu.closeContextMenu();
          }
          
          wrappedSetSelectedComponent(id);
        }}
        onCanvasClick={() => {
          if (!contextMenu.shouldPreventCanvasClick()) {
            setShowPalette(false);
            setShowEnclosureSelector(false);
            wrappedSetSelectedComponent(null);
          }
          contextMenu.closeContextMenu();
        }}
        onZoomChange={setZoom}
        rotatesLabels={ENCLOSURE_TYPES[enclosureType].rotatesLabels || false}
        onRightClick={contextMenu.handleCanvasRightClick}
      />

{contextMenu.contextMenu && (
  <div 
    className="fixed bg-white border border-gray-300 rounded-lg shadow-lg py-2 z-50 min-w-40"
    style={{
      left: contextMenu.contextMenu.x,
      top: contextMenu.contextMenu.y,
    }}
    onMouseDown={(e) => e.stopPropagation()}
    onMouseUp={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={(e) => {
        e.preventDefault();
        contextMenu.handleDuplicate();
      }}
      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm flex items-center gap-2 cursor-pointer"
    >
      <Copy className="w-4 h-4 mr-2 text-gray-600" />
      <span>Duplicate</span>
    </button>
    
    <div className="border-t border-gray-200 my-1"></div>
    
    <button
      onClick={(e) => {
        e.preventDefault();
        contextMenu.handleRotate();
      }}
      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm flex items-center gap-2 cursor-pointer"
    >
      {(() => {
        // Get fresh component data each render
        const currentComponent = components.find(c => c.id === contextMenu.contextMenu?.componentId);
        const currentRotation = currentComponent?.rotation || 0;
        const isAtDefault = currentRotation === 0;
        const Icon = isAtDefault ? RotateCw : RotateCcw; // Show clockwise when at 0°, counter-clockwise when at 90°
        const label = isAtDefault ? "Rotate  90°" : "Rotate  90°";
        
        return (
          <>
            <Icon className="w-4 h-4 mr-2 text-gray-600" />
            <span>{label}</span>
          </>
        );
      })()}
    </button>
    
    <div className="border-t border-gray-200 my-1"></div>
    
    <button
      onClick={(e) => {
        e.preventDefault();
        contextMenu.handleTogglePrint();
      }}
      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm flex items-center justify-between cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <Printer className="w-4 h-4 mr-2 text-gray-600" />
        <span>Print</span>
      </div>
      <span className="ml-2">
        {(() => {
          const currentComponent = components.find(c => c.id === contextMenu.contextMenu?.componentId);
          return currentComponent?.excludeFromPrint ? (
            <Square className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4" />
          );
        })()}
      </span>
    </button>
  </div>
)}

      <TopControls
        currentSide={undefined}
        zoom={zoom}
        fileName={fileOperations.projectName}
        isDirty={fileOperations.isDirty}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotateCanvas}
        rotationDirection={rotationDirection}
        onPrevSide={undefined}
        onNextSide={undefined}
        onNew={fileOperations.handleNew}
        onSave={fileOperations.handleSave}
        onSaveAs={fileOperations.handleSaveAs}
        onOpen={fileOperations.handleLoad}
        onExportPDF={pdfExport.handleExportPDF}
        onPrint={print.handlePrint}
        onQuit={fileOperations.handleQuit}
      />

      <BottomInfo
        gridEnabled={gridEnabled}
        gridSize={gridSize}
        enclosureType={enclosureType}
        unit={unit}
        onEnclosureClick={() => setShowEnclosureSelector(true)}
        onGridClick={() => setShowGridSelector(true)}
        onComponentsClick={() => setShowPalette(true)}
        onUnitChange={(newUnit) => {
          setUnit(newUnit);
          fileOperations.markDirty();
        }}
      />

      {showPalette && (
        <ComponentPalette
          onComponentSelect={componentManagement.handleComponentSelect}
          onClose={() => setShowPalette(false)}
          unit={unit}
        />
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog {...confirmDialogs.newConfirmDialog} />
      <ConfirmDialog {...confirmDialogs.quitConfirmDialog} />
      <ConfirmDialog {...confirmDialogs.openConfirmDialog} />

      <EnclosureSelector
        open={showEnclosureSelector}
        onClose={() => setShowEnclosureSelector(false)}
        currentType={enclosureType}
        onSelect={(type) => {
          setEnclosureType(type);
          fileOperations.markDirty();
        }}
        unit={unit}
      />

      <GridSelector
        open={showGridSelector}
        onOpenChange={setShowGridSelector}
        gridEnabled={gridEnabled}
        onGridEnabledChange={(enabled) => {
          setGridEnabled(enabled);
          fileOperations.markDirty();
        }}
        gridSize={gridSize}
        onGridSizeChange={(size) => {
          setGridSize(size);
          fileOperations.markDirty();
        }}
        unit={unit}
      />

      <button
        onClick={() => setShowPalette(true)}
        className="hidden lg:block absolute left-4 top-20 px-4 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover-elevate active-elevate-2 font-medium z-40 cursor-pointer"
        data-testid="button-show-palette"
      >
        Add Component
      </button>
    </div>
  );
}