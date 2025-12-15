import { useState, useEffect, useRef } from "react";
import UnwrappedCanvas from "@/components/UnwrappedCanvas";
import TopControls from "@/components/TopControls";
import BottomInfo from "@/components/BottomInfo";
import ComponentPalette from "@/components/ComponentPalette";
import EnclosureSelector from "@/components/EnclosureSelector";
import GridSelector from "@/components/GridSelector";
import BlankCanvas from "@/components/BlankCanvas";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";

import { usePrintScaleTest } from "@/hooks/usePrintScaleTest";

import { Copy, RotateCw, RotateCcw, Printer, Download, Check, Square } from "lucide-react";

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
  
  // Debug logging
  const debugLog = (message: string, data?: any) => {
    // console.log(`[Designer] ${message}`, data || '');
  };

  debugLog("Component rendering");
  
  // State - DEFAULT TO NULL FOR BLANK CANVAS
  const [enclosureType, setEnclosureType] = useState<EnclosureType>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(5);
  const [unit, setUnit] = useState<MeasurementUnit>("metric");
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  
  // Wrap setSelectedComponent to track who's calling it
  const wrappedSetSelectedComponent = (id: string | null) => {
    debugLog("SET SELECTED COMPONENT CALLED:", id);
    console.trace();
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

  // Refs for stability
  const fileOperationsRef = useRef<any>(null);
  const printRef = useRef<any>(null);
  const pdfExportRef = useRef<any>(null);
  const confirmDialogsRef = useRef<any>(null);

  const enclosureTypeRef = useRef(enclosureType);
  const componentsRef = useRef(components);
  const unitRef = useRef(unit);
  const rotationRef = useRef(rotation);

  // Update refs when state changes
  useEffect(() => {
    enclosureTypeRef.current = enclosureType;
    debugLog("enclosureTypeRef updated:", enclosureType);
  }, [enclosureType]);

  useEffect(() => {
    componentsRef.current = components;
    debugLog("componentsRef updated, count:", components.length);
  }, [components]);

  useEffect(() => {
    unitRef.current = unit;
    debugLog("unitRef updated:", unit);
  }, [unit]);

  useEffect(() => {
    rotationRef.current = rotation;
    debugLog("rotationRef updated:", rotation);
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

  debugLog("fileOperations created, handleLoad exists:", !!fileOperations.handleLoad);

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
    projectName: fileOperations.projectName,
    enclosureType,
    toast
  });

  const print = usePrint({
    enclosureTypeRef,
    componentsRef,
    unitRef,
    rotationRef,
    projectName: fileOperations.projectName,
    enclosureType,
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

  // Update refs when hooks are ready
  useEffect(() => {
    fileOperationsRef.current = fileOperations;
    printRef.current = print;
    pdfExportRef.current = pdfExport;
    confirmDialogsRef.current = confirmDialogs;
    debugLog("Hook refs updated");
  }, [fileOperations, print, pdfExport, confirmDialogs]);

  useKeyboardShortcuts({
    handleZoomIn: () => setZoom(prev => snapZoom(prev + 0.1)),
    handleZoomOut: () => setZoom(prev => snapZoom(prev - 0.1)),
    handleSave: () => {
      handleMenuSave();
    },
    handleSaveAs: () => {
      handleMenuSaveAs();
    },
    handleLoad: () => {
      handleMenuOpen();
    },
    handlePrint: () => {
      handleMenuPrint();
    },
    handleExportPDF: () => {
      handleMenuExportPDF();
    },
    handleQuit: () => {
      handleMenuQuit();
    }
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

  const printScaleTest = usePrintScaleTest();

  // BULLETPROOF SOLUTION: Create stable handler functions that use refs
  const handleMenuNew = useRef(() => {
    debugLog("Menu: New triggered (via ref)");
    if (fileOperationsRef.current?.handleNew) {
      fileOperationsRef.current.handleNew();
    }
  }).current;

  const handleMenuOpen = useRef(() => {
    debugLog("Menu: Open triggered (via ref)");
    
    if (window.electronAPI?.openProjectFile) {
      debugLog("Using openProjectFile API");
      window.electronAPI.openProjectFile().then((result: any) => {
        debugLog("openProjectFile result:", result);
        
        if (result.success && result.filePath) {
          debugLog("File selected:", result.filePath);
          
          if (fileOperationsRef.current) {
            if (fileOperationsRef.current.isDirty) {
              fileOperationsRef.current.setPendingFilePath(result.filePath);
              confirmDialogsRef.current?.setShowOpenConfirmDialog(true);
            } else {
              if (fileOperationsRef.current.openFileFromPath) {
                fileOperationsRef.current.openFileFromPath(result.filePath);
              } else {
                debugLog("openFileFromPath not available, trying handleLoad");
                fileOperationsRef.current.handleLoad?.(result.filePath);
              }
            }
          }
        } else if (result.canceled) {
          debugLog("User canceled file selection");
        } else if (result.error) {
          debugLog("Error opening file:", result.error);
          toast({
            title: "Open Error",
            description: `Failed to open file: ${result.error}`,
            variant: "destructive",
          });
        }
      }).catch((error: any) => {
        debugLog("Error with openProjectFile API:", error);
        toast({
          title: "Open Error",
          description: `Failed to open file: ${error.message || 'Unknown error'}`,
          variant: "destructive",
        });
      });
    } else if (window.electronAPI?.openFile) {
      debugLog("Using openFile API (fallback)");
      window.electronAPI.openFile({
        filters: [{ name: 'Enclosure Project Files', extensions: ['enc'] }]
      }).then((result: any) => {
        debugLog("openFile result:", result);
        
        if (!result.canceled && result.filePath) {
          debugLog("File selected via fallback:", result.filePath);
          
          if (fileOperationsRef.current) {
            if (fileOperationsRef.current.isDirty) {
              fileOperationsRef.current.setPendingFilePath(result.filePath);
              confirmDialogsRef.current?.setShowOpenConfirmDialog(true);
            } else {
              if (fileOperationsRef.current.openFileFromPath) {
                fileOperationsRef.current.openFileFromPath(result.filePath);
              } else {
                debugLog("openFileFromPath not available");
              }
            }
          }
        } else {
          debugLog("File selection canceled or no file selected");
        }
      }).catch((error: any) => {
        debugLog("Error with openFile API:", error);
      });
    } else if (fileOperationsRef.current?.handleLoad) {
      debugLog("Using fileOperations.handleLoad (last resort)");
      fileOperationsRef.current.handleLoad();
    } else {
      debugLog("No file open API available");
      toast({
        title: "Open Error",
        description: "File open functionality is not available",
        variant: "destructive",
      });
    }
  }).current;

  const handleMenuSave = useRef(() => {
    debugLog("Menu: Save triggered (via ref)");
    if (fileOperationsRef.current?.handleSave) {
      fileOperationsRef.current.handleSave();
    }
  }).current;

  const handleMenuSaveAs = useRef(() => {
    debugLog("Menu: Save As triggered (via ref)");
    if (fileOperationsRef.current?.handleSaveAs) {
      fileOperationsRef.current.handleSaveAs();
    }
  }).current;

  const handleMenuPrint = useRef(() => {
    debugLog("Menu: Print triggered (via ref)");
    if (printRef.current?.handlePrint) {
      printRef.current.handlePrint();
    }
  }).current;

  const handleMenuExportPDF = useRef(() => {
    debugLog("Menu: Export PDF triggered (via ref)");
    if (pdfExportRef.current?.handleExportPDF) {
      pdfExportRef.current.handleExportPDF();
    }
  }).current;

  const handleMenuQuit = useRef(() => {
    debugLog("Menu: Quit triggered (via ref)");
    
    if (fileOperationsRef.current?.isDirty) {
      debugLog("Quit: Project is dirty, showing confirm dialog");
      if (confirmDialogsRef.current?.setShowQuitConfirmDialog) {
        confirmDialogsRef.current.setShowQuitConfirmDialog(true);
      } else {
        debugLog("Quit: confirmDialogsRef not available");
      }
    } else {
      debugLog("Quit: Project is clean, closing window");
      if (window.electronAPI?.isElectron) {
        window.electronAPI.closeWindow();
      } else {
        toast({
          title: "Quit",
          description: "Close the browser tab to quit",
        });
      }
    }
  }).current;

  // Set up Electron menu listeners with proper cleanup
  useEffect(() => {
    debugLog("Setting up Electron menu listeners");
    
    if (!window.electronAPI) {
      debugLog("window.electronAPI not available");
      return;
    }
    
    const cleanupFunctions: (() => void)[] = [];
    
    debugLog("Registering menu listeners");
    
    if (window.electronAPI.onMenuNew) {
      const cleanup = window.electronAPI.onMenuNew(() => {
        debugLog("Menu: New triggered");
        handleMenuNew();
      });
      cleanupFunctions.push(cleanup);
    }
    
    if (window.electronAPI.onMenuOpen) {
      const cleanup = window.electronAPI.onMenuOpen(() => {
        debugLog("Menu: Open triggered");
        handleMenuOpen();
      });
      cleanupFunctions.push(cleanup);
    }
    
    if (window.electronAPI.onMenuSave) {
      const cleanup = window.electronAPI.onMenuSave(() => {
        debugLog("Menu: Save triggered");
        handleMenuSave();
      });
      cleanupFunctions.push(cleanup);
    }
    
    if (window.electronAPI.onMenuSaveAs) {
      const cleanup = window.electronAPI.onMenuSaveAs(() => {
        debugLog("Menu: Save As triggered");
        handleMenuSaveAs();
      });
      cleanupFunctions.push(cleanup);
    }
    
    if (window.electronAPI.onMenuPrint) {
      const cleanup = window.electronAPI.onMenuPrint(() => {
        debugLog("Menu: Print triggered");
        handleMenuPrint();
      });
      cleanupFunctions.push(cleanup);
    }
    
    if (window.electronAPI.onMenuExportPDF) {
      const cleanup = window.electronAPI.onMenuExportPDF(() => {
        debugLog("Menu: Export PDF triggered");
        handleMenuExportPDF();
      });
      cleanupFunctions.push(cleanup);
    }
    
    if (window.electronAPI.onMenuQuit) {
      const cleanup = window.electronAPI.onMenuQuit(() => {
        debugLog("Menu: Quit triggered");
        handleMenuQuit();
      });
      cleanupFunctions.push(cleanup);
    }
    
    debugLog("Menu listeners registered successfully");
    
    return () => {
      debugLog("Cleaning up menu listeners");
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [
    handleMenuNew, 
    handleMenuOpen, 
    handleMenuSave, 
    handleMenuSaveAs, 
    handleMenuPrint, 
    handleMenuExportPDF, 
    handleMenuQuit
  ]);

  useEffect(() => {
    debugLog("Setting up Electron window event listeners");
    
    if (window.electronAPI?.isElectron && window.electronAPI.onCloseRequested) {
      debugLog("Setting up onCloseRequested listener");
      const unsubscribe = window.electronAPI.onCloseRequested(() => {
        debugLog("onCloseRequested triggered, isDirty:", fileOperations.isDirty);
        if (fileOperations.isDirty) {
          confirmDialogs.setShowQuitConfirmDialog(true);
        } else {
          window.electronAPI.closeWindow();
        }
      });
      return unsubscribe;
    }
  }, [fileOperations.isDirty, confirmDialogs]);

  useEffect(() => {
    if (window.electronAPI?.isElectron && window.electronAPI.onFileOpenRequest) {
      debugLog("Setting up onFileOpenRequest listener");
      const handleFileOpenRequest = (event: any, filePath: string) => {
        debugLog("onFileOpenRequest triggered, filePath:", filePath, "isDirty:", fileOperations.isDirty);
        if (fileOperations.isDirty) {
          fileOperations.setPendingFilePath(filePath);
          confirmDialogs.setShowOpenConfirmDialog(true);
        } else {
          fileOperations.openFileFromPath(filePath);
        }
      };

      const removeListener = window.electronAPI.onFileOpenRequest(handleFileOpenRequest);
      
      return () => {
        debugLog("Cleaning up onFileOpenRequest listener");
        removeListener();
      };
    }
  }, [fileOperations.isDirty, fileOperations, confirmDialogs]);

  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       (typeof window !== 'undefined' && window.location.href.includes('localhost'));

  debugLog("Rendering component, isDevelopment:", isDevelopment);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {enclosureType === null ? (
        <>
          {/* Blank canvas when no enclosure selected */}
    <BlankCanvas 
      onSelectEnclosure={() => setShowEnclosureSelector(true)}
      appIcon={appIcon}
      appVersion="1.1.0-beta.1"
    />
    
    <TopControls
      currentSide={undefined}
      zoom={1}
      fileName={fileOperations.projectName}
      isDirty={false}
      onZoomIn={() => {}}
      onZoomOut={() => {}}
      onRotate={undefined}
      onPrevSide={undefined}
      onNextSide={undefined}
      onNew={handleMenuNew}
      onSave={handleMenuSave}
      onSaveAs={handleMenuSaveAs}
      onOpen={handleMenuOpen}
      onExportPDF={handleMenuExportPDF}
      onPrint={handleMenuPrint}
      onQuit={handleMenuQuit}
    />
    
    <EnclosureSelector
      open={showEnclosureSelector}
      onClose={() => setShowEnclosureSelector(false)}
      currentType={enclosureType}
      onSelect={(type) => {
        debugLog("Enclosure type changed to:", type);
        setEnclosureType(type);
        setShowEnclosureSelector(false);
        fileOperations.markDirty();
      }}
      unit={unit}
    />
  </>
) : (
        <>
          {/* Normal canvas when enclosure is selected */}
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
              
              debugLog("onSelectComponent - shouldPrevent:", shouldPrevent, "id:", id, "duplicatedId:", duplicatedId, "isSelectingDuplicate:", isSelectingDuplicate);
              
              if (shouldPrevent && !isSelectingDuplicate) {
                debugLog("BLOCKED - preventing canvas click for non-duplicate, clearing flag now");
                contextMenu.closeContextMenu();
                return;
              }
              
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
              className="fixed bg-white border border-gray-300 rounded-lg shadow-lg py-2 z-50 min-w-48"
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
                  const currentComponent = components.find(c => c.id === contextMenu.contextMenu?.componentId);
                  const currentRotation = currentComponent?.rotation || 0;
                  const isAtDefault = currentRotation === 0;
                  const Icon = isAtDefault ? RotateCw : RotateCcw;
                  const label = isAtDefault ? "Rotate 90°" : "Rotate 90°";
                  
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
                  <Download className="w-4 h-4 mr-2 text-gray-600" />
                  <span>Print/Export</span>
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
            onNew={handleMenuNew}
            onSave={handleMenuSave}
            onSaveAs={handleMenuSaveAs}
            onOpen={handleMenuOpen}
            onExportPDF={handleMenuExportPDF}
            onPrint={handleMenuPrint}
            onQuit={handleMenuQuit}
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

          <ConfirmDialog {...confirmDialogs.newConfirmDialog} />
          <ConfirmDialog {...confirmDialogs.quitConfirmDialog} />
          <ConfirmDialog {...confirmDialogs.openConfirmDialog} />

          <EnclosureSelector
            open={showEnclosureSelector}
            onClose={() => setShowEnclosureSelector(false)}
            currentType={enclosureType}
            onSelect={(type) => {
              debugLog("Enclosure type changed to:", type);
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

          {isDevelopment && (
            <button
              onClick={() => {
                printScaleTest.downloadScaleTest();
                toast({
                  title: "Printer Test Downloaded",
                  description: "Print and measure to verify your printer scale is 100%",
                  duration: 5000,
                });
              }}
              className="absolute right-4 top-20 px-4 py-2 bg-amber-500 text-white rounded-lg shadow hover:bg-amber-600 z-40"
            >
              Printer Scale Test
            </button>
          )}

          {isDevelopment && (
            <button
              onClick={() => {
                debugLog("Testing file open API...");
                
                if (window.electronAPI?.openProjectFile) {
                  window.electronAPI.openProjectFile().then((result: any) => {
                    // console.log("Test openProjectFile result:", result);
                  });
                }
              }}
              className="absolute right-4 top-32 px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 z-40"
            >
              Test Open API
            </button>
          )}
        </>
      )}
    </div>
  );
}