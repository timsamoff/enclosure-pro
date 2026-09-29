// Geometry shared by the on-screen canvas (UnwrappedCanvas) and the PDF export (useBaseExport),
// so the two renderers can't drift apart on where things go.
import type { EnclosureSide } from "@/types/schema";

// When the canvas is rotated 90° clockwise, enclosures with rotatesLabels show each side under
// the name of the side that now occupies its screen position.
const ROTATED_SIDE: Record<EnclosureSide, EnclosureSide> = {
  Front: "Front",
  Left: "Top",
  Top: "Right",
  Right: "Bottom",
  Bottom: "Left",
};

// Used during drags on a rotated canvas. Note: this is the SAME mapping as ROTATED_SIDE, not its
// inverse. useComponentManagement then applies the true inverse, so the stored side ends up being
// the screen region the component was dropped in. Change one only together with the other.
const ACTUAL_SIDE: Record<EnclosureSide, EnclosureSide> = {
  Front: "Front",
  Top: "Right",
  Right: "Bottom",
  Bottom: "Left",
  Left: "Top",
};

export function getRotatedSideLabel(side: EnclosureSide, rotation: number, rotatesLabels: boolean): EnclosureSide {
  if (!rotatesLabels || rotation === 0) return side;
  return ROTATED_SIDE[side] || side;
}

// Used when dragging on a rotated canvas (see the ACTUAL_SIDE note above).
export function getActualSideForDrag(canvasSide: EnclosureSide, rotation: number, rotatesLabels: boolean): EnclosureSide {
  if (!rotatesLabels || rotation === 0) return canvasSide;
  return ACTUAL_SIDE[canvasSide] || canvasSide;
}

/**
 * Where a component's label goes: at the visual bottom of the component after both the component's
 * own rotation and the canvas rotation (both 0° or 90°). Text stays horizontal on screen.
 * `offset` is the gap from the component edge in the caller's pixel units (screen: 15 / zoom;
 * export: labelOffset scaled to the export DPI).
 */
export function calculateLabelPosition(
  centerX: number,
  centerY: number,
  componentRotation: number,
  canvasRotation: number,
  isRectangular: boolean,
  rectWidthPx: number | undefined,
  rectHeightPx: number | undefined,
  radiusPx: number | undefined,
  offset: number
): { x: number; y: number; textAngle: number } {
  if (isRectangular && rectWidthPx !== undefined && rectHeightPx !== undefined) {
    const visualWidthPx = componentRotation === 0 ? rectWidthPx : rectHeightPx;
    const visualHeightPx = componentRotation === 0 ? rectHeightPx : rectWidthPx;
    const textAngle = (-canvasRotation * Math.PI) / 180;
    return canvasRotation === 0
      ? { x: centerX, y: centerY + visualHeightPx / 2 + offset, textAngle }
      : { x: centerX + visualWidthPx / 2 + offset, y: centerY, textAngle };
  }

  const r = radiusPx || 0;
  return canvasRotation === 0
    ? { x: centerX, y: centerY + r + offset, textAngle: 0 }
    : { x: centerX + r + offset, y: centerY, textAngle: -Math.PI / 2 };
}
