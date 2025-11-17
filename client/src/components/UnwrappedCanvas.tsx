import { useRef, useEffect, useState } from "react";
import { PlacedComponent, ComponentType, COMPONENT_TYPES, EnclosureSide, MeasurementUnit, EnclosureType, getUnwrappedDimensions, CORNER_RADIUS } from "@/types/schema";
import { mmToFraction } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { snapZoom } from "@/lib/zoom";

interface UnwrappedCanvasProps {
  enclosureType: EnclosureType;
  components: PlacedComponent[];
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
  onZoomChange?: (newZoom: number) => void;
}

export default function UnwrappedCanvas({
  enclosureType,
  components,
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
  onZoomChange,
}: UnwrappedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [justFinishedDrag, setJustFinishedDrag] = useState(false);
  const [resizeTrigger, setResizeTrigger] = useState(0);

  const mmToPixels = 3.7795275591;
  const dimensions = getUnwrappedDimensions(enclosureType);

  const convertUnit = (mm: number) => {
    if (unit === "metric") {
      return `${mm.toFixed(1)}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  // Calculate layout offsets for each side in the cross pattern
  const getLayout = () => {
    const frontW = dimensions.front.width * mmToPixels;
    const frontH = dimensions.front.height * mmToPixels;
    const topW = dimensions.top.width * mmToPixels;
    const topH = dimensions.top.height * mmToPixels;
    const bottomW = dimensions.bottom.width * mmToPixels;
    const bottomH = dimensions.bottom.height * mmToPixels;
    const leftW = dimensions.left.width * mmToPixels;
    const leftH = dimensions.left.height * mmToPixels;
    const rightW = dimensions.right.width * mmToPixels;
    const rightH = dimensions.right.height * mmToPixels;

    // Calculate total canvas size
    const totalWidth = leftW + frontW + rightW;
    const totalHeight = topH + frontH + bottomH;

    // Center top/bottom horizontally with front, center left/right vertically with front
    const topOffsetX = (frontW - topW) / 2;
    const bottomOffsetX = (frontW - bottomW) / 2;
    const leftOffsetY = (frontH - leftH) / 2;
    const rightOffsetY = (frontH - rightH) / 2;

    return {
      front: { x: leftW, y: topH, width: frontW, height: frontH },
      top: { x: leftW + topOffsetX, y: 0, width: topW, height: topH },
      bottom: { x: leftW + bottomOffsetX, y: topH + frontH, width: bottomW, height: bottomH },
      left: { x: 0, y: topH + leftOffsetY, width: leftW, height: leftH },
      right: { x: leftW + frontW, y: topH + rightOffsetY, width: rightW, height: rightH },
      totalWidth,
      totalHeight,
    };
  };

  const layout = getLayout();

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

    // Center the cross layout and apply zoom and rotation
    const centerX = rect.width / 2 + panOffset.x;
    const centerY = rect.height / 2 + panOffset.y;
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    
    // Offset to center the cross layout
    ctx.translate(-layout.totalWidth / 2, -layout.totalHeight / 2);

    // Draw each side
    const drawSide = (side: keyof typeof layout, label: string) => {
      if (side === 'totalWidth' || side === 'totalHeight') return;
      
      const sideLayout = layout[side];
      const sideData = dimensions[side];
      
      ctx.save();
      ctx.translate(sideLayout.x, sideLayout.y);

      // Draw grid if enabled
      if (gridEnabled && gridSize > 0) {
        ctx.strokeStyle = "hsl(var(--border))";
        ctx.lineWidth = 0.5 / zoom;
        
        const gridPixels = gridSize * mmToPixels;
        const edgeMargin = 2 * mmToPixels; // 2mm buffer from edges
        
        // Check if we have room for edge margins
        const hasRoomForMargins = sideLayout.width > edgeMargin * 2 && sideLayout.height > edgeMargin * 2;
        
        ctx.beginPath();
        for (let x = 0; x <= sideLayout.width / 2; x += gridPixels) {
          const posX = sideLayout.width / 2 + x;
          const negX = sideLayout.width / 2 - x;
          
          // Always draw center line (x === 0), otherwise check margins if applicable
          if (x === 0 || !hasRoomForMargins || (posX > edgeMargin && posX < sideLayout.width - edgeMargin)) {
            if (x === 0 || posX < sideLayout.width) { // Center or within bounds
              ctx.moveTo(posX, 0);
              ctx.lineTo(posX, sideLayout.height);
            }
          }
          if (x > 0 && (!hasRoomForMargins || (negX > edgeMargin && negX < sideLayout.width - edgeMargin))) {
            if (negX > 0) {
              ctx.moveTo(negX, 0);
              ctx.lineTo(negX, sideLayout.height);
            }
          }
        }
        for (let y = 0; y <= sideLayout.height / 2; y += gridPixels) {
          const posY = sideLayout.height / 2 + y;
          const negY = sideLayout.height / 2 - y;
          
          // Always draw center line (y === 0), otherwise check margins if applicable
          if (y === 0 || !hasRoomForMargins || (posY > edgeMargin && posY < sideLayout.height - edgeMargin)) {
            if (y === 0 || posY < sideLayout.height) {
              ctx.moveTo(0, posY);
              ctx.lineTo(sideLayout.width, posY);
            }
          }
          if (y > 0 && (!hasRoomForMargins || (negY > edgeMargin && negY < sideLayout.height - edgeMargin))) {
            if (negY > 0) {
              ctx.moveTo(0, negY);
              ctx.lineTo(sideLayout.width, negY);
            }
          }
        }
        ctx.stroke();

        // Center lines
        ctx.strokeStyle = "hsl(var(--foreground))";
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.moveTo(sideLayout.width / 2, 0);
        ctx.lineTo(sideLayout.width / 2, sideLayout.height);
        ctx.moveTo(0, sideLayout.height / 2);
        ctx.lineTo(sideLayout.width, sideLayout.height / 2);
        ctx.stroke();
      }

      // Draw side border with corner radii for front face
      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = 2 / zoom;
      
      if (side === 'front') {
        // Add corner radii to front face (5mm standard for Hammond enclosures)
        const cornerRadius = 5 * mmToPixels;
        ctx.beginPath();
        ctx.roundRect(0, 0, sideLayout.width, sideLayout.height, cornerRadius);
        ctx.stroke();
      } else {
        ctx.strokeRect(0, 0, sideLayout.width, sideLayout.height);
      }

      // DRAW SIDE LABEL - with rotation compensation to keep readable
      ctx.save();
      // Translate to center of side
      ctx.translate(sideLayout.width / 2, sideLayout.height / 2);
      // Rotate back to cancel out the enclosure rotation
      const rotRad = (-rotation * Math.PI) / 180;
      ctx.rotate(rotRad);
      // Now draw the text at origin (which is now the center)
      ctx.fillStyle = "hsl(var(--foreground))";
      ctx.font = `${14 / zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0);
      ctx.restore();

      // Draw components for this side
      const sideName = (label) as EnclosureSide; // label is already capitalized (e.g., "Front")
      const sideComponents = components.filter(c => c.side === sideName);
      sideComponents.forEach(component => {
        const compData = COMPONENT_TYPES[component.type];
        // Guard against unknown component types (backward compatibility)
        if (!compData) return;
        // Always use metric drillSize for radius to keep circles constant
        const radius = (compData.drillSize / 2) * mmToPixels;

        const centerX = sideLayout.width / 2 + component.x;
        const centerY = sideLayout.height / 2 + component.y;

        // Highlight selected component
        if (selectedComponent === component.id) {
          ctx.fillStyle = "#ff8c42";
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 10 / zoom, 0, 2 * Math.PI);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Draw drill hole with white fill
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw stroke on fresh path
        ctx.strokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
        ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw crosshair
        const crosshairSize = radius;
        ctx.strokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(centerX - crosshairSize, centerY);
        ctx.lineTo(centerX + crosshairSize, centerY);
        ctx.moveTo(centerX, centerY - crosshairSize);
        ctx.lineTo(centerX, centerY + crosshairSize);
        ctx.stroke();

        // Draw label with white pill background below component
        const labelText = unit === "metric" 
          ? `${compData.drillSize.toFixed(1)}mm`
          : compData.imperialLabel;
        const labelOffset = radius + 15 / zoom; // Increased from 8 to 15 to prevent overlap
        
        ctx.save();
        // Translate to component center, rotate back to keep text readable, then offset down
        ctx.translate(centerX, centerY);
        const rotRad = (-rotation * Math.PI) / 180;
        ctx.rotate(rotRad);
        ctx.translate(0, labelOffset); // Now translate down in the rotated coordinate system
        
        ctx.font = `${10 / zoom}px monospace`;
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 10 / zoom;
        const padding = 4 / zoom;
        
        // Draw translucent white pill background for measurement
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
        
        // Draw text in black
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, 0, 0);
        
        ctx.restore();
      });

      ctx.restore();
    };

    drawSide('front', 'Front');
    drawSide('top', 'Top');
    drawSide('bottom', 'Bottom');
    drawSide('left', 'Left');
    drawSide('right', 'Right');

    ctx.restore();
  }, [components, zoom, rotation, gridEnabled, gridSize, unit, selectedComponent, panOffset, enclosureType, resizeTrigger]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setResizeTrigger(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse wheel zoom handler (use ref to avoid recreating handler on every zoom change)
  const zoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  
  useEffect(() => {
    zoomRef.current = zoom;
    onZoomChangeRef.current = onZoomChange;
  }, [zoom, onZoomChange]);
  
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const currentZoom = zoomRef.current;
      // Use additive ±0.1 for true 10% increments with snapZoom helper
      const increment = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = snapZoom(currentZoom + increment);
      
      if (onZoomChangeRef.current && newZoom !== currentZoom) {
        onZoomChangeRef.current(newZoom);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []); // Empty deps - handler uses refs

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Right-click (button 2) starts panning
    if (e.button === 2) {
      setIsPanning(true);
      setDragStart({ x: mouseX - panOffset.x, y: mouseY - panOffset.y });
      return;
    }

    // Left-click (button 0) for component selection/dragging
    if (e.button !== 0) return;

    // Convert to canvas coordinates with inverse rotation
    const centerX = rect.width / 2 + panOffset.x;
    const centerY = rect.height / 2 + panOffset.y;
    
    // Apply inverse rotation transform
    const rotRad = (-rotation * Math.PI) / 180;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
    const rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
    
    const canvasX = rotatedX / zoom + layout.totalWidth / 2;
    const canvasY = rotatedY / zoom + layout.totalHeight / 2;

    // Check if clicked on any component (regardless of side boundaries)
    let clickedComponent: PlacedComponent | null = null;
    let clickedSideX = 0;
    let clickedSideY = 0;

    // Check all sides for components at this position
    for (const [side, sideLayout] of Object.entries(layout)) {
      if (side === 'totalWidth' || side === 'totalHeight') continue;
      if (typeof sideLayout === 'number') continue;

      const sideName = (side.charAt(0).toUpperCase() + side.slice(1)) as EnclosureSide;
      const sideComponents = components.filter(c => c.side === sideName);
      
      // Calculate position relative to this side's center
      const sideX = canvasX - sideLayout.x - sideLayout.width / 2;
      const sideY = canvasY - sideLayout.y - sideLayout.height / 2;

      for (const component of sideComponents) {
        const compData = COMPONENT_TYPES[component.type];
        // Always use metric drillSize for radius (hit detection)
        const radius = (compData.drillSize / 2) * mmToPixels;

        const dx = sideX - component.x;
        const dy = sideY - component.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius + 10) {
          clickedComponent = component;
          clickedSideX = sideX;
          clickedSideY = sideY;
        }
      }
      
      if (clickedComponent) break;
    }

    if (clickedComponent) {
      onSelectComponent(clickedComponent.id);
      setDraggedComponent(clickedComponent.id);
      setDragStart({ x: clickedSideX, y: clickedSideY });
      setIsDragging(true);
    } else {
      // Clear selection on empty click (trash button uses stopPropagation to prevent this)
      onSelectComponent(null);
      onCanvasClick?.();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setPanOffset({
        x: mouseX - dragStart.x,
        y: mouseY - dragStart.y,
      });
      return;
    }

    if (isDragging && draggedComponent) {
      const component = components.find(c => c.id === draggedComponent);
      if (!component) return;
      
      // Convert mouse position to canvas center-relative coordinates
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = (mouseX - centerX - panOffset.x) / zoom;
      const dy = (mouseY - centerY - panOffset.y) / zoom;
      
      // Apply inverse rotation to get unwrapped layout coordinates
      const rotRad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const layoutX = dx * cos - dy * sin + layout.totalWidth / 2;
      const layoutY = dx * sin + dy * cos + layout.totalHeight / 2;

      // Detect which side contains the cursor position in layout space
      let currentSide: EnclosureSide | null = null;
      let currentSideLayout: { x: number; y: number; width: number; height: number } | null = null;
      
      const sides: Array<{ side: EnclosureSide; layout: typeof layout.front }> = [
        { side: 'Front', layout: layout.front },
        { side: 'Top', layout: layout.top },
        { side: 'Bottom', layout: layout.bottom },
        { side: 'Left', layout: layout.left },
        { side: 'Right', layout: layout.right },
      ];
      
      for (const { side, layout: sideLayout } of sides) {
        if (typeof sideLayout === 'number') continue;
        if (
          layoutX >= sideLayout.x &&
          layoutX <= sideLayout.x + sideLayout.width &&
          layoutY >= sideLayout.y &&
          layoutY <= sideLayout.y + sideLayout.height
        ) {
          currentSide = side;
          currentSideLayout = sideLayout;
          break;
        }
      }
      
      // If cursor is outside all sides, keep current side but don't update position
      if (!currentSide || !currentSideLayout) {
        return;
      }

      // Calculate position relative to detected side's center
      let newX = layoutX - currentSideLayout.x - currentSideLayout.width / 2;
      let newY = layoutY - currentSideLayout.y - currentSideLayout.height / 2;

      // Apply grid snapping if enabled
      if (gridEnabled && gridSize > 0) {
        const gridPixels = gridSize * mmToPixels;
        newX = Math.round(newX / gridPixels) * gridPixels;
        newY = Math.round(newY / gridPixels) * gridPixels;
      }

      // Update component position and side (only if side changed or it's a different value)
      onComponentMove(
        draggedComponent, 
        newX, 
        newY, 
        currentSide !== component.side ? currentSide : undefined
      );
    }
  };

  const handleMouseUp = () => {
    // Keep the component selected if we were dragging
    const wasDragging = isDragging;
    
    setIsDragging(false);
    setDraggedComponent(null);
    setIsPanning(false);
    
    // Set flag AFTER clearing drag state to ensure it's checked correctly
    if (wasDragging) {
      setJustFinishedDrag(true);
      // Use longer timeout to ensure all synthetic events are caught
      setTimeout(() => setJustFinishedDrag(false), 300);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent click events right after dragging
    if (justFinishedDrag) {
      e.preventDefault();
      e.stopPropagation();
      setJustFinishedDrag(false); // Clear immediately after catching the click
      return;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="unwrapped-canvas"
      />
      
      {selectedComponent && (
        <div className="fixed z-50" style={{ right: '2rem', bottom: '5rem' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComponentDelete(selectedComponent);
              onSelectComponent(null);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-9 h-9 rounded-md bg-[#ff8c42] text-white flex items-center justify-center hover-elevate active-elevate-2"
            data-testid="button-delete-selected"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}