import { useRef, useEffect, useState } from "react";
import { PlacedComponent, ComponentType, COMPONENT_TYPES, EnclosureSide, MeasurementUnit, EnclosureType, getUnwrappedDimensions, CORNER_RADIUS, ENCLOSURE_TYPES } from "@/types/schema";
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
  rotatesLabels?: boolean;
}

// Helper function to get rotated side label
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

// Fix the helper function to handle side mapping with rotation correctly
const getActualSideForDrag = (
  canvasSide: EnclosureSide, 
  currentRotation: number, 
  rotatesLabels: boolean
): EnclosureSide => {
  if (!rotatesLabels || currentRotation === 0) {
    return canvasSide;
  }
  
  // Correct reverse mapping for 90° clockwise rotation
  const reverseMap: Record<EnclosureSide, EnclosureSide> = {
    'Front': 'Front',
    'Top': 'Right',     // Top becomes Right
    'Right': 'Bottom',  // Right becomes Bottom  
    'Bottom': 'Left',   // Bottom becomes Left
    'Left': 'Top'       // Left becomes Top
  };
  
  return reverseMap[canvasSide];
};

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
  rotatesLabels = false,
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

  // Helper function to get rotated dimensions for utility guides (for labels only)
  const getRotatedDimensions = (compData: any, currentRotation: number) => {
    if (compData.category !== "Footprint Guides (not printed)" || currentRotation === 0) {
      return { width: compData.width, height: compData.height };
    }
    
    // Swap dimensions for 90° rotation (for labels only)
    if (currentRotation === 90) {
      return { width: compData.height, height: compData.width };
    }
    
    return { width: compData.width, height: compData.height };
  };

  // Helper function to get rotated label text for utility guides
  const getRotatedLabelText = (compData: any, currentRotation: number) => {
    if (compData.category !== "Footprint Guides (not printed)") {
      return unit === "metric" 
        ? `${compData.drillSize.toFixed(1)}mm`
        : compData.imperialLabel;
    }

    if (compData.shape === 'rectangle' || compData.shape === 'square') {
      const rotatedDims = getRotatedDimensions(compData, currentRotation);
      return unit === "metric" 
        ? `${rotatedDims.width}mm×${rotatedDims.height}mm`
        : compData.imperialLabel;
    } else {
      // For circles, just show diameter (doesn't change with rotation)
      return unit === "metric" 
        ? `${compData.drillSize}mm`
        : compData.imperialLabel;
    }
  };

  // Helper function to check if point is within trapezoid
  const isPointInTrapezoid = (
    x: number, 
    y: number, 
    backWidth: number, 
    frontWidth: number, 
    height: number
  ): boolean => {
    // Convert from center-relative to top-left relative coordinates
    const absX = x + backWidth / 2;
    const absY = y + height / 2;
    
    // Calculate the valid x range at this y position (interpolate between back and front)
    const widthAtY = backWidth - (backWidth - frontWidth) * (absY / height);
    const leftEdge = (backWidth - widthAtY) / 2;
    const rightEdge = leftEdge + widthAtY;
    
    return absX >= leftEdge && absX <= rightEdge && absY >= 0 && absY <= height;
  };

  // Calculate layout offsets for each side in the cross pattern
  const getLayout = () => {
    const enc = ENCLOSURE_TYPES[enclosureType];
    const cornerStyle = enc.cornerStyle || "rounded";
    const isTrapezoidal = enc.isTrapezoidal || false;
    
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

    if (isTrapezoidal) {
      // Special layout for trapezoidal enclosures
      // The narrow end of left/right sides should align with bottom height
      const narrowWidth = dimensions.bottom.height * mmToPixels;
      
      const totalWidth = frontW + leftW + rightW;
      const totalHeight = frontH + topH + bottomH;
      
      return {
        front: { x: leftW, y: topH, width: frontW, height: frontH },
        top: { x: leftW, y: 0, width: frontW, height: topH },
        bottom: { x: leftW, y: topH + frontH, width: frontW, height: bottomH },
        left: { x: 0, y: topH, width: leftW, height: leftH },
        right: { x: leftW + frontW, y: topH, width: rightW, height: rightH },
        totalWidth,
        totalHeight,
      };
    }

    // Original rectangular layout logic
    const totalWidth = cornerStyle === "sharp" 
      ? Math.max(leftW + frontW + rightW, topW, bottomW)
      : leftW + frontW + rightW;
      
    const totalHeight = cornerStyle === "sharp"
      ? Math.max(topH + frontH + bottomH, leftH, rightH)
      : topH + frontH + bottomH;

    const topOffsetX = (frontW - topW) / 2;
    const bottomOffsetX = (frontW - bottomW) / 2;
    
    const leftOffsetY = cornerStyle === "sharp" ? 0 : (frontH - leftH) / 2;
    const rightOffsetY = cornerStyle === "sharp" ? 0 : (frontH - rightH) / 2;

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

      // Use rotated label if enclosure supports it
      const displayLabel = getRotatedSideLabel(label as EnclosureSide, rotation, rotatesLabels);

      // Draw grid if enabled
      if (gridEnabled && gridSize > 0) {
        ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
        ctx.lineWidth = 0.5 / zoom;
        
        const gridPixels = gridSize * mmToPixels;
        const edgeMargin = 2 * mmToPixels;
        
        const hasRoomForMargins = sideLayout.width > edgeMargin * 2 && sideLayout.height > edgeMargin * 2;
        
        ctx.beginPath();
        for (let x = 0; x <= sideLayout.width / 2; x += gridPixels) {
          const posX = sideLayout.width / 2 + x;
          const negX = sideLayout.width / 2 - x;
          
          if (x === 0 || !hasRoomForMargins || (posX > edgeMargin && posX < sideLayout.width - edgeMargin)) {
            if (x === 0 || posX < sideLayout.width) {
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
        ctx.strokeStyle = "rgba(128, 128, 128, 0.8)";
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.moveTo(sideLayout.width / 2, 0);
        ctx.lineTo(sideLayout.width / 2, sideLayout.height);
        ctx.moveTo(0, sideLayout.height / 2);
        ctx.lineTo(sideLayout.width, sideLayout.height / 2);
        ctx.stroke();
      }

      // Draw side border with corner style handling
      ctx.strokeStyle = "hsl(var(--foreground))";
      ctx.lineWidth = 2 / zoom;
      
      if (side === 'front') {
        if (sideData.cornerStyle === "rounded") {
          // Hammond-style with corner radii
          const cornerRadius = CORNER_RADIUS * mmToPixels;
          ctx.beginPath();
          ctx.roundRect(0, 0, sideLayout.width, sideLayout.height, cornerRadius);
          ctx.stroke();
        } else {
          // Sharp corners
          ctx.strokeRect(0, 0, sideLayout.width, sideLayout.height);
        }
      } else if ((side === 'left' || side === 'right') && sideData.isTrapezoidal && sideData.frontWidth) {
        // Draw trapezoid for trapezoidal left/right sides
        const backWidth = sideLayout.width; // Wide end at top (56mm)
        const frontWidth = sideData.frontWidth * mmToPixels; // Narrow end at bottom (13mm)
        const height = sideLayout.height;
        
        console.log(`${side} side trapezoid:`, {
          backWidthMM: backWidth / mmToPixels,
          frontWidthMM: frontWidth / mmToPixels, 
          heightMM: height / mmToPixels
        });
        
        ctx.beginPath();
        if (side === 'left') {
          // Left side: wide at top (back), narrow at bottom (front)
          // Should connect to front panel on the RIGHT edge
          // Horizontally mirrored: draw from RIGHT to LEFT
          ctx.moveTo(backWidth, 0);           // Top RIGHT (back, wide end - 56mm)
          ctx.lineTo(0, 0);                   // Top LEFT (back, wide end - 0mm)  
          ctx.lineTo(backWidth - frontWidth, height); // Bottom LEFT (front, narrow end - 43mm)
          ctx.lineTo(backWidth, height);      // Bottom RIGHT (front, narrow end - 56mm)
        } else {
          // Right side: wide at top (back), narrow at bottom (front)  
          // Should connect to front panel on the LEFT edge
          // Normal orientation: draw from LEFT to RIGHT
          ctx.moveTo(0, 0);                   // Top LEFT (back, wide end - 0mm)
          ctx.lineTo(backWidth, 0);           // Top RIGHT (back, wide end - 56mm)
          ctx.lineTo(frontWidth, height);     // Bottom RIGHT (front, narrow end - 13mm)
          ctx.lineTo(0, height);              // Bottom LEFT (front, narrow end - 0mm)
        }
        ctx.closePath();
        ctx.stroke();
              
        // Draw centerline for reference
        ctx.save();
        ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(backWidth / 2, 0);
        ctx.lineTo(backWidth / 2, height);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeRect(0, 0, sideLayout.width, sideLayout.height);
      }

      // DRAW SIDE LABEL - FIXED: Always keep labels readable left-to-right
      ctx.save();
      ctx.translate(sideLayout.width / 2, sideLayout.height / 2);
      
      // Apply counter-rotation to keep labels readable regardless of canvas rotation
      const rotRad = (-rotation * Math.PI) / 180;
      ctx.rotate(rotRad);
      
      ctx.fillStyle = "hsl(var(--foreground))";
      ctx.font = `${14 / zoom}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(displayLabel, 0, 0);
      ctx.restore();

      // Draw components for this side
      const sideName = (label) as EnclosureSide;
      const sideComponents = components.filter(c => c.side === sideName);
      
      // Separate utility guides from regular components for proper z-ordering
      const utilityGuides = sideComponents.filter(c => 
        COMPONENT_TYPES[c.type].category === "Footprint Guides (not printed)"
      );
      const regularComponents = sideComponents.filter(c => 
        COMPONENT_TYPES[c.type].category !== "Footprint Guides (not printed)"
      );

      // Draw utility guides first (behind regular components)
      [...utilityGuides, ...regularComponents].forEach(component => {
        const compData = COMPONENT_TYPES[component.type];
        if (!compData) return;
        
        const centerX = sideLayout.width / 2 + component.x;
        const centerY = sideLayout.height / 2 + component.y;

        // Check if this is a utility guide (not printed)
        const isUtilityGuide = compData.category === "Footprint Guides (not printed)";

        // Check if component is in warning zone for trapezoidal sides
        let showWarning = false;
        if ((sideName === 'Left' || sideName === 'Right') && sideData.isTrapezoidal && sideData.frontWidth) {
          const backWidth = sideLayout.width;
          const frontWidth = sideData.frontWidth * mmToPixels;
          const height = sideLayout.height;
          const minDistFromEdge = 5 * mmToPixels;
          
          const absY = component.y + height / 2;
          const widthAtY = backWidth - (backWidth - frontWidth) * (absY / height);
          const distFromLeft = (component.x + backWidth / 2) - ((backWidth - widthAtY) / 2);
          const distFromRight = ((backWidth - widthAtY) / 2 + widthAtY) - (component.x + backWidth / 2);
          
          if (distFromLeft < minDistFromEdge || distFromRight < minDistFromEdge) {
            showWarning = true;
          }
        }

        // Highlight selected component
        if (selectedComponent === component.id) {
          ctx.fillStyle = "#ff8c42";
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          
          if (compData.shape === 'rectangle' || compData.shape === 'square') {
            // Use original dimensions for selection highlight (not rotated)
            const rectWidth = (compData.width || 10) * mmToPixels;
            const rectHeight = (compData.height || 10) * mmToPixels;
            ctx.rect(
              centerX - rectWidth / 2 - 10 / zoom,
              centerY - rectHeight / 2 - 10 / zoom,
              rectWidth + 20 / zoom,
              rectHeight + 20 / zoom
            );
          } else {
            const radius = (compData.drillSize / 2) * mmToPixels;
            ctx.arc(centerX, centerY, radius + 10 / zoom, 0, 2 * Math.PI);
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Draw the component based on shape
        if (compData.shape === 'rectangle' || compData.shape === 'square') {
          // FIX: Always use original dimensions for drawing, only swap for label
          const rectWidth = (compData.width || 10) * mmToPixels;
          const rectHeight = (compData.height || 10) * mmToPixels;
          
          // Draw fill - transparent for utility guides, white for regular components
          if (isUtilityGuide) {
            ctx.fillStyle = "transparent";
          } else {
            ctx.fillStyle = "white";
          }
          ctx.fillRect(
            centerX - rectWidth / 2,
            centerY - rectHeight / 2,
            rectWidth,
            rectHeight
          );
          
          // Draw warning outline if needed (only for non-utility guides)
          if (showWarning && !isUtilityGuide) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 2 / zoom;
            ctx.strokeRect(
              centerX - rectWidth / 2 - 5 / zoom,
              centerY - rectHeight / 2 - 5 / zoom,
              rectWidth + 10 / zoom,
              rectHeight + 10 / zoom
            );
          }
          
          // Draw main outline with dotted lines for utility guides
          ctx.strokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
          ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
          
          if (isUtilityGuide) {
            ctx.setLineDash([5 / zoom, 5 / zoom]);
          }
          
          ctx.strokeRect(
            centerX - rectWidth / 2,
            centerY - rectHeight / 2,
            rectWidth,
            rectHeight
          );
          
          if (isUtilityGuide) {
            ctx.setLineDash([]);
          }
          
          // Draw crosshair (only for non-utility guides)
          if (!isUtilityGuide) {
            const crosshairSize = Math.max(rectWidth / 2, rectHeight / 2);
            ctx.strokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
            ctx.lineWidth = 1 / zoom;
            ctx.beginPath();
            ctx.moveTo(centerX - crosshairSize, centerY);
            ctx.lineTo(centerX + crosshairSize, centerY);
            ctx.moveTo(centerX, centerY - crosshairSize);
            ctx.lineTo(centerX, centerY + crosshairSize);
            ctx.stroke();
          }
          
          // Draw dimension label with rotated dimensions (label only changes, not the rectangle)
          const labelText = getRotatedLabelText(compData, rotation);

// FIX: Calculate label offset based on the actual bottom edge distance after rotation
// After 90° rotation, the bottom edge is what was previously the right edge
const rotatedDims = getRotatedDimensions(compData, rotation);
const bottomEdgeDistance = (rotatedDims.height / 2) * mmToPixels;
const labelOffset = bottomEdgeDistance + 15 / zoom;

ctx.save();
ctx.translate(centerX, centerY);
const rotRad = (-rotation * Math.PI) / 180;
ctx.rotate(rotRad);
ctx.translate(0, labelOffset);

ctx.font = `${10 / zoom}px monospace`;
const textMetrics = ctx.measureText(labelText);
const textWidth = textMetrics.width;
const textHeight = 10 / zoom;
const padding = 4 / zoom;

// Draw pill background
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

// Draw text
ctx.fillStyle = "black";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText(labelText, 0, 0);

ctx.restore();
          
        } else {
          // CIRCLE RENDERING (for both regular components and utility guides)
          const radius = (compData.drillSize / 2) * mmToPixels;
          
          // Draw drill hole - transparent for utility guides, white for regular components
          if (isUtilityGuide) {
            ctx.fillStyle = "transparent";
          } else {
            ctx.fillStyle = "white";
          }
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw warning ring if needed (only for non-utility guides)
          if (showWarning && !isUtilityGuide) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 5 / zoom, 0, 2 * Math.PI);
            ctx.stroke();
          }
          
          // Draw stroke with dotted lines for utility guides
          ctx.strokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
          ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
          
          if (isUtilityGuide) {
            ctx.setLineDash([5 / zoom, 5 / zoom]);
          }
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          ctx.stroke();
          
          if (isUtilityGuide) {
            ctx.setLineDash([]);
          }

          // Draw crosshair (only for non-utility guides)
          if (!isUtilityGuide) {
            const crosshairSize = radius;
            ctx.strokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
            ctx.lineWidth = 1 / zoom;
            ctx.beginPath();
            ctx.moveTo(centerX - crosshairSize, centerY);
            ctx.lineTo(centerX + crosshairSize, centerY);
            ctx.moveTo(centerX, centerY - crosshairSize);
            ctx.lineTo(centerX, centerY + crosshairSize);
            ctx.stroke();
          }

          // Draw label with rotated dimensions for Footprint guides
          const labelText = getRotatedLabelText(compData, rotation);
          const labelOffset = radius + 15 / zoom;
          
          ctx.save();
          ctx.translate(centerX, centerY);
          const rotRad = (-rotation * Math.PI) / 180;
          ctx.rotate(rotRad);
          ctx.translate(0, labelOffset);
          
          ctx.font = `${10 / zoom}px monospace`;
          const textMetrics = ctx.measureText(labelText);
          const textWidth = textMetrics.width;
          const textHeight = 10 / zoom;
          const padding = 4 / zoom;
          
          // Draw pill background
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
          
          // Draw text
          ctx.fillStyle = "black";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, 0, 0);
          
          ctx.restore();
        }
      });

      ctx.restore();
    };

    drawSide('front', 'Front');
    drawSide('top', 'Top');
    drawSide('bottom', 'Bottom');
    drawSide('left', 'Left');
    drawSide('right', 'Right');

    ctx.restore();
  }, [components, zoom, rotation, gridEnabled, gridSize, unit, selectedComponent, panOffset, enclosureType, resizeTrigger, rotatesLabels]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setResizeTrigger(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse wheel zoom handler
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
  }, []);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Right-click starts panning
    if (e.button === 2) {
      setIsPanning(true);
      setDragStart({ x: mouseX - panOffset.x, y: mouseY - panOffset.y });
      return;
    }

    // Left-click for component selection/dragging
    if (e.button !== 0) return;

    // Convert to canvas coordinates with inverse rotation
    const centerX = rect.width / 2 + panOffset.x;
    const centerY = rect.height / 2 + panOffset.y;
    
    const rotRad = (-rotation * Math.PI) / 180;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
    const rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
    
    const canvasX = rotatedX / zoom + layout.totalWidth / 2;
    const canvasY = rotatedY / zoom + layout.totalHeight / 2;

    // Check if clicked on any component
    let clickedComponent: PlacedComponent | null = null;
    let clickedSideX = 0;
    let clickedSideY = 0;

    // Check regular components first, then utility guides (reverse draw order)
    const allComponents = [...components];
    
    // Sort components by type - regular components first for hit detection
    allComponents.sort((a, b) => {
      const aIsUtility = COMPONENT_TYPES[a.type].category === "Footprint Guides (not printed)";
      const bIsUtility = COMPONENT_TYPES[b.type].category === "Footprint Guides (not printed)";
      if (aIsUtility && !bIsUtility) return 1; // Utilities after regular
      if (!aIsUtility && bIsUtility) return -1; // Regular before utilities
      return 0;
    });

    for (const [side, sideLayout] of Object.entries(layout)) {
      if (side === 'totalWidth' || side === 'totalHeight') continue;
      if (typeof sideLayout === 'number') continue;

      const sideName = (side.charAt(0).toUpperCase() + side.slice(1)) as EnclosureSide;
      const sideComponents = allComponents.filter(c => c.side === sideName);
      
      const sideX = canvasX - sideLayout.x - sideLayout.width / 2;
      const sideY = canvasY - sideLayout.y - sideLayout.height / 2;

      for (const component of sideComponents) {
        const compData = COMPONENT_TYPES[component.type];
        let isClicked = false;

        if (compData.shape === 'rectangle' || compData.shape === 'square') {
          // FIX: Use original dimensions for hit detection, not rotated ones
          const rectWidth = (compData.width || 10) * mmToPixels;
          const rectHeight = (compData.height || 10) * mmToPixels;
          
          const dx = Math.abs(sideX - component.x);
          const dy = Math.abs(sideY - component.y);
          
          if (dx <= rectWidth / 2 && dy <= rectHeight / 2) {
            isClicked = true;
          }
        } else {
          // Check circle click
          const radius = (compData.drillSize / 2) * mmToPixels;
          const dx = sideX - component.x;
          const dy = sideY - component.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= radius + 10) {
            isClicked = true;
          }
        }

        if (isClicked) {
          clickedComponent = component;
          clickedSideX = sideX;
          clickedSideY = sideY;
          break; // Found a component, stop checking this side
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
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = (mouseX - centerX - panOffset.x) / zoom;
      const dy = (mouseY - centerY - panOffset.y) / zoom;
      
      const rotRad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const layoutX = dx * cos - dy * sin + layout.totalWidth / 2;
      const layoutY = dx * sin + dy * cos + layout.totalHeight / 2;

      // Detect which side contains the cursor position (in CANVAS coordinates)
      let canvasSide: EnclosureSide | null = null;
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
          canvasSide = side;
          currentSideLayout = sideLayout;
          break;
        }
      }
      
      if (!canvasSide || !currentSideLayout) {
        return;
      }

      // Convert canvas side to actual side based on rotation
      const actualSide = getActualSideForDrag(canvasSide, rotation, rotatesLabels);

      // Calculate position relative to detected side's center
      let newX = layoutX - currentSideLayout.x - currentSideLayout.width / 2;
      let newY = layoutY - currentSideLayout.y - currentSideLayout.height / 2;

      // Check if position is valid for trapezoidal sides
      if (actualSide === 'Left' || actualSide === 'Right') {
        const sideData = dimensions[actualSide.toLowerCase() as 'left' | 'right'];
        if (sideData.isTrapezoidal && sideData.frontWidth) {
          const backWidth = sideData.width * mmToPixels;
          const frontWidth = sideData.frontWidth * mmToPixels;
          const height = sideData.height * mmToPixels;
          
          if (!isPointInTrapezoid(newX, newY, backWidth, frontWidth, height)) {
            return;
          }
        }
      }

      // Apply grid snapping if enabled
      if (gridEnabled && gridSize > 0) {
        const gridPixels = gridSize * mmToPixels;
        newX = Math.round(newX / gridPixels) * gridPixels;
        newY = Math.round(newY / gridPixels) * gridPixels;
      }

      onComponentMove(
        draggedComponent, 
        newX, 
        newY, 
        actualSide !== component.side ? actualSide : undefined
      );
    }
  };

  const handleMouseUp = () => {
    const wasDragging = isDragging;
    
    setIsDragging(false);
    setDraggedComponent(null);
    setIsPanning(false);
    
    if (wasDragging) {
      setJustFinishedDrag(true);
      setTimeout(() => setJustFinishedDrag(false), 300);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (justFinishedDrag) {
      e.preventDefault();
      e.stopPropagation();
      setJustFinishedDrag(false);
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