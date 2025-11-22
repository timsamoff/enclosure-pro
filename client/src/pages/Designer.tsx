import { useState, useEffect, useRef, useCallback } from "react";
import UnwrappedCanvas from "@/components/UnwrappedCanvas";
import TopControls from "@/components/TopControls";
import BottomInfo from "@/components/BottomInfo";
import ComponentPalette from "@/components/ComponentPalette";
import EnclosureSelector from "@/components/EnclosureSelector";
import GridSelector from "@/components/GridSelector";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PlacedComponent,
  ComponentType,
  EnclosureSide,
  MeasurementUnit,
  EnclosureType,
  ENCLOSURE_TYPES,
  COMPONENT_TYPES,
  ProjectState,
  getUnwrappedDimensions,
} from "@/types/schema";
import jsPDF from "jspdf";
import { mmToFraction } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { snapZoom } from "@/lib/zoom";

// Helper functions for label rotation
const getRotatedSideLabel = (side: EnclosureSide, rotation: number, rotatesLabels: boolean): EnclosureSide => {
  if (!rotatesLabels || rotation === 0) {
    return side;
  }
  
  // 90° clockwise rotation mapping
  const rotationMap: Record<EnclosureSide, EnclosureSide> = {
    'Front': 'Front', // Front stays the same
    'Left': 'Top',
    'Top': 'Right', 
    'Right': 'Bottom',
    'Bottom': 'Left'
  };
  
  return rotationMap[side];
};

const getReverseSideMapping = (rotation: number, rotatesLabels: boolean): Record<EnclosureSide, EnclosureSide> => {
  if (!rotatesLabels || rotation === 0) {
    return {
      'Front': 'Front',
      'Left': 'Left',
      'Top': 'Top',
      'Right': 'Right',
      'Bottom': 'Bottom'
    };
  }
  
  return {
    'Front': 'Front',
    'Top': 'Left',
    'Right': 'Top',
    'Bottom': 'Right',
    'Left': 'Bottom'
  };
};

