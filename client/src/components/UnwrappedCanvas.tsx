import { useRef, useEffect, useState, useCallback } from "react";
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
  onRightClick?: (e: React.MouseEvent, componentId: string | null) => void;
  autoZoomToFit?: boolean; // New prop for auto-zoom
}

/**
 * Maps physical side labels when canvas is rotated.
 * When canvas rotates 90° clockwise, the visual positions change:
 * - Left side appears at Top
 * - Top side appears at Right
 * - Right side appears at Bottom
 * - Bottom side appears at Left
 * - Front stays as Front
 */
const getRotatedSideLabel = (side: EnclosureSide, rotation: number, rotatesLabels: boolean): EnclosureSide => {
  if (!rotatesLabels || rotation === 0) {
    return side;
  }
  
  const rotationMap: Record<EnclosureSide, EnclosureSide> = {
    'Front': 'Front',
    'Left': 'Top',
    'Top': 'Right', 
    'Right': 'Bottom',
    'Bottom': 'Left'
  };
  
  return rotationMap[side];
};

/**
 * Converts visual canvas position back to actual enclosure side when dragging.
 * This is the inverse of getRotatedSideLabel.
 * When canvas is rotated 90° clockwise and user drags to what looks like "Top",
 * they're actually placing on the "Right" side of the physical enclosure.
 */
const getActualSideForDrag = (
  canvasSide: EnclosureSide, 
  currentRotation: number, 
  rotatesLabels: boolean
): EnclosureSide => {
  if (!rotatesLabels || currentRotation === 0) {
    return canvasSide;
  }
  
  const reverseMap: Record<EnclosureSide, EnclosureSide> = {
    'Front': 'Front',
    'Top': 'Right',     // Visual Top = Actual Right
    'Right': 'Bottom',  // Visual Right = Actual Bottom  
    'Bottom': 'Left',   // Visual Bottom = Actual Left
    'Left': 'Top'       // Visual Left = Actual Top
  };
  
  return reverseMap[canvasSide];
};

/**
 * Calculate component z-order for rendering.
 * Components are sorted by:
 * 1. Type: Regular components render on top of utility guides
 * 2. Timestamp: Newer components render on top of older ones
 */
const getComponentZOrder = (component: PlacedComponent) => {
  const isUtility = COMPONENT_TYPES[component.type].category === "Footprint Guides";
  
  // Extract timestamp from component ID (format: "comp-1234567890-abc")
  const parts = component.id.split('-');
  let timestamp = 0;
  
  for (const part of parts) {
    const num = parseInt(part, 10);
    // Check if it looks like a timestamp (milliseconds since epoch)
    if (!isNaN(num) && num > 1000000000000) {
      timestamp = num;
      break;
    }
  }
  
  return { isUtility, timestamp };
};

/**
 * Generate label text showing component dimensions.
 * For rectangular components rotated 90° (either component rotation OR canvas rotation),
 * swap width/height in the label since what was width is now height visually.
 */
const getRotatedLabelText = (
  compData: any, 
  componentRotation: number, 
  canvasRotation: number,
  unit: MeasurementUnit
) => {
  // Rectangular components (both drill holes and footprint guides)
  if (compData.shape === 'rectangle' || compData.shape === 'square') {
    // Calculate total visual rotation (component + canvas)
    const totalVisualRotation = (componentRotation + canvasRotation) % 360;
    
    // For 90° or 270° visual rotation, swap width and height
    if (totalVisualRotation === 90 || totalVisualRotation === 270) {
      return unit === "metric" 
        ? `${compData.height}mm×${compData.width}mm`
        : mmToFraction(compData.height) + "×" + mmToFraction(compData.width);
    } else { // 0° or 180° visual rotation
      return unit === "metric" 
        ? `${compData.width}mm×${compData.height}mm`
        : mmToFraction(compData.width) + "×" + mmToFraction(compData.height);
    }
  } else {
    // Circular components (both drill holes and footprint guides)
    return unit === "metric" 
      ? `${compData.drillSize}mm`
      : mmToFraction(compData.drillSize);
  }
};

/**
 * Calculate label position to always appear at the visual bottom of a component.
 * 
 * For rectangles:
 * - At component 0° + canvas 0°: label below bottom edge (original bottom)
 * - At component 90° + canvas 0°: label below right edge (rotated to bottom)
 * - At component 0° + canvas 90°: label below right edge (canvas rotated)
 * - At component 90° + canvas 90°: label below top edge (both rotations = 180° total)
 * 
 * The key insight: we need to find which edge is visually at the bottom after
 * applying BOTH component rotation AND canvas rotation.
 */
