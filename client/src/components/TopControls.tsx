import { Minus, Plus, RotateCw, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnclosureSide } from "@/types/schema";
import FileDropdownMenu from "./FileDropdownMenu";
import AppIconMenu from "./AppIconMenu";

interface TopControlsProps {
  currentSide?: EnclosureSide;
  zoom: number;
  fileName: string;
  isDirty: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate?: () => void;
  rotationDirection?: 'cw' | 'ccw';
  onPrevSide?: () => void;
  onNextSide?: () => void;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  onQuit: () => void;
}

export default function TopControls({
  currentSide,
  zoom,
  fileName,
  isDirty,
  onZoomIn,
  onZoomOut,
  onRotate,
  rotationDirection = 'cw',
  onPrevSide,
  onNextSide,
  onNew,
  onSave,
  onSaveAs,
  onOpen,
  onExportPDF,
  onPrint,
  onQuit,
}: TopControlsProps) {
  return (
    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-md border-b border-border z-[100]">
      {/* Left: App icon menu */}
      <AppIconMenu />

      {/* Center: Main controls */}
      <div className="flex-1 flex items-center justify-center gap-3">
        {/* Side navigation - only shown in legacy single-side view */}
        {currentSide && onPrevSide && onNextSide && (
          <div className="flex items-center gap-1 border-r border-border pr-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={onPrevSide}
              data-testid="button-prev-side"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center" data-testid="text-current-side">
              {currentSide}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={onNextSide}
              data-testid="button-next-side"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Zoom controls - always shown */}
        <div className={`flex items-center gap-1 ${onRotate ? 'border-r border-border pr-4' : ''}`}>
          <Button
            size="icon"
            variant="ghost"
            onClick={onZoomOut}
            data-testid="button-zoom-out"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-sm font-mono min-w-[50px] text-center" data-testid="text-zoom">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={onZoomIn}
            data-testid="button-zoom-in"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Rotation - shown in unwrapped view */}
        {onRotate && (
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            data-testid="button-rotate"
            aria-label={rotationDirection === 'cw' ? 'Rotate 90° clockwise' : 'Rotate 90° counterclockwise'}
          >
            {rotationDirection === 'cw' ? (
              <RotateCw className="w-4 h-4" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Right: File dropdown menu */}
      <FileDropdownMenu
        fileName={fileName}
        isDirty={isDirty}
        onNew={onNew}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onOpen={onOpen}
        onPrint={onPrint}
        onExportPDF={onExportPDF}
        onQuit={onQuit}
      />
    </div>
  );
}