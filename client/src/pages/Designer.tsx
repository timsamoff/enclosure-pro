import { useState, useEffect, useRef } from "react";
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
          console.log('Icon not found, continuing without it');
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
        console.log('Icon not available:', error.message);
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
    console.log('=== handleNew called ===');
    console.log('isDirty:', isDirty);
    console.log('components.length:', components.length);
    
    // Only ask to save if the project has unsaved changes
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
      // Only perform new project after save completes
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
      // Only quit after save completes
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

  const handleOpenConfirmSave = async () => {
    setShowOpenConfirmDialog(false);
    try {
      await handleSave();
      // Only load new file after save completes
      await performLoad();
    } catch (error) {
      console.error('Save failed, not opening file:', error);
    }
  };

  const handleOpenConfirmDiscard = async () => {
    setShowOpenConfirmDialog(false);
    await performLoad();
  };

  const handleZoomIn = () => {
    setZoom(prev => snapZoom(prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoom(prev => snapZoom(prev - 0.1));
  };

  const handleRotate = () => {
    setRotation(prev => prev === 0 ? 90 : 0);
  };

  const rotationDirection: 'cw' | 'ccw' = rotation === 0 ? 'cw' : 'ccw';

  const handleComponentMove = (id: string, x: number, y: number, side?: EnclosureSide) => {
    setComponents(prev =>
      prev.map(c => (c.id === id ? { ...c, x, y, ...(side && { side }) } : c))
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

  // Function to render the enclosure at 1:1 scale for printing/export
  const renderForPrintExport = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const mmToPixels = 3.7795275591;
        const dimensions = getUnwrappedDimensions(enclosureType);

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

        const totalWidthMM = leftW + frontW + rightW;
        const totalHeightMM = topH + frontH + bottomH;

        const printDPI = 300;
        const pixelsPerMM = printDPI / 25.4;
        
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

        const topOffsetX = (frontW - topW) / 2;
        const bottomOffsetX = (frontW - bottomW) / 2;
        const leftOffsetY = (frontH - leftH) / 2;
        const rightOffsetY = (frontH - rightH) / 2;

        const layout = {
          front: { x: leftW, y: topH, width: frontW, height: frontH },
          top: { x: leftW + topOffsetX, y: 0, width: topW, height: topH },
          bottom: { x: leftW + bottomOffsetX, y: topH + frontH, width: bottomW, height: bottomH },
          left: { x: 0, y: topH + leftOffsetY, width: leftW, height: leftH },
          right: { x: leftW + frontW, y: topH + rightOffsetY, width: rightW, height: rightH },
        };

        const scale = pixelsPerMM;

        const drawSide = (sideKey: keyof typeof layout, label: string) => {
          const side = layout[sideKey];
          const x = side.x * scale;
          const y = side.y * scale;
          const w = side.width * scale;
          const h = side.height * scale;

          ctx.strokeStyle = 'black';
          ctx.lineWidth = 1;
          
          if (sideKey === 'front') {
            const cornerRadius = 5 * scale;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, cornerRadius);
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, w, h);
          }

          ctx.fillStyle = 'black';
          ctx.font = `${36 * scale / pixelsPerMM}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + w / 2, y + h / 2);

          const sideComponents = components.filter(c => c.side === label);
          sideComponents.forEach(component => {
            const compData = COMPONENT_TYPES[component.type];
            const radius = (compData.drillSize / 2) * scale;

            const compX = (component.x / mmToPixels) * scale;
            const compY = (component.y / mmToPixels) * scale;

            const centerX = x + (w / 2 + compX);
            const centerY = y + (h / 2 + compY);

            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();

            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.stroke();

            const crosshairSize = Math.max(radius, 3 * scale);
            ctx.beginPath();
            ctx.moveTo(centerX - crosshairSize, centerY);
            ctx.lineTo(centerX + crosshairSize, centerY);
            ctx.moveTo(centerX, centerY - crosshairSize);
            ctx.lineTo(centerX, centerY + crosshairSize);
            ctx.stroke();

            const drillText = unit === "metric"
              ? `${compData.drillSize.toFixed(1)}mm`
              : compData.imperialLabel;
            
            const labelOffset = 3 * scale;
            
            ctx.font = `${28 * scale / pixelsPerMM}px Arial`;
            const textMetrics = ctx.measureText(drillText);
            const textWidth = textMetrics.width;
            const textHeight = 14 * scale / pixelsPerMM;
            const padding = 2 * scale / pixelsPerMM;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(
              centerX - textWidth / 2 - padding,
              centerY + radius + labelOffset - textHeight / 2 - padding,
              textWidth + padding * 2,
              textHeight + padding * 2
            );
            
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(drillText, centerX, centerY + radius + labelOffset);
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
  };

  const generatePDF = async (): Promise<jsPDF> => {
    try {
      const imageData = await renderForPrintExport();
      
      const dimensions = getUnwrappedDimensions(enclosureType);
      const mmToPixels = 3.7795275591;

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

      const orientation = totalWidth > totalHeight ? "landscape" : "portrait";
      
      const requiredWidth = totalWidth + 40;
      const requiredHeight = totalHeight + 60;
      
      let pageFormat: string | number[];
      let pageWidth: number;
      let pageHeight: number;
      let pageName: string;
      
      const A5 = { width: 148, height: 210, name: "A5" };
      const A4 = { width: 210, height: 297, name: "A4" };
      const A3 = { width: 297, height: 420, name: "A3" };
      const A2 = { width: 420, height: 594, name: "A2" };
      
      if (orientation === "landscape") {
        if (requiredWidth <= A5.height && requiredHeight <= A5.width) {
          pageFormat = "a5";
          pageWidth = A5.height;
          pageHeight = A5.width;
          pageName = A5.name;
        } else if (requiredWidth <= A4.height && requiredHeight <= A4.width) {
          pageFormat = "a4";
          pageWidth = A4.height;
          pageHeight = A4.width;
          pageName = A4.name;
        } else if (requiredWidth <= A3.height && requiredHeight <= A3.width) {
          pageFormat = "a3";
          pageWidth = A3.height;
          pageHeight = A3.width;
          pageName = A3.name;
        } else if (requiredWidth <= A2.height && requiredHeight <= A2.width) {
          pageFormat = "a2";
          pageWidth = A2.height;
          pageHeight = A2.width;
          pageName = A2.name;
        } else {
          pageWidth = Math.ceil(requiredWidth / 10) * 10;
          pageHeight = Math.ceil(requiredHeight / 10) * 10;
          pageFormat = [pageWidth, pageHeight];
          pageName = "Custom";
        }
      } else {
        if (requiredWidth <= A5.width && requiredHeight <= A5.height) {
          pageFormat = "a5";
          pageWidth = A5.width;
          pageHeight = A5.height;
          pageName = A5.name;
        } else if (requiredWidth <= A4.width && requiredHeight <= A4.height) {
          pageFormat = "a4";
          pageWidth = A4.width;
          pageHeight = A4.height;
          pageName = A4.name;
        } else if (requiredWidth <= A3.width && requiredHeight <= A3.height) {
          pageFormat = "a3";
          pageWidth = A3.width;
          pageHeight = A3.height;
          pageName = A3.name;
        } else if (requiredWidth <= A2.width && requiredHeight <= A2.height) {
          pageFormat = "a2";
          pageWidth = A2.width;
          pageHeight = A2.height;
          pageName = A2.name;
        } else {
          pageWidth = Math.ceil(requiredWidth / 10) * 10;
          pageHeight = Math.ceil(requiredHeight / 10) * 10;
          pageFormat = [pageWidth, pageHeight];
          pageName = "Custom";
        }
      }
      
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: pageFormat,
      });

      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      const maxHeight = pageHeight - (margin * 2) - 20;

      const imageWidth = totalWidth;
      const imageHeight = totalHeight;

      const x = (pageWidth - imageWidth) / 2;
      const y = margin + 20;

      pdf.setFontSize(14);
      const title = projectName ? `${projectName} - Drill Template` : `${enclosureType} - Drill Template`;
      pdf.text(title, pageWidth / 2, 15, { align: "center" });

      const enc = ENCLOSURE_TYPES[enclosureType];
      pdf.setFontSize(10);
      const encInfo = `${enclosureType}: ${enc.width}mm × ${enc.height}mm × ${enc.depth}mm`;
      pdf.text(encInfo, pageWidth / 2, 22, { align: "center" });

      pdf.setFontSize(8);
      const pageInfo = pageName === "Custom" 
        ? `Scale: 100% (Actual Size) | Page: ${Math.round(pageWidth)}×${Math.round(pageHeight)}mm`
        : `Scale: 100% (Actual Size) | Page: ${pageName}`;
      pdf.text(pageInfo, pageWidth / 2, 28, { align: "center" });

      pdf.addImage(imageData, 'PNG', x, y, imageWidth, imageHeight);

      return pdf;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF');
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdf = await generatePDF();
      const filename = projectName ? `${projectName}.pdf` : `${enclosureType}-drill-template.pdf`;
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
      const pdf = await generatePDF();
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      toast({
        title: "Print Ready",
        description: "Template prepared for printing at 100% scale",
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
    console.log('=== SAVING FILE ===');
    console.log('Number of components to save:', components.length);
    console.log('Components:', JSON.stringify(components, null, 2));
    
    const projectState: ProjectState = {
      enclosureType,
      components,
      gridEnabled,
      gridSize,
      zoom,
      unit,
      appIcon: appIcon || undefined,
    };

    const json = JSON.stringify(projectState, null, 2);
    console.log('JSON being saved (first 500 chars):', json.substring(0, 500));
    
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

        console.log('Save dialog result:', result);

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
        console.log('File saved successfully to:', result.filePath);
        
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
        
        console.log('File saved via File System Access API');
        
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

    console.log('File downloaded as:', fullFilename);

    setProjectName(defaultFilename.replace('.enc', ''));
    setProjectFilePath(fullFilename);
    resetDirty();

    toast({
      title: "Project Saved",
      description: `Saved as ${fullFilename}`,
    });
  };

  const handleSave = async () => {
    console.log('=== handleSave called ===');
    console.log('Current components count:', components.length);
    console.log('projectFilePathRef.current:', projectFilePathRef.current);
    
    if (projectFilePathRef.current && window.electronAPI?.isElectron) {
      console.log('Taking SAVE path (overwrite existing file)');
      
      const projectState: ProjectState = {
        enclosureType,
        components,
        gridEnabled,
        gridSize,
        zoom,
        unit,
        appIcon: appIcon || undefined,
      };

      const json = JSON.stringify(projectState, null, 2);
      console.log('Saving', components.length, 'components to existing file');

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
      console.log('Taking SAVE AS path (no file path yet)');
      await handleSaveAs();
    }
  };

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
      console.log('=== LOADING FILE ===');
      console.log('Filename:', filename);
      console.log('FilePath:', filePath);
      console.log('Current projectFilePathRef:', projectFilePathRef.current);
      
      // If loading the same file that's already open, don't proceed
      if (filePath && projectFilePathRef.current === filePath) {
        console.log('Same file already open, skipping load');
        toast({
          title: "File Already Open",
          description: `${filename} is already open`,
        });
        return;
      }
      
      console.log('Raw JSON (first 500 chars):', json.substring(0, 500));
      
      const parsed = JSON.parse(json);
      console.log('Parsed data:', parsed);
      console.log('Number of components in file:', parsed.components?.length || 0);

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
        rotation: z.any().optional(),
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

      console.log('Valid components after processing:', validComponents.length);
      console.log('Components being loaded:', JSON.stringify(validComponents, null, 2));

      let normalizedZoom = 1;
      if (typeof rawData.zoom === 'number') {
        normalizedZoom = rawData.zoom;
      } else if (rawData.zoom && typeof rawData.zoom === 'object') {
        normalizedZoom = (rawData.zoom as any).Front || 1;
      }

      setEnclosureType(normalizedEnclosureType);
      setComponents(validComponents);
      console.log('setComponents called with', validComponents.length, 'components');
      
      setGridEnabled(rawData.gridEnabled ?? true);
      setGridSize(rawData.gridSize ?? 5);
      setZoom(snapZoom(normalizedZoom));
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
        console.log('=== CTRL+S pressed ===');
        console.log('Components before save:', components.length);
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

      <AlertDialog open={showOpenConfirmDialog} onOpenChange={setShowOpenConfirmDialog}>
        <AlertDialogContent data-testid="dialog-open-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save before opening another file?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-open-cancel">Cancel</AlertDialogCancel>
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