const calculateLabelPosition = (
  centerX: number,
  centerY: number,
  componentRotation: number, // Always 0° or 90°
  canvasRotation: number,    // Always 0° or 90°
  zoom: number,
  isRectangular: boolean,
  rectWidthPx?: number,
  rectHeightPx?: number,
  radiusPx?: number
): { x: number; y: number; textAngle: number } => {
  const baseOffset = 15;
  const zoomedOffset = baseOffset / zoom;
  
  if (isRectangular && rectWidthPx !== undefined && rectHeightPx !== undefined) {
    // Determine visual orientation based on component rotation
    const visualWidthPx = componentRotation === 0 ? rectWidthPx : rectHeightPx;
    const visualHeightPx = componentRotation === 0 ? rectHeightPx : rectWidthPx;
    
    let labelX = centerX;
    let labelY = centerY;
    
    if (canvasRotation === 0) {
      // Canvas not rotated: label below rectangle
      labelX = centerX;
      labelY = centerY + visualHeightPx / 2 + zoomedOffset;
    } else { // canvasRotation === 90
      // Canvas rotated 90°: label to the right of rectangle (which is visual bottom)
      labelX = centerX + visualWidthPx / 2 + zoomedOffset;
      labelY = centerY;
    }
    
    // Keep text horizontal (counter-rotate by canvas rotation only)
    const textAngle = (-canvasRotation * Math.PI) / 180;
    
    return { x: labelX, y: labelY, textAngle };
    
  } else {
    // Circles: label position depends only on canvas rotation
    const circleRadius = radiusPx || 0;
    
    if (canvasRotation === 0) {
      // Canvas not rotated: label below circle
      return {
        x: centerX,
        y: centerY + circleRadius + zoomedOffset,
        textAngle: 0
      };
    } else { // canvasRotation === 90
      // Canvas rotated 90°: label to the right of circle
      return {
        x: centerX + circleRadius + zoomedOffset,
        y: centerY,
        textAngle: -Math.PI / 2
      };
    }
  }
};

/**
 * Calculate zoom level to fit the enclosure within the viewport
 * while accounting for UI bars at top and bottom
 * Only scales DOWN if enclosure is too large, never scales UP
 */