export default function Designer() {
  const { toast } = useToast();
  const [enclosureType, setEnclosureType] = useState<EnclosureType>("125B");
  const [components, setComponents] = useState<PlacedComponent[]>([]);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(5);
  const [unit, setUnit] = useState<MeasurementUnit>("metric");
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [showEnclosureSelector, setShowEnclosureSelector] = useState(false);
  const [showGridSelector, setShowGridSelector] = useState(false);
  const [showNewConfirmDialog, setShowNewConfirmDialog] = useState(false);
  const [showQuitConfirmDialog, setShowQuitConfirmDialog] = useState(false);
  const [showOpenConfirmDialog, setShowOpenConfirmDialog] = useState(false);
  
  const isDirtyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [projectName, setProjectName] = useState("");
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null);
  const projectFilePathRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [zoom, setZoom] = useState<number>(snapZoom(1));
  const [rotation, setRotation] = useState<number>(0);
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);

  // Use refs to avoid stale closures in print functions
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
        // In Electron production, files are served from dist/public
        const iconPath = window.electronAPI?.isElectron 
          ? './images/EnclosureProIcon.png'
          : '/images/EnclosureProIcon.png';
        
        const response = await fetch(iconPath);
        if (!response.ok) {
          return;
        }
        
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setAppIcon(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        // Icon is optional, just log and continue
      }
    };
    loadIcon();
  }, []);

  const enclosure = ENCLOSURE_TYPES[enclosureType];
  
  const getSideDimensions = (side: EnclosureSide) => {
    const unwrapped = getUnwrappedDimensions(enclosureType);
    return unwrapped[side.toLowerCase() as keyof ReturnType<typeof getUnwrappedDimensions>];
  };

  const markDirty = () => {
    setIsDirty(true);
    isDirtyRef.current = true;
  };
  
  const resetDirty = () => {
    setIsDirty(false);
    isDirtyRef.current = false;
  };

  const performNewProject = () => {
    setEnclosureType("125B");
    setComponents([]);
    setGridEnabled(true);
    setGridSize(5);
    setZoom(snapZoom(1));
    setRotation(0);
    setUnit("metric");
    setSelectedComponent(null);
    setProjectName("");
    setProjectFilePath(null);
    projectFilePathRef.current = null;
    resetDirty();
    toast({
      title: "New Project",
      description: "Started a new project",
    });
  };

  const handleNew = () => {
    if (isDirty) {
      setShowNewConfirmDialog(true);
    } else {
      performNewProject();
    }
  };

  const handleNewConfirmSave = async () => {
    setShowNewConfirmDialog(false);
    try {
      await handleSave();
      performNewProject();
    } catch (error) {
      console.error('Save failed, not starting new project:', error);
    }
  };

  const handleNewConfirmDiscard = () => {
    setShowNewConfirmDialog(false);
    performNewProject();
  };

  const handleQuit = () => {
    if (isDirty) {
      setShowQuitConfirmDialog(true);
    } else {
      if (window.electronAPI?.isElectron) {
        window.electronAPI.closeWindow();
      }
    }
  };

  const handleQuitConfirmSave = async () => {
    setShowQuitConfirmDialog(false);
    try {
      await handleSave();
      if (window.electronAPI?.isElectron) {
        window.electronAPI.closeWindow();
      }
    } catch (error) {
      console.error('Save failed, not quitting:', error);
    }
  };

  const handleQuitConfirmDiscard = () => {
    setShowQuitConfirmDialog(false);
    if (window.electronAPI?.isElectron) {
      window.electronAPI.closeWindow();
    }
  };

  const performLoad = async () => {
    if (window.electronAPI?.isElectron) {
      try {
        const result = await window.electronAPI.openFile({
          filters: [
            { name: 'Enclosure Project Files', extensions: ['enc'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result.canceled || !result.filePath) {
          return;
        }

        const readResult = await window.electronAPI.readFile({
          filePath: result.filePath
        });

        if (!readResult.success || !readResult.content) {
          throw new Error(readResult.error || 'Failed to read file');
        }

        const filename = result.filePath.split(/[/\\]/).pop() || 'untitled.enc';
        processLoadedFile(readResult.content, filename, result.filePath);
        return;
      } catch (error) {
        console.error('Electron load failed:', error);
      }
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.enc';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        processLoadedFile(json, file.name);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleLoad = async () => {
    if (isDirty) {
      setShowOpenConfirmDialog(true);
    } else {
      await performLoad();
    }
  };

  const openFileFromPath = async (filePath: string) => {
    try {
      const result = await window.electronAPI.openExternalFile(filePath);
      
      if (result.success && result.content) {
        const filename = filePath.split(/[/\\]/).pop() || 'untitled.enc';
        processLoadedFile(result.content, filename, filePath);
      } else {
        throw new Error(result.error || 'Failed to read file');
      }
    } catch (error) {
      console.error('Error opening file from path:', error);
      toast({
        title: "Open Failed",
        description: `Failed to open ${filePath.split(/[/\\]/).pop()}`,
        variant: "destructive",
      });
    }
  };

  const handleOpenConfirmSave = async () => {
    setShowOpenConfirmDialog(false);
    try {
      await handleSave();
      if (pendingFilePath) {
        await openFileFromPath(pendingFilePath);
        setPendingFilePath(null);
      }
    } catch (error) {
      console.error('Save failed or canceled, not opening file:', error);
      setPendingFilePath(null);
      toast({
        title: "Open Canceled",
        description: "File open was canceled",
      });
    }
  };

  const handleOpenConfirmDiscard = async () => {
    setShowOpenConfirmDialog(false);
    if (pendingFilePath) {
      await openFileFromPath(pendingFilePath);
      setPendingFilePath(null);
    }
  };

  const handleOpenConfirmCancel = () => {
    setShowOpenConfirmDialog(false);
    setPendingFilePath(null);
    toast({
      title: "Open Canceled",
      description: "File open was canceled",
    });
  };

  const handleZoomIn = () => {
    setZoom(prev => snapZoom(prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(prev => snapZoom(prev - 0.1));
  };

  const handleRotate = () => {
    setRotation(prev => prev === 0 ? 90 : 0);
    markDirty();
  };

  const rotationDirection: 'cw' | 'ccw' = rotation === 0 ? 'cw' : 'ccw';

  const handleComponentMove = (id: string, x: number, y: number, side?: EnclosureSide) => {
    const rotatesLabels = ENCLOSURE_TYPES[enclosureType].rotatesLabels || false;
    
    setComponents(prev =>
      prev.map(c => {
        if (c.id === id) {
          let targetSide = side || c.side;
          if (side && rotatesLabels && rotation !== 0) {
            const reverseMap = getReverseSideMapping(rotation, rotatesLabels);
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
    setComponents(prev => prev.filter(c => c.id !== id));
    markDirty();
  };

  const handleComponentSelect = (type: ComponentType) => {
    let initialX = 0;
    let initialY = 0;
    
    if (gridEnabled && gridSize > 0) {
      const mmToPixels = 3.7795275591;
      const gridPixels = gridSize * mmToPixels;
      initialX = Math.round(initialX / gridPixels) * gridPixels;
      initialY = Math.round(initialY / gridPixels) * gridPixels;
    }
    
    const newComponent: PlacedComponent = {
      id: `comp-${Date.now()}-${Math.random()}`,
      type,
      x: initialX,
      y: initialY,
      side: "Front",
    };
    setComponents(prev => [...prev, newComponent]);
    setSelectedComponent(newComponent.id);
    setShowPalette(false);
    markDirty();
  };

  const renderForPrintExport = useCallback((
  currentEnclosureType: EnclosureType, 
  shouldRotate: boolean = false, 
  currentRotation: number = 0
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const dimensions = getUnwrappedDimensions(currentEnclosureType);
      const currentUnit = unitRef.current;
      const rotatesLabels = ENCLOSURE_TYPES[currentEnclosureType].rotatesLabels || false;
      const currentComponents = componentsRef.current;

      const frontW = dimensions.front.width;
      const frontH = dimensions.front.height;
      const topW = dimensions.top.width;
      const topH = dimensions.top.height;
      const bottomW = dimensions.bottom.width;
      const bottomH = dimensions.bottom.height;
      const leftW = dimensions.left.width;
      const leftH = dimensions.left.height;
      const rightW = dimensions.right.width;
      const rightH = dimensions.right.height;

      let totalWidthMM = leftW + frontW + rightW;
      let totalHeightMM = topH + frontH + bottomH;

      if (shouldRotate) {
        [totalWidthMM, totalHeightMM] = [totalHeightMM, totalWidthMM];
      }

      const pixelsPerMM = 3.7795275591;
      
      const canvasWidth = Math.ceil(totalWidthMM * pixelsPerMM);
      const canvasHeight = Math.ceil(totalHeightMM * pixelsPerMM);

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      if (shouldRotate) {
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate(Math.PI / 2);
        ctx.translate(-canvasHeight / 2, -canvasWidth / 2);
        
        [totalWidthMM, totalHeightMM] = [totalHeightMM, totalWidthMM];
      }

      const topOffsetX = (frontW - topW) / 2 * pixelsPerMM;
      const bottomOffsetX = (frontW - bottomW) / 2 * pixelsPerMM;
      const leftOffsetY = (frontH - leftH) / 2 * pixelsPerMM;
      const rightOffsetY = (frontH - rightH) / 2 * pixelsPerMM;

      const layout = {
        front: { 
          x: leftW * pixelsPerMM, 
          y: topH * pixelsPerMM, 
          width: frontW * pixelsPerMM, 
          height: frontH * pixelsPerMM 
        },
        top: { 
          x: leftW * pixelsPerMM + topOffsetX, 
          y: 0, 
          width: topW * pixelsPerMM, 
          height: topH * pixelsPerMM 
        },
        bottom: { 
          x: leftW * pixelsPerMM + bottomOffsetX, 
          y: (topH + frontH) * pixelsPerMM, 
          width: bottomW * pixelsPerMM, 
          height: bottomH * pixelsPerMM 
        },
        left: { 
          x: 0, 
          y: topH * pixelsPerMM + leftOffsetY, 
          width: leftW * pixelsPerMM, 
          height: leftH * pixelsPerMM 
        },
        right: { 
          x: (leftW + frontW) * pixelsPerMM, 
          y: topH * pixelsPerMM + rightOffsetY, 
          width: rightW * pixelsPerMM, 
          height: rightH * pixelsPerMM 
        },
      };

      const drawSide = (sideKey: keyof typeof layout, originalLabel: string) => {
        const side = layout[sideKey];
        const x = side.x;
        const y = side.y;
        const w = side.width;
        const h = side.height;

        const displayLabel = rotatesLabels 
          ? getRotatedSideLabel(originalLabel as EnclosureSide, currentRotation, rotatesLabels)
          : originalLabel;

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        
        if (sideKey === 'front') {
          const cornerRadius = 5 * pixelsPerMM;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, cornerRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, w, h);
        }

        // Draw side label
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Use the same rotation logic for both print and PDF export
        if (rotatesLabels && currentRotation !== 0) {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(-Math.PI / 2); // 90° counter-clockwise
          ctx.fillText(displayLabel, 0, 0);
        } else {
          ctx.fillText(displayLabel, x + w / 2, y + h / 2);
        }
        ctx.restore();

        const sideComponents = currentComponents.filter(c => c.side === originalLabel);

        sideComponents.forEach(component => {
          const compData = COMPONENT_TYPES[component.type];
          const radius = (compData.drillSize / 2) * pixelsPerMM;

          const centerX = x + (w / 2) + component.x;
          const centerY = y + (h / 2) + component.y;

          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = 'black';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.stroke();

          const crosshairSize = Math.max(radius, 10);
          ctx.beginPath();
          ctx.moveTo(centerX - crosshairSize, centerY);
          ctx.lineTo(centerX + crosshairSize, centerY);
          ctx.moveTo(centerX, centerY - crosshairSize);
          ctx.lineTo(centerX, centerY + crosshairSize);
          ctx.stroke();

          const drillText = currentUnit === "metric"
            ? `${compData.drillSize.toFixed(1)}mm`
            : compData.imperialLabel;
          
          const labelOffset = radius + 15;
          
          ctx.font = '12px Arial';
          const textMetrics = ctx.measureText(drillText);
          const textWidth = textMetrics.width;
          
          ctx.fillStyle = 'white';
          ctx.fillRect(
            centerX - textWidth / 2 - 3,
            centerY + labelOffset - 8,
            textWidth + 6,
            16
          );
          
          ctx.fillStyle = 'black';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(drillText, centerX, centerY + labelOffset);
        });
      };

      drawSide('front', 'Front');
      drawSide('top', 'Top');
      drawSide('bottom', 'Bottom');
      drawSide('left', 'Left');
      drawSide('right', 'Right');

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}, []);

  const generatePDF = async (
  currentEnclosureType: EnclosureType, 
  shouldRotate: boolean = false, 
  currentRotation: number = 0
): Promise<jsPDF> => {
  try {
    const dimensions = getUnwrappedDimensions(currentEnclosureType);
    const enc = ENCLOSURE_TYPES[currentEnclosureType];

    const frontW = dimensions.front.width;
    const frontH = dimensions.front.height;
    const topW = dimensions.top.width;
    const topH = dimensions.top.height;
    const bottomW = dimensions.bottom.width;
    const bottomH = dimensions.bottom.height;
    const leftW = dimensions.left.width;
    const leftH = dimensions.left.height;
    const rightW = dimensions.right.width;
    const rightH = dimensions.right.height;

    const totalWidth = leftW + frontW + rightW;
    const totalHeight = topH + frontH + bottomH;

    const displayWidth = shouldRotate ? totalHeight : totalWidth;
    const displayHeight = shouldRotate ? totalWidth : totalHeight;

    const imageData = await renderForPrintExport(currentEnclosureType, shouldRotate, currentRotation);
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const x = (pageWidth - displayWidth) / 2;
    const y = (pageHeight - displayHeight) / 2 + 20;

    pdf.setFontSize(12);
    const title = projectName ? `${projectName} - ${currentEnclosureType}` : `${currentEnclosureType} Drill Template`;
    pdf.text(title, pageWidth / 2, 10, { align: "center" });

    pdf.setFontSize(9);
    const currentUnit = unitRef.current;
    const encInfo = currentUnit === "metric" 
      ? `${enc.width}mm × ${enc.height}mm × ${enc.depth}mm | Scale: 100%`
      : `${mmToFraction(enc.width)} × ${mmToFraction(enc.height)} × ${mmToFraction(enc.depth)} | Scale: 100%`;
    pdf.text(encInfo, pageWidth / 2, 15, { align: "center" });

    if (shouldRotate) {
      pdf.setFontSize(8);
      pdf.text("(Rotated for optimal fit)", pageWidth / 2, 18, { align: "center" });
    }

    pdf.addImage(imageData, 'PNG', x, y, displayWidth, displayHeight);

    return pdf;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('Failed to generate PDF');
  }
};

  const handleExportPDF = async () => {
    try {
      const dimensions = getUnwrappedDimensions(enclosureTypeRef.current);
      const totalWidth = dimensions.left.width + dimensions.front.width + dimensions.right.width;
      const totalHeight = dimensions.top.height + dimensions.front.height + dimensions.bottom.height;
      
      const shouldRotate = totalWidth > totalHeight;
      const currentRotation = rotationRef.current;
      
      const pdf = await generatePDF(enclosureTypeRef.current, shouldRotate, currentRotation, false);
      const filename = projectName ? `${projectName}.pdf` : `${enclosureTypeRef.current}-drill-template.pdf`;
      pdf.save(filename);
      toast({
        title: "PDF Exported",
        description: "Template exported at 100% scale with high-quality rendering",
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const handlePrint = async () => {
    try {
      const dimensions = getUnwrappedDimensions(enclosureTypeRef.current);
      const totalWidth = dimensions.left.width + dimensions.front.width + dimensions.right.width;
      const totalHeight = dimensions.top.height + dimensions.front.height + dimensions.bottom.height;
      
      const shouldRotate = totalWidth > totalHeight;
      const currentRotation = rotationRef.current;
      
      const pdf = await generatePDF(enclosureTypeRef.current, shouldRotate, currentRotation, true);
      
      if (window.electronAPI?.isElectron) {
        const pdfBlob = pdf.output('blob');
        const pdfBuffer = await pdfBlob.arrayBuffer();
        
        try {
          await window.electronAPI.printPDF({
            pdfData: Array.from(new Uint8Array(pdfBuffer)),
            printOptions: {
              printBackground: true,
              scale: 1.0,
              landscape: false,
              margins: {
                marginType: 'custom',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
              }
            }
          });
          
          toast({
            title: "Print Sent",
            description: "Template sent to printer at 100% scale",
          });
          return;
        } catch (error) {
          // Fallback to PDF window
        }
      }

      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }

      toast({
        title: "Print Ready",
        description: "PDF opened for printing",
      });
    } catch (error) {
      console.error('Print failed:', error);
      toast({
        title: "Print Failed",
        description: "Failed to generate print document",
        variant: "destructive",
      });
    }
  };

  const handleSaveWithFilename = async (defaultFilename: string): Promise<void> => {
    const currentRotation = rotationRef.current;
    
    const projectState: ProjectState = {
      enclosureType,
      components,
      gridEnabled,
      gridSize,
      zoom,
      rotation: currentRotation,
      unit,
      appIcon: appIcon || undefined,
    };

    const json = JSON.stringify(projectState, null, 2);
    
    const fullFilename = defaultFilename.endsWith('.enc') ? defaultFilename : `${defaultFilename}.enc`;

    if (window.electronAPI?.isElectron) {
      try {
        const result = await window.electronAPI.saveFile({
          defaultPath: fullFilename,
          filters: [
            { name: 'Enclosure Project Files', extensions: ['enc'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result.canceled) {
          throw new Error('User canceled save operation');
        }

        const writeResult = await window.electronAPI.writeFile({
          filePath: result.filePath!,
          content: json
        });

        if (!writeResult.success) {
          throw new Error(writeResult.error || 'Failed to write file');
        }

        const savedFilename = result.filePath!.split(/[/\\]/).pop()?.replace('.enc', '') || defaultFilename;
        
        setProjectName(savedFilename);
        setProjectFilePath(result.filePath!);
        projectFilePathRef.current = result.filePath!;
        resetDirty();

        toast({
          title: "Project Saved",
          description: `Saved as ${result.filePath!.split('/').pop()}`,
        });

        return;
      } catch (err: any) {
        console.error('Electron save failed:', err);
        throw err;
      }
    }

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fullFilename,
          types: [{
            description: 'Enclosure Project Files',
            accept: { 'application/json': ['.enc'] }
          }]
        });
        
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        
        setProjectName(defaultFilename.replace('.enc', ''));
        setProjectFilePath(handle.name);
        resetDirty();
        
        toast({
          title: "Project Saved",
          description: `Saved as ${fullFilename}`,
        });
        
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('User canceled save operation');
        }
        console.warn('File System Access API failed, falling back to download:', err);
      }
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fullFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setProjectName(defaultFilename.replace('.enc', ''));
    setProjectFilePath(fullFilename);
    resetDirty();

    toast({
      title: "Project Saved",
      description: `Saved as ${fullFilename}`,
    });
  };

  const handleSave = useCallback(async () => {
    if (projectFilePathRef.current && window.electronAPI?.isElectron) {
      const currentRotation = rotationRef.current;
      
      const projectState: ProjectState = {
        enclosureType,
        components,
        gridEnabled,
        gridSize,
        zoom,
        rotation: currentRotation,
        unit,
        appIcon: appIcon || undefined,
      };

      const json = JSON.stringify(projectState, null, 2);

      try {
        const writeResult = await window.electronAPI.writeFile({
          filePath: projectFilePathRef.current,
          content: json
        });

        if (!writeResult.success) {
          throw new Error(writeResult.error || 'Failed to write file');
        }

        resetDirty();

        toast({
          title: "Project Saved",
          description: `Saved ${projectFilePathRef.current.split(/[/\\]/).pop()}`,
        });
      } catch (err: any) {
        console.error('Save failed:', err);
        toast({
          title: "Save Failed",
          description: err.message || 'Failed to save file',
          variant: "destructive",
        });
      }
    } else {
      await handleSaveAs();
    }
  }, [components, enclosureType, gridEnabled, gridSize, zoom, unit, appIcon]);

  const handleSaveAs = async () => {
    try {
      await handleSaveWithFilename(projectName || enclosureType);
    } catch (err: any) {
      if (err.message !== 'User canceled save operation') {
        console.error('Save As failed:', err);
      }
    }
  };

  const processLoadedFile = (json: string, filename: string, filePath?: string) => {
    try {
      if (filePath && projectFilePathRef.current === filePath) {
        toast({
          title: "File Already Open",
          description: `${filename} is already open`,
        });
        return;
      }
      
      const parsed = JSON.parse(json);

      const legacyComponentSchema = z.object({
        id: z.string().optional(),
        type: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        side: z.string().optional(),
      });

      const projectFileSchema = z.object({
        enclosureType: z.string().optional(),
        currentSide: z.string().optional(),
        components: z.array(legacyComponentSchema).optional(),
        gridEnabled: z.boolean().optional(),
        gridSize: z.number().optional(),
        zoom: z.any().optional(),
        rotation: z.number().optional(),
        unit: z.enum(["metric", "imperial"]).optional(),
        appIcon: z.string().optional(),
      });

      const result = projectFileSchema.safeParse(parsed);
      
      if (!result.success) {
        throw new Error("Invalid file structure");
      }

      const rawData = result.data;
      
      const SIDE_ORDER: EnclosureSide[] = ["Front", "Right", "Left", "Top", "Bottom"];

      const normalizedEnclosureType = (rawData.enclosureType && rawData.enclosureType in ENCLOSURE_TYPES)
        ? (rawData.enclosureType as EnclosureType)
        : "1590B";

      const validComponents: PlacedComponent[] = (rawData.components || [])
        .filter(c => c.type && c.type in COMPONENT_TYPES)
        .map((c, index) => {
          let side = c.side;
          if (side === "Back") side = "Front";
          if (!side || !SIDE_ORDER.includes(side as EnclosureSide)) {
            side = "Front";
          }
          
          return {
            id: c.id || `component-${Date.now()}-${index}`,
            type: c.type as ComponentType,
            x: typeof c.x === 'number' ? c.x : 0,
            y: typeof c.y === 'number' ? c.y : 0,
            side: side as EnclosureSide,
          };
        });

      let normalizedZoom = 1;
      if (typeof rawData.zoom === 'number') {
        normalizedZoom = rawData.zoom;
      } else if (rawData.zoom && typeof rawData.zoom === 'object') {
        normalizedZoom = (rawData.zoom as any).Front || 1;
      }

      const loadedRotation = typeof rawData.rotation === 'number' ? rawData.rotation : 0;

      setEnclosureType(normalizedEnclosureType);
      setComponents(validComponents);
      setGridEnabled(rawData.gridEnabled ?? true);
      setGridSize(rawData.gridSize ?? 5);
      setZoom(snapZoom(normalizedZoom));
      setRotation(loadedRotation);
      setUnit(rawData.unit ?? "metric");
      
      if (rawData.appIcon) {
        setAppIcon(rawData.appIcon);
      }
      
      setProjectName(filename.replace('.enc', ''));
      setProjectFilePath(filePath || null);
      projectFilePathRef.current = filePath || null;
      resetDirty();

      toast({
        title: "Project Loaded",
        description: `Loaded ${filename}`,
      });
    } catch (error) {
      console.error('Load error:', error);
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid Project File",
          description: `Validation error: ${error.errors[0].message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load project file",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (window.electronAPI?.isElectron && window.electronAPI.onCloseRequested) {
      const unsubscribe = window.electronAPI.onCloseRequested(() => {
        if (isDirtyRef.current) {
          setShowQuitConfirmDialog(true);
        } else {
          window.electronAPI.closeWindow();
        }
      });
      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.isElectron && window.electronAPI.onFileOpenRequest) {
      const handleFileOpenRequest = (event: any, filePath: string) => {
        if (isDirty) {
          setPendingFilePath(filePath);
          setShowOpenConfirmDialog(true);
        } else {
          openFileFromPath(filePath);
        }
      };

      const removeListener = window.electronAPI.onFileOpenRequest(handleFileOpenRequest);
      
      return () => {
        removeListener();
      };
    }
  }, [isDirty]);

  useEffect(() => {
    if (window.electronAPI) {
      const handleMenuNew = () => {
        handleNew();
      };
      const handleMenuOpen = () => {
        handleLoad();
      };
      const handleMenuSave = () => {
        handleSave();
      };
      const handleMenuSaveAs = () => {
        handleSaveAs();
      };
      const handleMenuPrint = () => {
        handlePrint();
      };
      const handleMenuExportPDF = () => {
        handleExportPDF();
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
  }, [handleNew, handleLoad, handleSave, handleSaveAs, handlePrint, handleExportPDF]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '=' || e.key === '+' || (e.code === 'Equal' && e.shiftKey)) {
        e.preventDefault();
        handleZoomIn();
      }
      else if (modifier && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
      } else if (modifier && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleLoad();
      } else if (modifier && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (modifier && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportPDF();
      } else if (modifier && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        handleQuit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [components]);

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
        onComponentMove={handleComponentMove}
        onComponentDelete={handleComponentDelete}
        selectedComponent={selectedComponent}
        onSelectComponent={setSelectedComponent}
        onCanvasClick={() => {
          setShowPalette(false);
          setShowEnclosureSelector(false);
        }}
        onZoomChange={setZoom}
        rotatesLabels={ENCLOSURE_TYPES[enclosureType].rotatesLabels || false}
      />

      <TopControls
        currentSide={undefined}
        zoom={zoom}
        fileName={projectName}
        isDirty={isDirty}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        rotationDirection={rotationDirection}
        onPrevSide={undefined}
        onNextSide={undefined}
        onNew={handleNew}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onOpen={handleLoad}
        onExportPDF={handleExportPDF}
        onPrint={handlePrint}
        onQuit={handleQuit}
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
          markDirty();
        }}
      />

      {showPalette && (
        <ComponentPalette
          onComponentSelect={handleComponentSelect}
          onClose={() => setShowPalette(false)}
          unit={unit}
        />
      )}

      <AlertDialog open={showNewConfirmDialog} onOpenChange={setShowNewConfirmDialog}>
        <AlertDialogContent data-testid="dialog-new-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save before starting a new project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-new-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleNewConfirmDiscard}
              data-testid="button-new-discard"
              className="bg-destructive hover:bg-destructive/90"
            >
              Don't Save
            </AlertDialogAction>
            <AlertDialogAction onClick={handleNewConfirmSave} data-testid="button-new-save">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showQuitConfirmDialog} onOpenChange={setShowQuitConfirmDialog}>
        <AlertDialogContent data-testid="dialog-quit-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save before quitting?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-quit-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleQuitConfirmDiscard}
              data-testid="button-quit-discard"
              className="bg-destructive hover:bg-destructive/90"
            >
              Don't Save
            </AlertDialogAction>
            <AlertDialogAction onClick={handleQuitConfirmSave} data-testid="button-quit-save">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showOpenConfirmDialog} onOpenChange={(open) => {
        if (!open) {
          handleOpenConfirmCancel();
        } else {
          setShowOpenConfirmDialog(open);
        }
      }}>
        <AlertDialogContent data-testid="dialog-open-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. What would you like to do before opening the new file?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              data-testid="button-open-cancel"
              onClick={handleOpenConfirmCancel}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleOpenConfirmDiscard}
              data-testid="button-open-discard"
              className="bg-destructive hover:bg-destructive/90"
            >
              Don't Save
            </AlertDialogAction>
            <AlertDialogAction onClick={handleOpenConfirmSave} data-testid="button-open-save">
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EnclosureSelector
        open={showEnclosureSelector}
        onClose={() => setShowEnclosureSelector(false)}
        currentType={enclosureType}
        onSelect={(type) => {
          setEnclosureType(type);
          markDirty();
        }}
        unit={unit}
      />

      <GridSelector
        open={showGridSelector}
        onOpenChange={setShowGridSelector}
        gridEnabled={gridEnabled}
        onGridEnabledChange={(enabled) => {
          setGridEnabled(enabled);
          markDirty();
        }}
        gridSize={gridSize}
        onGridSizeChange={(size) => {
          setGridSize(size);
          markDirty();
        }}
        unit={unit}
      />

      <button
        onClick={() => setShowPalette(true)}
        className="hidden lg:block absolute left-4 top-20 px-4 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover-elevate active-elevate-2 font-medium z-40"
        data-testid="button-show-palette"
      >
        Add Component
      </button>
    </div>
  );
}