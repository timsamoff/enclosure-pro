import { useRef, useEffect, useState } from "react";
import { PlacedComponent, ComponentType, COMPONENT_TYPES, EnclosureSide, MeasurementUnit } from "@/types/schema";
import { mmToFraction } from "@/lib/utils";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnclosureCanvasProps {
  width: number;
  height: number;
  components: PlacedComponent[];
  currentSide: EnclosureSide;
  zoom: number;
  rotation: number;
  gridEnabled: boolean;
  gridSize: number;
  unit: MeasurementUnit;
  onComponentMove: (id: string, x: number, y: number, side?: EnclosureSide) => void;
  onComponentDelete: (id: string) => void;
  selectedComponent: string | null;
  onSelectComponent: (id: string | null) => void;
  onCanvasClick?: () => void;
}

export default function EnclosureCanvas({
  width,
  height,
  components,
  currentSide,
  zoom,
  rotation,
  gridEnabled,
  gridSize,
  unit,
  onComponentMove,
  onComponentDelete,
  selectedComponent,
  onSelectComponent,
  onCanvasClick,
}: EnclosureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  const mmToPixels = 3.7795275591;
  const inchesToPixels = 96;

  const convertUnit = (mm: number) => {
    if (unit === "metric") {
      return `${mm.toFixed(1)}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();

    ctx.translate(rect.width / 2 + panOffset.x, rect.height / 2 + panOffset.y);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);

    const encWidth = width * mmToPixels;
    const encHeight = height * mmToPixels;

    if (gridEnabled && gridSize > 0) {
      ctx.strokeStyle = "hsl(var(--border))";
      ctx.lineWidth = 0.5 / zoom;
      
      const gridPixels = gridSize * mmToPixels;
      
      ctx.beginPath();
      for (let x = 0; x <= encWidth / 2; x += gridPixels) {
        ctx.moveTo(x, -encHeight / 2);
        ctx.lineTo(x, encHeight / 2);
        ctx.moveTo(-x, -encHeight / 2);
        ctx.lineTo(-x, encHeight / 2);
      }
      for (let y = 0; y <= encHeight / 2; y += gridPixels) {
        ctx.moveTo(-encWidth / 2, y);
        ctx.lineTo(encWidth / 2, y);
        ctx.moveTo(-encWidth / 2, -y);
        ctx.lineTo(encWidth / 2, -y);
      }
      ctx.stroke();

      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(0, -encHeight / 2);
      ctx.lineTo(0, encHeight / 2);
      ctx.moveTo(-encWidth / 2, 0);
      ctx.lineTo(encWidth / 2, 0);
      ctx.stroke();
    }

    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(-encWidth / 2, -encHeight / 2, encWidth, encHeight);

    const sideComponents = components.filter(c => c.side === currentSide);
    
    sideComponents.forEach(component => {
      const compData = COMPONENT_TYPES[component.type];
      // Guard against unknown component types (backward compatibility)
      if (!compData) return;
      // Always use metric drillSize for radius to keep circles constant
      const radius = (compData.drillSize / 2) * mmToPixels;
      
      const isSelected = component.id === selectedComponent;
      
      // Draw white fill
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(component.x, component.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw stroke on fresh path
      ctx.strokeStyle = isSelected ? "#ff8c42" : "black";
      ctx.lineWidth = (isSelected ? 3 : 1.5) / zoom;
      ctx.beginPath();
      ctx.arc(component.x, component.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      const crosshairSize = radius;
      ctx.strokeStyle = isSelected ? "#ff8c42" : "black";
      ctx.lineWidth = 0.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(component.x - crosshairSize, component.y);
      ctx.lineTo(component.x + crosshairSize, component.y);
      ctx.moveTo(component.x, component.y - crosshairSize);
      ctx.lineTo(component.x, component.y + crosshairSize);
      ctx.stroke();

      const labelOffset = radius + 15 / zoom;
      const rad = (rotation * Math.PI) / 180;
      const offsetX = Math.sin(rad) * labelOffset;
      const offsetY = Math.cos(rad) * labelOffset;
      
      ctx.save();
      ctx.translate(component.x + offsetX, component.y + offsetY);
      ctx.rotate((-rotation * Math.PI) / 180);
      
      const labelText = unit === "metric"
        ? `${compData.drillSize.toFixed(1)}mm`
        : compData.imperialLabel;
      ctx.font = `${10 / zoom}px monospace`;
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 10 / zoom;
      const padding = 4 / zoom;
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      ctx.roundRect(
        -textWidth / 2 - padding,
        -textHeight / 2 - padding,
        textWidth + padding * 2,
        textHeight + padding * 2,
        (textHeight + padding * 2) / 2
      );
      ctx.fill();
      
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(labelText, 0, 0);
      ctx.restore();
    });

    ctx.restore();
  }, [width, height, components, currentSide, zoom, rotation, gridEnabled, gridSize, unit, panOffset, selectedComponent]);

  const getMousePos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    
    const mouseX = (clientX - rect.left - canvasCenterX - panOffset.x) / zoom;
    const mouseY = (clientY - rect.top - canvasCenterY - panOffset.y) / zoom;
    
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return {
      x: mouseX * cos - mouseY * sin,
      y: mouseX * sin + mouseY * cos,
    };
  };

  const handleMouseDown = (e: React.MouseEvent | { clientX: number; clientY: number; shiftKey?: boolean; ctrlKey?: boolean }) => {
    const pos = getMousePos(e as any);
    const sideComponents = components.filter(c => c.side === currentSide);
    
    const clickedComponent = sideComponents.find(comp => {
      const compData = COMPONENT_TYPES[comp.type];
      // Always use metric drillSize for radius (hit detection)
      const radius = (compData.drillSize / 2) * mmToPixels;
      const dist = Math.sqrt((pos.x - comp.x) ** 2 + (pos.y - comp.y) ** 2);
      console.log('Checking component:', comp.type, 'at', comp.x, comp.y, 'radius:', radius, 'dist:', dist, 'clicked:', dist <= radius);
      return dist <= radius;
    });

    console.log('handleMouseDown - pos:', pos, 'clickedComponent:', clickedComponent?.type || 'none', 'sideComponents:', sideComponents.length);

    if (clickedComponent) {
      console.log('Selecting component:', clickedComponent.id);
      setDraggedComponent(clickedComponent.id);
      setDragStart({ x: pos.x - clickedComponent.x, y: pos.y - clickedComponent.y });
      setIsDragging(true);
      onSelectComponent(clickedComponent.id);
    } else {
      console.log('Deselecting - calling onSelectComponent(null)');
      onSelectComponent(null);
      onCanvasClick?.();
      if (e.shiftKey || e.ctrlKey) {
        setIsPanning(true);
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent | { clientX: number; clientY: number }) => {
    if (draggedComponent) {
      const pos = getMousePos(e as any);
      let newX = pos.x - dragStart.x;
      let newY = pos.y - dragStart.y;

      if (gridEnabled && gridSize > 0) {
        const gridPixels = gridSize * mmToPixels;
        newX = Math.round(newX / gridPixels) * gridPixels;
        newY = Math.round(newY / gridPixels) * gridPixels;
      }

      onComponentMove(draggedComponent, newX, newY);
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedComponent(null);
    setIsPanning(false);
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        (touch2.clientX - touch1.clientX) ** 2 + (touch2.clientY - touch1.clientY) ** 2
      );
      setLastTouchDistance(distance);
      setIsPanning(true);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      setDragStart({ x: centerX - panOffset.x, y: centerY - panOffset.y });
    } else if (e.touches.length === 1) {
      handleMouseDown({ ...e, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPanning) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      setPanOffset({
        x: centerX - dragStart.x,
        y: centerY - dragStart.y,
      });
    } else if (e.touches.length === 1) {
      handleMouseMove({ ...e, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as any);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDistance(null);
    handleMouseUp();
  };

  const getComponentScreenPosition = (component: PlacedComponent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const rotatedX = component.x * cos - component.y * sin;
    const rotatedY = component.x * sin + component.y * cos;

    const screenX = canvasCenterX + (rotatedX * zoom) + panOffset.x;
    const screenY = canvasCenterY + (rotatedY * zoom) + panOffset.y;

    return { x: screenX, y: screenY };
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-background"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
        data-testid="canvas-enclosure"
      />
      {components.filter(c => c.side === currentSide && c.id === selectedComponent).map(component => {
        const pos = getComponentScreenPosition(component);
        if (!pos) return null;
        
        const compData = COMPONENT_TYPES[component.type];
        // Always use metric drillSize for radius to keep circles constant
        const radius = (compData.drillSize / 2) * mmToPixels * zoom;
        
        return (
          <button
            key={component.id}
            className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-white border-2 border-black flex items-center justify-center hover-elevate active-elevate-2 shadow-md z-[200]"
            style={{
              left: `${pos.x + radius * 0.7}px`,
              top: `${pos.y - radius * 0.7}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onComponentDelete(component.id);
              onSelectComponent(null);
            }}
            data-testid={`button-delete-${component.id}`}
          >
            <X className="w-3 h-3 text-black" />
          </button>
        );
      })}
      
      {selectedComponent && (
        <Button
          size="icon"
          variant="default"
          className="absolute bottom-4 right-4 z-[200] bg-[#ff8c42] hover:bg-[#ff8c42] border-[#ff8c42]"
          onClick={(e) => {
            e.stopPropagation();
            onComponentDelete(selectedComponent);
            onSelectComponent(null);
          }}
          data-testid="button-delete-selected"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
