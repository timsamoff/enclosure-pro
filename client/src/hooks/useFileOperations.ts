import { useState, useRef, useCallback } from "react";
import { 
  PlacedComponent, 
  ComponentType, 
  EnclosureSide, 
  MeasurementUnit, 
  EnclosureType, 
  ENCLOSURE_TYPES, 
  COMPONENT_TYPES, 
  ProjectState 
} from "@/types/schema";
import { z } from "zod";
import { snapZoom } from "@/lib/zoom";

interface UseFileOperationsProps {
  enclosureType: EnclosureType | null;
  components: PlacedComponent[];
  gridEnabled: boolean;
  gridSize: number;
  zoom: number;
  rotation: number;
  unit: MeasurementUnit;
  appIcon: string | null;
  setEnclosureType: (type: EnclosureType | null) => void;
  setComponents: (components: PlacedComponent[]) => void;
  setGridEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setZoom: (zoom: number) => void;
  setRotation: (rotation: number) => void;
  setUnit: (unit: MeasurementUnit) => void;
  setProjectName: (name: string) => void;
  setProjectFilePath: (path: string | null) => void;
  toast: any;
}

export function useFileOperations({
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
}: UseFileOperationsProps) {
  const [projectName, setLocalProjectName] = useState("");
  const [projectFilePath, setLocalProjectFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showNewConfirmDialog, setShowNewConfirmDialog] = useState(false);
  const [showQuitConfirmDialog, setShowQuitConfirmDialog] = useState(false);
  const [showOpenConfirmDialog, setShowOpenConfirmDialog] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);

  const isDirtyRef = useRef(false);
  const projectFilePathRef = useRef<string | null>(null);

  // Update local state setters to also update parent state
  const updateProjectName = (name: string) => {
    setLocalProjectName(name);
    setProjectName(name);
  };

  const updateProjectFilePath = (path: string | null) => {
    setLocalProjectFilePath(path);
    setProjectFilePath(path);
    projectFilePathRef.current = path;
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
    setEnclosureType(null);
    setComponents([]);
    setGridEnabled(true);
    setGridSize(5);
    setZoom(snapZoom(1));
    setRotation(0);
    setUnit("metric");
    updateProjectName("");
    updateProjectFilePath(null);
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

  const performLoad = async (): Promise<string | null> => {
    if (window.electronAPI?.isElectron) {
      try {
        const result = await window.electronAPI.openFile({
          filters: [
            { name: 'Enclosure Project Files', extensions: ['enc'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (result.canceled || !result.filePath) {
          return null;
        }

        return result.filePath;
      } catch (error) {
        console.error('Electron file selection failed:', error);
        toast({
          title: "File Selection Failed",
          description: "Failed to select file",
          variant: "destructive",
        });
        return null;
      }
    }

    return new Promise<{filePath: string; content: string} | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.enc';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve({ filePath: file.name, content: reader.result as string });
        };
       reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  };

  const handleLoad = async () => {
    if (isDirty) {
      // Store the load action to be performed after confirmation
      const filePath = await performLoad();
      if (filePath) {
        setPendingFilePath(filePath);
        setShowOpenConfirmDialog(true);
      }
    } else {
      const filePath = await performLoad();
      if (filePath) {
        await openFileFromPath(filePath);
      }
    }
  };

  const openFileFromPath = async (filePath: string) => {
    try {
      let fileContent: string;
      
      if (window.electronAPI?.isElectron) {
        const result = await window.electronAPI.readFile({
          filePath: filePath
        });

        if (!result.success || !result.content) {
          throw new Error(result.error || 'Failed to read file');
        }
        fileContent = result.content;
      } else {
        // For web, we'd need to handle this differently
        throw new Error('File reading not supported in web mode');
      }

      const filename = filePath.split(/[/\\]/).pop() || 'untitled.enc';
      processLoadedFile(fileContent, filename, filePath);
      
    } catch (error) {
      console.error('Error opening file from path:', error);
      toast({
        title: "Open Failed",
        description: `Failed to open ${filePath.split(/[/\\]/).pop()}`,
        variant: "destructive",
      });
    }
  };

  const handleSaveForOpen = async (): Promise<boolean> => {
    try {
      // If project has a file path, save directly
      if (projectFilePathRef.current) {
        await handleSave();
        return true;
      } else {
        // If no file path, trigger Save As
        await handleSaveAs();
        return true;
      }
    } catch (error: any) {
      if (error.message === 'User canceled save operation') {
        console.log('Save was canceled by user');
        return false;
      }
      console.error('Save for open failed:', error);
      toast({
        title: "Save Failed",
        description: error.message || 'Failed to save file',
        variant: "destructive",
      });
      return false;
    }
  };

  const handleOpenConfirmSave = async () => {
    setShowOpenConfirmDialog(false);
    try {
      const saveSuccess = await handleSaveForOpen();
      if (saveSuccess && pendingFilePath) {
        await openFileFromPath(pendingFilePath);
        setPendingFilePath(null);
      } else if (!saveSuccess) {
        // Save was canceled or failed, cancel the open operation
        toast({
          title: "Open Canceled",
          description: "File open was canceled because save failed or was canceled",
        });
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

  const handleSaveWithFilename = async (defaultFilename: string): Promise<void> => {
    const projectState: ProjectState = {
      enclosureType: enclosureType || undefined,
      components,
      gridEnabled,
      gridSize,
      zoom,
      rotation,
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
        
        updateProjectName(savedFilename);
        updateProjectFilePath(result.filePath!);
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
        
        updateProjectName(defaultFilename.replace('.enc', ''));
        updateProjectFilePath(handle.name);
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

    updateProjectName(defaultFilename.replace('.enc', ''));
    updateProjectFilePath(fullFilename);
    resetDirty();

    toast({
      title: "Project Saved",
      description: `Saved as ${fullFilename}`,
    });
  };

  const handleSave = useCallback(async () => {
    if (projectFilePathRef.current && window.electronAPI?.isElectron) {
      const projectState: ProjectState = {
        enclosureType: enclosureType || undefined,
        components,
        gridEnabled,
        gridSize,
        zoom,
        rotation,
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
        return true;
      } catch (err: any) {
        console.error('Save failed:', err);
        toast({
          title: "Save Failed",
          description: err.message || 'Failed to save file',
          variant: "destructive",
        });
        throw err;
      }
    } else {
      try {
        await handleSaveAs();
        return true;
      } catch (err: any) {
        throw err;
      }
    }
  }, [components, enclosureType, gridEnabled, gridSize, zoom, rotation, unit, appIcon]);

  const handleSaveAs = async () => {
    try {
      await handleSaveWithFilename(projectName || enclosureType || "untitled");
      return true;
    } catch (err: any) {
      if (err.message !== 'User canceled save operation') {
        console.error('Save As failed:', err);
        toast({
          title: "Save As Failed",
          description: err.message || 'Failed to save file',
          variant: "destructive",
        });
      }
      throw err;
    }
  };

  const processLoadedFile = (json: string, filename: string, filePath?: string) => {
    try {
      // Only skip if it's the same file AND there are no unsaved changes
      // If there are unsaved changes, let the confirmation dialog handle it
      if (filePath && projectFilePathRef.current === filePath && !isDirtyRef.current) {
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
        rotation: z.number().optional(),
        excludeFromPrint: z.boolean().optional(),
      });

      const projectFileSchema = z.object({
        enclosureType: z.string().optional().nullable(),
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
        : null;

      const validComponents: PlacedComponent[] = (rawData.components || [])
        .filter(c => c.type && c.type in COMPONENT_TYPES)
        .map((c, index) => {
          let side = c.side;
          if (side === "Back") side = "Front";
          if (!side || !SIDE_ORDER.includes(side as EnclosureSide)) {
            side = "Front";
          }
          
          const compData = COMPONENT_TYPES[c.type as ComponentType];
          const isFootprintGuide = compData.category === "Footprint Guides (not printed)";
          
          return {
            id: c.id || `component-${Date.now()}-${index}`,
            type: c.type as ComponentType,
            x: typeof c.x === 'number' ? c.x : 0,
            y: typeof c.y === 'number' ? c.y : 0,
            side: side as EnclosureSide,
            rotation: typeof c.rotation === 'number' ? c.rotation : 0,
            excludeFromPrint: typeof c.excludeFromPrint === 'boolean' ? c.excludeFromPrint : isFootprintGuide,
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
        // appIcon is handled by parent
      }
      
      updateProjectName(filename.replace('.enc', ''));
      updateProjectFilePath(filePath || null);
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

  return {
    projectName,
    projectFilePath,
    isDirty,
    markDirty,
    resetDirty,
    showNewConfirmDialog,
    showQuitConfirmDialog,
    showOpenConfirmDialog,
    pendingFilePath,
    setShowNewConfirmDialog,
    setShowQuitConfirmDialog,
    setShowOpenConfirmDialog,
    setPendingFilePath,
    performNewProject,
    handleNew,
    handleNewConfirmSave,
    handleNewConfirmDiscard,
    handleQuit,
    handleQuitConfirmSave,
    handleQuitConfirmDiscard,
    handleLoad,
    handleOpenConfirmSave,
    handleOpenConfirmDiscard,
    handleOpenConfirmCancel,
    handleSave,
    handleSaveAs,
    processLoadedFile,
    openFileFromPath
  };
}