const calculateZoomToFit = (
  layoutWidth: number,    // in pixels
  layoutHeight: number,   // in pixels  
  viewportWidth: number,
  viewportHeight: number,
  topBarHeight: number = 0,  // Height of top UI bar
  bottomBarHeight: number = 0, // Height of bottom UI bar
  margin: number = 10     // Minimal margin (reduced from 40 to 10)
): number => {
  // Calculate available space (accounting for UI bars and minimal margins)
  const availableWidth = viewportWidth - (margin * 2);
  const availableHeight = viewportHeight - (margin * 2) - topBarHeight - bottomBarHeight;
  
  // Ensure we don't get negative or zero available height
  const safeAvailableHeight = Math.max(10, availableHeight);
  
  // Check if the enclosure already fits at 100% zoom
  const fitsAt100Width = layoutWidth <= availableWidth;
  const fitsAt100Height = layoutHeight <= safeAvailableHeight;
  const fitsAt100 = fitsAt100Width && fitsAt100Height;
  
  // If it already fits at 100%, don't scale at all
  if (fitsAt100) {
    return 1.0; // Stay at 100% zoom
  }
  
  // Calculate required zoom to fit width and height
  const zoomForWidth = availableWidth / layoutWidth;
  const zoomForHeight = safeAvailableHeight / layoutHeight;
  
  // Use the smaller zoom to ensure entire enclosure fits
  const minZoom = Math.min(zoomForWidth, zoomForHeight);
  
  // Apply reasonable bounds (don't zoom too far out, but don't zoom in beyond 100%)
  const boundedZoom = Math.max(0.1, Math.min(1, minZoom)); // Max is 1.0 (100%)
  
  return boundedZoom;
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
  onRightClick,
  autoZoomToFit = false, // Default to false for backward compatibility
}: UnwrappedCanvasProps) {
  // All hooks must be called FIRST, unconditionally
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [justFinishedDrag, setJustFinishedDrag] = useState(false);
  const [resizeTrigger, setResizeTrigger] = useState(0);
  const [hasAutoZoomed, setHasAutoZoomed] = useState(false);
  
  // Cursor state management
  const [cursorStyle, setCursorStyle] = useState<string>('default');
  const [isHoveringComponent, setIsHoveringComponent] = useState<string | null>(null);

  // Zoom refs for wheel handler
  const zoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  
  // Update refs when props change
  useEffect(() => {
    zoomRef.current = zoom;
    onZoomChangeRef.current = onZoomChange;
  }, [zoom, onZoomChange]);

  // Wheel event handler for zooming
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const currentZoom = zoomRef.current;
      const increment = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = snapZoom(currentZoom + increment);
      
      if (onZoomChangeRef.current && newZoom !== currentZoom) {
        onZoomChangeRef.current(newZoom);
        
        // Clear auto-zoom flag when user manually zooms
        setHasAutoZoomed(true);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []); // Empty dependency array - refs update via the useEffect above

  // Now we can check for invalid enclosureType and return early
  if (!enclosureType || !ENCLOSURE_TYPES[enclosureType]) {
    return null;
  }
  
  const mmToPixels = 3.7795275591;
  const dimensions = getUnwrappedDimensions(enclosureType);

  const convertUnit = (mm: number) => {
    if (unit === "metric") {
      return `${mm.toFixed(1)}mm`;
    } else {
      return mmToFraction(mm);
    }
  };

  /**
   * Check if a point is within a trapezoidal side boundary.
   * Used for drag validation on trapezoidal enclosures.
   */
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

  /**
   * Calculate layout positions for all sides in the cross pattern.
   * Returns x, y, width, height for each side plus total dimensions.
   */
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

    // Standard rectangular layout
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

  /**
   * Handle zoom to fit the enclosure within the viewport
   */
  const handleZoomToFit = useCallback(() => {
    if (!containerRef.current || !onZoomChange || !enclosureType) return;
    
    const container = containerRef.current;
    const { width: viewportWidth, height: viewportHeight } = container.getBoundingClientRect();
    
    // Try to get actual bar heights from the DOM
    let topBarHeight = 64; // Default fallback for TopControls
    let bottomBarHeight = 52; // Default fallback for BottomInfo
    
    // Try to find top controls element by various selectors
    const topControlsSelectors = [
      '[data-testid*="top-controls"]',
      '[data-testid*="topcontrols"]',
      '.top-controls',
      'header',
      'nav'
    ];
    
    for (const selector of topControlsSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0) {
          topBarHeight = rect.height;
          break;
        }
      }
    }
    
    // Try to find bottom info element by various selectors
    const bottomInfoSelectors = [
      '[data-testid*="bottom-info"]',
      '[data-testid*="bottominfo"]',
      '.bottom-info',
      'footer'
    ];
    
    for (const selector of bottomInfoSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0) {
          bottomBarHeight = rect.height;
          break;
        }
      }
    }
    
    // Minimal buffer (reduced from 8 to 4)
    const uiBarBuffer = 4;
    
    // Calculate zoom to fit (only scales down if needed)
    const newZoom = calculateZoomToFit(
      layout.totalWidth,
      layout.totalHeight,
      viewportWidth,
      viewportHeight,
      topBarHeight + uiBarBuffer,
      bottomBarHeight + uiBarBuffer,
      10 // Minimal margin (reduced from 40 to 10)
    );
    
    // Only apply if it's different from current zoom (and not equal to 1 if we're already at 1)
    if (newZoom !== zoom) {
      onZoomChange(snapZoom(newZoom));
      
      // Center the view
      setPanOffset({ x: 0, y: 0 });
      
      // Mark that we've auto-zoomed
      setHasAutoZoomed(true);
    }
  }, [enclosureType, onZoomChange, layout.totalWidth, layout.totalHeight, zoom]);

  /**
   * Detect if mouse is hovering over any component
   */
  const detectHoveredComponent = (mouseX: number, mouseY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Convert mouse position to canvas coordinates
    const centerX = rect.width / 2 + panOffset.x;
    const centerY = rect.height / 2 + panOffset.y;
    
    const rotRad = (-rotation * Math.PI) / 180;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
    const rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
    
    const layoutX = rotatedX / zoom + layout.totalWidth / 2;
    const layoutY = rotatedY / zoom + layout.totalHeight / 2;

    // Sort components by z-order (newest on top)
    const sortedComponents = [...components].sort((a, b) => {
      const aZ = getComponentZOrder(a);
      const bZ = getComponentZOrder(b);
      
      if (aZ.isUtility && !bZ.isUtility) return 1;
      if (!aZ.isUtility && bZ.isUtility) return -1;
      
      return bZ.timestamp - aZ.timestamp;
    });

    // Check each side and component
    for (const [side, sideLayout] of Object.entries(layout)) {
      if (side === 'totalWidth' || side === 'totalHeight') continue;
      if (typeof sideLayout === 'number') continue;

      const sideName = (side.charAt(0).toUpperCase() + side.slice(1)) as EnclosureSide;
      const sideComponents = sortedComponents.filter(c => c.side === sideName);
      
      const sideX = layoutX - sideLayout.x - sideLayout.width / 2;
      const sideY = layoutY - sideLayout.y - sideLayout.height / 2;

      for (const component of sideComponents) {
        const compData = COMPONENT_TYPES[component.type];
        if (!compData) continue;

        let isHovering = false;

        if (compData.shape === 'rectangle' || compData.shape === 'square') {
          const rectWidth = (compData.width || 10) * mmToPixels;
          const rectHeight = (compData.height || 10) * mmToPixels;
          const rotationRad = (component.rotation * Math.PI) / 180;
          
          const dx = sideX - component.x;
          const dy = sideY - component.y;
          
          const cos = Math.cos(-rotationRad);
          const sin = Math.sin(-rotationRad);
          const rotatedDx = dx * cos - dy * sin;
          const rotatedDy = dx * sin + dy * cos;
          
          if (
            Math.abs(rotatedDx) <= rectWidth / 2 && 
            Math.abs(rotatedDy) <= rectHeight / 2
          ) {
            isHovering = true;
          }
        } else {
          const radius = (compData.drillSize / 2) * mmToPixels;
          const dx = sideX - component.x;
          const dy = sideY - component.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= radius + 10) {
            isHovering = true;
          }
        }

        if (isHovering) {
          return component.id;
        }
      }
    }
    
    return null;
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
        const backWidth = sideLayout.width;
        const frontWidth = sideData.frontWidth * mmToPixels;
        const height = sideLayout.height;
        
        ctx.beginPath();
        if (side === 'left') {
          // Left side: wide at top (back), narrow at bottom (front)
          // Horizontally mirrored to connect to front panel correctly
          ctx.moveTo(backWidth, 0);
          ctx.lineTo(0, 0);
          ctx.lineTo(backWidth - frontWidth, height);
          ctx.lineTo(backWidth, height);
        } else {
          // Right side: wide at top (back), narrow at bottom (front)
          ctx.moveTo(0, 0);
          ctx.lineTo(backWidth, 0);
          ctx.lineTo(frontWidth, height);
          ctx.lineTo(0, height);
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

      // Draw side label (always readable, counter-rotated from canvas rotation)
      ctx.save();
      ctx.translate(sideLayout.width / 2, sideLayout.height / 2);
      ctx.rotate((-rotation * Math.PI) / 180);
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
        COMPONENT_TYPES[c.type].category === "Footprint Guides"
      );
      const regularComponents = sideComponents.filter(c => 
        COMPONENT_TYPES[c.type].category !== "Footprint Guides"
      );

      // Draw utility guides first (behind regular components)
      [...utilityGuides, ...regularComponents].forEach(component => {
        const compData = COMPONENT_TYPES[component.type];
        if (!compData) return;
        
        const centerX = sideLayout.width / 2 + component.x;
        const centerY = sideLayout.height / 2 + component.y;

        // Check if this is a utility guide (not printed)
        const isUtilityGuide = compData.category === "Footprint Guides";

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

        // Start a new drawing context for this component
        ctx.save();

        // Highlight selected component
        if (selectedComponent === component.id) {
          ctx.save();
          ctx.fillStyle = "#ff8c42";
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          
          if (compData.shape === 'rectangle' || compData.shape === 'square') {
            // Apply rotation for the highlight too
            ctx.translate(centerX, centerY);
            ctx.rotate((component.rotation * Math.PI) / 180);
            
            const rectWidth = (compData.width || 10) * mmToPixels;
            const rectHeight = (compData.height || 10) * mmToPixels;
            ctx.rect(
              -rectWidth / 2 - 10 / zoom,
              -rectHeight / 2 - 10 / zoom,
              rectWidth + 20 / zoom,
              rectHeight + 20 / zoom
            );
          } else {
            const radius = (compData.drillSize / 2) * mmToPixels;
            ctx.arc(centerX, centerY, radius + 10 / zoom, 0, 2 * Math.PI);
          }
          ctx.fill();
          ctx.restore();
          ctx.globalAlpha = 1;
        }

        // Draw the component based on shape
        if (compData.shape === 'rectangle' || compData.shape === 'square') {
          // Apply rotation for rectangle components
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate((component.rotation * Math.PI) / 180);
          
          const rectWidthPx = (compData.width || 10) * mmToPixels;
          const rectHeightPx = (compData.height || 10) * mmToPixels;
          
          // Draw fill - transparent for utility guides, white for regular components
          if (isUtilityGuide) {
            ctx.fillStyle = "transparent";
          } else {
            ctx.fillStyle = "white";
          }
          ctx.fillRect(
            -rectWidthPx / 2,
            -rectHeightPx / 2,
            rectWidthPx,
            rectHeightPx
          );
          
          // Draw warning outline if needed (only for non-utility guides)
          if (showWarning && !isUtilityGuide) {
            ctx.save();
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 2 / zoom;
            ctx.strokeRect(
              -rectWidthPx / 2 - 5 / zoom,
              -rectHeightPx / 2 - 5 / zoom,
              rectWidthPx + 10 / zoom,
              rectHeightPx + 10 / zoom
            );
            ctx.restore();
          }
          
          // Draw main outline - ALWAYS set stroke style explicitly
          const componentStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
          ctx.strokeStyle = componentStrokeStyle;
          ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
          
          if (isUtilityGuide) {
            ctx.setLineDash([5 / zoom, 5 / zoom]);
          }
          
          ctx.strokeRect(
            -rectWidthPx / 2,
            -rectHeightPx / 2,
            rectWidthPx,
            rectHeightPx
          );
          
          if (isUtilityGuide) {
            ctx.setLineDash([]);
          }
          
          // Draw crosshair (only for non-utility guides)
          if (!isUtilityGuide) {
            const crosshairSizeHorizontal = rectWidthPx / 2;
            const crosshairSizeVertical = rectHeightPx / 2;
            // ALWAYS set crosshair stroke style explicitly
            const crosshairStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
            ctx.strokeStyle = crosshairStrokeStyle;
            ctx.lineWidth = 1 / zoom;
            ctx.beginPath();
            ctx.moveTo(-crosshairSizeHorizontal, 0);
            ctx.lineTo(crosshairSizeHorizontal, 0);
            ctx.moveTo(0, -crosshairSizeVertical);
            ctx.lineTo(0, crosshairSizeVertical);
            ctx.stroke();
          }
          
          ctx.restore();
          
          // Draw label with positioning that accounts for both rotations
          const labelPos = calculateLabelPosition(
            centerX,
            centerY,
            component.rotation || 0,  // Component's own rotation (0° or 90°)
            rotation,                  // Canvas rotation (0° or 90°)
            zoom,
            true,                      // Is rectangular
            rectWidthPx,
            rectHeightPx
          );
          
          ctx.save();
          ctx.translate(labelPos.x, labelPos.y);
          ctx.rotate(labelPos.textAngle);
          
          const labelText = getRotatedLabelText(compData, component.rotation || 0, rotation, unit);
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
          
        } else if (compData.shape === 'circle') {
          // CIRCLE RENDERING (for both regular components and utility guides)
          const radiusPx = (compData.drillSize / 2) * mmToPixels;
          
          // Draw drill hole - transparent for utility guides, white for regular components
          if (isUtilityGuide) {
            ctx.fillStyle = "transparent";
          } else {
            ctx.fillStyle = "white";
          }
          ctx.beginPath();
          ctx.arc(centerX, centerY, radiusPx, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw warning ring if needed (only for non-utility guides)
          if (showWarning && !isUtilityGuide) {
            ctx.save();
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radiusPx + 5 / zoom, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
          }
          
          // Draw stroke - ALWAYS set stroke style explicitly
          const componentStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
          ctx.strokeStyle = componentStrokeStyle;
          ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
          
          if (isUtilityGuide) {
            ctx.setLineDash([5 / zoom, 5 / zoom]);
          }
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radiusPx, 0, 2 * Math.PI);
          ctx.stroke();
          
          if (isUtilityGuide) {
            ctx.setLineDash([]);
          }

          // Draw crosshair (only for non-utility guides)
          if (!isUtilityGuide) {
            const crosshairSize = radiusPx;
            // ALWAYS set crosshair stroke style explicitly
            const crosshairStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
            ctx.strokeStyle = crosshairStrokeStyle;
            ctx.lineWidth = 1 / zoom;
            ctx.beginPath();
            ctx.moveTo(centerX - crosshairSize, centerY);
            ctx.lineTo(centerX + crosshairSize, centerY);
            ctx.moveTo(centerX, centerY - crosshairSize);
            ctx.lineTo(centerX, centerY + crosshairSize);
            ctx.stroke();
          }

          // Draw label with positioning that accounts for both rotations
          const labelPos = calculateLabelPosition(
            centerX,
            centerY,
            component.rotation || 0,  // Component's own rotation (0° or 90°)
            rotation,                  // Canvas rotation (0° or 90°)
            zoom,
            false,                     // Is circular
            undefined,
            undefined,
            radiusPx
          );
          
          ctx.save();
          ctx.translate(labelPos.x, labelPos.y);
          ctx.rotate(labelPos.textAngle);
          
          const labelText = getRotatedLabelText(compData, component.rotation || 0, rotation, unit);
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
          // Fallback: For components without explicit shape, assume circle if they have drillSize > 0
          if (compData.drillSize > 0) {
            // CIRCLE RENDERING fallback
            const radiusPx = (compData.drillSize / 2) * mmToPixels;
            
            if (isUtilityGuide) {
              ctx.fillStyle = "transparent";
            } else {
              ctx.fillStyle = "white";
            }
            ctx.beginPath();
            ctx.arc(centerX, centerY, radiusPx, 0, 2 * Math.PI);
            ctx.fill();
            
            const componentStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
            ctx.strokeStyle = componentStrokeStyle;
            ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
            
            if (isUtilityGuide) {
              ctx.setLineDash([5 / zoom, 5 / zoom]);
            }
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radiusPx, 0, 2 * Math.PI);
            ctx.stroke();
            
            if (isUtilityGuide) {
              ctx.setLineDash([]);
            }

            // Draw crosshair (only for non-utility guides)
            if (!isUtilityGuide) {
              const crosshairStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
              ctx.strokeStyle = crosshairStrokeStyle;
              ctx.lineWidth = 1 / zoom;
              ctx.beginPath();
              ctx.moveTo(centerX - radiusPx, centerY);
              ctx.lineTo(centerX + radiusPx, centerY);
              ctx.moveTo(centerX, centerY - radiusPx);
              ctx.lineTo(centerX, centerY + radiusPx);
              ctx.stroke();
            }
          } else {
            // If no shape and no drillSize, draw a small rectangle as fallback
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate((component.rotation || 0) * Math.PI / 180);
            
            const rectWidthPx = 10 * mmToPixels;
            const rectHeightPx = 10 * mmToPixels;
            
            if (isUtilityGuide) {
              ctx.fillStyle = "transparent";
            } else {
              ctx.fillStyle = "white";
            }
            ctx.fillRect(-rectWidthPx/2, -rectHeightPx/2, rectWidthPx, rectHeightPx);
            
            const componentStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--foreground))";
            ctx.strokeStyle = componentStrokeStyle;
            ctx.lineWidth = (selectedComponent === component.id ? 2.5 : 2) / zoom;
            
            if (isUtilityGuide) {
              ctx.setLineDash([5 / zoom, 5 / zoom]);
            }
            
            ctx.strokeRect(-rectWidthPx/2, -rectHeightPx/2, rectWidthPx, rectHeightPx);
            
            if (isUtilityGuide) {
              ctx.setLineDash([]);
            }
            
            if (!isUtilityGuide) {
              const crosshairStrokeStyle = selectedComponent === component.id ? "#ff8c42" : "hsl(var(--muted-foreground))";
              ctx.strokeStyle = crosshairStrokeStyle;
              ctx.lineWidth = 1 / zoom;
              ctx.beginPath();
              ctx.moveTo(-rectWidthPx/2, 0);
              ctx.lineTo(rectWidthPx/2, 0);
              ctx.moveTo(0, -rectHeightPx/2);
              ctx.lineTo(0, rectHeightPx/2);
              ctx.stroke();
            }
            
            ctx.restore();
          }
        }

        // Restore the drawing context for this component
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
  }, [components, zoom, rotation, gridEnabled, gridSize, unit, selectedComponent, panOffset, enclosureType, resizeTrigger, rotatesLabels]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setResizeTrigger(prev => prev + 1);
      
      // Auto-zoom on resize if enabled
      if (autoZoomToFit && onZoomChange && enclosureType) {
        // Debounce resize events
        const timer = setTimeout(() => {
          handleZoomToFit();
        }, 250);
        
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoZoomToFit, onZoomChange, enclosureType, handleZoomToFit]);

  // Auto-zoom when enclosure changes
  useEffect(() => {
    if (autoZoomToFit && onZoomChange && enclosureType && !hasAutoZoomed) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        handleZoomToFit();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [enclosureType, autoZoomToFit, onZoomChange, hasAutoZoomed, handleZoomToFit]);

  // Reset auto-zoom flag when enclosure changes
  useEffect(() => {
    setHasAutoZoomed(false);
  }, [enclosureType]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Middle-click (button 1) starts panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setCursorStyle('grabbing');
      setDragStart({ x: mouseX - panOffset.x, y: mouseY - panOffset.y });
      return;
    }

    // Right-click for context menu
    if (e.button === 2) {
      e.preventDefault();
      
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

      // Sort components by type and z-order
      const sortedComponents = [...components].sort((a, b) => {
        const aZ = getComponentZOrder(a);
        const bZ = getComponentZOrder(b);
        
        // First: Regular components before utility guides
        if (aZ.isUtility && !bZ.isUtility) return 1;
        if (!aZ.isUtility && bZ.isUtility) return -1;
        
        // Second: Both same type, newer components first (higher timestamp)
        return bZ.timestamp - aZ.timestamp;
      });

      for (const [side, sideLayout] of Object.entries(layout)) {
        if (side === 'totalWidth' || side === 'totalHeight') continue;
        if (typeof sideLayout === 'number') continue;

        const sideName = (side.charAt(0).toUpperCase() + side.slice(1)) as EnclosureSide;
        const sideComponents = sortedComponents.filter(c => c.side === sideName);
        
        const sideX = canvasX - sideLayout.x - sideLayout.width / 2;
        const sideY = canvasY - sideLayout.y - sideLayout.height / 2;

        for (const component of sideComponents) {
          const compData = COMPONENT_TYPES[component.type];
          let isClicked = false;

          if (compData.shape === 'rectangle' || compData.shape === 'square') {
            const rectWidth = (compData.width || 10) * mmToPixels;
            const rectHeight = (compData.height || 10) * mmToPixels;
            const rotationRad = (component.rotation * Math.PI) / 180;
            
            // Transform click point to component's rotated coordinate system
            const dx = sideX - component.x;
            const dy = sideY - component.y;
            
            // Inverse rotation
            const cos = Math.cos(-rotationRad);
            const sin = Math.sin(-rotationRad);
            const rotatedDx = dx * cos - dy * sin;
            const rotatedDy = dx * sin + dy * cos;
            
            // Check if within original (unrotated) bounds
            if (
              Math.abs(rotatedDx) <= rectWidth / 2 && 
              Math.abs(rotatedDy) <= rectHeight / 2
            ) {
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
            break;
          }
        }
        
        if (clickedComponent) break;
      }

      // Call the right-click handler
      onRightClick?.(e, clickedComponent?.id || null);
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

    // Sort components by type and z-order
    const sortedComponents = [...components].sort((a, b) => {
      const aZ = getComponentZOrder(a);
      const bZ = getComponentZOrder(b);
      
      // First: Regular components before utility guides
      if (aZ.isUtility && !bZ.isUtility) return 1;
      if (!aZ.isUtility && bZ.isUtility) return -1;
      
      // Second: Both same type, newer components first (higher timestamp)
      return bZ.timestamp - aZ.timestamp;
    });

    for (const [side, sideLayout] of Object.entries(layout)) {
      if (side === 'totalWidth' || side === 'totalHeight') continue;
      if (typeof sideLayout === 'number') continue;

      const sideName = (side.charAt(0).toUpperCase() + side.slice(1)) as EnclosureSide;
      const sideComponents = sortedComponents.filter(c => c.side === sideName);
      
      const sideX = canvasX - sideLayout.x - sideLayout.width / 2;
      const sideY = canvasY - sideLayout.y - sideLayout.height / 2;

      for (const component of sideComponents) {
        const compData = COMPONENT_TYPES[component.type];
        let isClicked = false;

        if (compData.shape === 'rectangle' || compData.shape === 'square') {
          const rectWidth = (compData.width || 10) * mmToPixels;
          const rectHeight = (compData.height || 10) * mmToPixels;
          const rotationRad = (component.rotation * Math.PI) / 180;
          
          // Transform click point to component's rotated coordinate system
          const dx = sideX - component.x;
          const dy = sideY - component.y;
          
          // Inverse rotation
          const cos = Math.cos(-rotationRad);
          const sin = Math.sin(-rotationRad);
          const rotatedDx = dx * cos - dy * sin;
          const rotatedDy = dx * sin + dy * cos;
          
          // Check if within original (unrotated) bounds
          if (
            Math.abs(rotatedDx) <= rectWidth / 2 && 
            Math.abs(rotatedDy) <= rectHeight / 2
          ) {
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
          break;
        }
      }
      
      if (clickedComponent) break;
    }

    if (clickedComponent) {
      onSelectComponent(clickedComponent.id);
      setDraggedComponent(clickedComponent.id);
      setDragStart({ x: clickedSideX, y: clickedSideY });
      setIsDragging(true);
      setCursorStyle('grabbing'); // Change to grab when starting to drag
    } else {
      onSelectComponent(null);
      onCanvasClick?.();
      setCursorStyle('default');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning) {
      setCursorStyle('grabbing');
      setPanOffset({
        x: mouseX - dragStart.x,
        y: mouseY - dragStart.y,
      });
      return;
    }

    // Check for component hover
    const hoveredComponentId = detectHoveredComponent(mouseX, mouseY);

    // Update cursor based on state
    if (hoveredComponentId) {
      if (isDragging) {
        setCursorStyle('grabbing');
      } else {
        setCursorStyle('move');
      }
      setIsHoveringComponent(hoveredComponentId);
    } else {
      setCursorStyle('default');
      setIsHoveringComponent(null);
    }

    // Existing drag logic
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

      // Detect which side contains the cursor position
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
    const wasPanning = isPanning;
    
    setIsDragging(false);
    setDraggedComponent(null);
    setIsPanning(false);
    
    // Reset cursor based on hover state
    if (isHoveringComponent) {
      setCursorStyle('move');
    } else {
      setCursorStyle('default');
    }
    
    if (wasDragging) {
      setJustFinishedDrag(true);
      setTimeout(() => setJustFinishedDrag(false), 300);
    }
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    setCursorStyle('default');
    setIsHoveringComponent(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (justFinishedDrag) {
      e.preventDefault();
      e.stopPropagation();
      setJustFinishedDrag(false);
      return;
    }
  };

  // Update cursor when hovering state changes
  useEffect(() => {
    if (!isDragging && !isPanning) {
      if (isHoveringComponent) {
        setCursorStyle('move');
      } else {
        setCursorStyle('default');
      }
    }
  }, [isHoveringComponent, isDragging, isPanning]);

  // Get cursor class based on cursorStyle state
  const getCursorClass = () => {
    switch (cursorStyle) {
      case 'default': return 'cursor-default';
      case 'move': return 'cursor-move';
      case 'grabbing': return 'cursor-grabbing';
      default: return 'cursor-default';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${getCursorClass()}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
            className="w-9 h-9 rounded-md bg-[#ff8c42] text-white flex items-center justify-center hover-elevate active-elevate-2 cursor-pointer"
            data-testid="button-delete-selected"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}
      
      {/* Zoom to Fit button - only shown when onZoomChange is provided */}
      {onZoomChange && (
        <button
          onClick={handleZoomToFit}
          className="absolute bottom-4 right-4 px-3 py-2 bg-primary text-primary-foreground rounded-md hover-elevate z-50 cursor-pointer"
          title="Zoom to Fit Enclosure (only scales down if needed)"
          data-testid="button-zoom-to-fit"
        >
          Fit
        </button>
      )}
    </div>
  );
}