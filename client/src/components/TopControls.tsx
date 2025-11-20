import { 
  FilePlus, 
  FolderOpen, 
  Save, 
  Download, 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw,
  X
} from "lucide-react";
import { shortcuts } from "@/lib/hotkeys";

interface TopControlsProps {
  currentSide: string | undefined;
  zoom: number;
  fileName: string;
  isDirty: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  rotationDirection: 'cw' | 'ccw';
  onPrevSide: (() => void) | undefined;
  onNextSide: (() => void) | undefined;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  onQuit: () => void;
}

export default function TopControls({
  zoom,
  fileName,
  isDirty,
  onZoomIn,
  onZoomOut,
  onRotate,
  rotationDirection,
  onNew,
  onSave,
  onSaveAs,
  onOpen,
  onExportPDF,
  onPrint,
  onQuit,
}: TopControlsProps) {
  const displayFileName = fileName || "Untitled";

  return (
    <div className="absolute top-0 left-0 right-0 h-16 bg-background border-b border-border flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-2">
        <button
          onClick={onNew}
          className="px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2"
          data-testid="button-new"
        >
          <FilePlus className="w-5 h-5" />
          <span>New</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
            {shortcuts.new}
          </kbd>
        </button>
        
        <button
          onClick={onOpen}
          className="px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2"
          data-testid="button-open"
        >
          <FolderOpen className="w-5 h-5" />
          <span>Open</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
            {shortcuts.open}
          </kbd>
        </button>
        
        <button
          onClick={onSave}
          disabled={!isDirty}
          className="px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-save"
        >
          <Save className="w-5 h-5" />
          <span>Save</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
            {shortcuts.save}
          </kbd>
        </button>
        
        <button
          onClick={onSaveAs}
          className="px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2"
          data-testid="button-save-as"
        >
          <Save className="w-5 h-5" />
          <span>Save As</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
            {shortcuts.saveAs}
          </kbd>
        </button>

        <div className="w-px h-8 bg-border mx-2" />

        <button
          onClick={onPrint}
          className="px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2"
          data-testid="button-print"
        >
          <Printer className="w-5 h-5" />
          <span>Print</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
            {shortcuts.print}
          </kbd>
        </button>
        
        <button
          onClick={onExportPDF}
          className="px-3 py-2 hover:bg-accent rounded-md flex items-center gap-2"
          data-testid="button-export-pdf"
        >
          <Download className="w-5 h-5" />
          <span>Export PDF</span>
          <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
            {shortcuts.exportPDF}
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium px-3">
          {displayFileName}
          {isDirty && " •"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onZoomOut}
          className="p-2 hover:bg-accent rounded-md"
          data-testid="button-zoom-out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        
        <span className="text-sm font-medium min-w-[60px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        
        <button
          onClick={onZoomIn}
          className="p-2 hover:bg-accent rounded-md"
          data-testid="button-zoom-in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-border mx-2" />

        <button
          onClick={onRotate}
          className="p-2 hover:bg-accent rounded-md"
          data-testid="button-rotate"
        >
          {rotationDirection === 'cw' ? (
            <RotateCw className="w-5 h-5" />
          ) : (
            <RotateCcw className="w-5 h-5" />
          )}
        </button>

        {window.electronAPI?.isElectron && (
          <>
            <div className="w-px h-8 bg-border mx-2" />
            <button
              onClick={onQuit}
              className="p-2 hover:bg-accent rounded-md"
              data-testid="button-quit"
            >
              <X className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}