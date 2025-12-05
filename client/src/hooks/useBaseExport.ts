import { useCallback } from "react";
import { EnclosureType, ENCLOSURE_TYPES, COMPONENT_TYPES, getUnwrappedDimensions } from "@/types/schema";

interface UseBaseExportProps {
  enclosureTypeRef: React.MutableRefObject<EnclosureType>;
  componentsRef: React.MutableRefObject<any[]>;
  unitRef: React.MutableRefObject<any>;
  rotationRef: React.MutableRefObject<number>;
}

// Central configuration for print/export styling
const PRINT_CONFIG = {
  // Line widths
  lineWidths: {
    enclosureBorder: 0.5,           // Border around enclosure sides
    componentBorder: 0.25,         // Border around components (lineWidth - 1)
    componentCrosshair: 0.25,      // Crosshair lines for components
  },
  
  // Font settings
  fonts: {
    sideLabel: {
      size: 12,                   // Size for side labels (Front, Top, etc.)
      family: 'Arial',
      style: 'normal',            // 'normal', 'bold', 'italic'
      color: '#000000'
    },
    componentLabel: {
      size: 10,                   // Size for component dimension labels
      family: 'Arial',
      style: 'normal',
      color: '#000000'
    }
  },
  
  // Component styling
  components: {
    labelOffset: 15,              // Distance from component to its label
    labelBackgroundPadding: 4,    // Padding around label text background
    crosshairSize: 10,            // Minimum crosshair size in pixels
  },
  
  // Enclosure styling
  enclosure: {
    frontCornerRadius: 5,         // Corner radius for front panel in mm
  }
};

// Quality presets for different export types
const QUALITY_PRESETS = {
  print: {
    ...PRINT_CONFIG,
    // No changes needed for print - use base config
  },
  pdf: {
    ...PRINT_CONFIG,
    // PDF can have slightly enhanced settings if desired
    lineWidths: {
      ...PRINT_CONFIG.lineWidths,
      enclosureBorder: 1.2,
    },
    fonts: {
      ...PRINT_CONFIG.fonts,
      sideLabel: {
        ...PRINT_CONFIG.fonts.sideLabel,
        size: 15,
      }
    }
  }
};

// Helper function for rotated side labels
const getRotatedSideLabel = (side: string, rotation: number, rotatesLabels: boolean): string => {
  if (!rotatesLabels || rotation === 0) {
    return side;
  }
  
  const rotationMap: Record<string, string> = {
    'Front': 'Front',
    'Left': 'Top',
    'Top': 'Right', 
    'Right': 'Bottom',
    'Bottom': 'Left'
  };
  
  return rotationMap[side] || side;
};

/**
 * Calculate label position for print/PDF export.
 * Mirrors the logic from UnwrappedCanvas.tsx's calculateLabelPosition.
 * 
 * @param centerX - Component center X in pixels
 * @param centerY - Component center Y in pixels
 * @param componentRotation - Component's own rotation (0° or 90°)
 * @param canvasRotation - User's canvas rotation (0° or 90°)
 * @param isRectangular - Whether component is rectangular
 * @param rectWidthPx - Rectangle width in pixels (for rectangular components)
 * @param rectHeightPx - Rectangle height in pixels (for rectangular components)
 * @param radiusPx - Circle radius in pixels (for circular components)
 * @param labelOffset - Offset distance from component edge
 */
const calculateLabelPosition = (
  centerX: number,
  centerY: number,
  componentRotation: number,
  canvasRotation: number,
  isRectangular: boolean,
  rectWidthPx?: number,
  rectHeightPx?: number,
  radiusPx?: number,
  labelOffset: number = 15
): { x: number; y: number; textAngle: number } => {
  
  if (isRectangular && rectWidthPx !== undefined && rectHeightPx !== undefined) {
    // Determine visual orientation based on component rotation
    const visualWidthPx = componentRotation === 0 ? rectWidthPx : rectHeightPx;
    const visualHeightPx = componentRotation === 0 ? rectHeightPx : rectWidthPx;
    
    let labelX = centerX;
    let labelY = centerY;
    
    if (canvasRotation === 0) {
      // Canvas not rotated: label below rectangle
      labelX = centerX;
      labelY = centerY + visualHeightPx / 2 + labelOffset;
    } else { // canvasRotation === 90
      // Canvas rotated 90°: label to the right of rectangle (which is visual bottom)
      labelX = centerX + visualWidthPx / 2 + labelOffset;
      labelY = centerY;
    }
    
    // Keep text horizontal (counter-rotate by canvas rotation only)
    // Negative angle to counter-rotate back to horizontal
    const textAngle = canvasRotation === 0 ? 0 : -Math.PI / 2;
    
    return { x: labelX, y: labelY, textAngle };
    
  } else {
    // Circles: label position depends only on canvas rotation
    const circleRadius = radiusPx || 0;
    
    if (canvasRotation === 0) {
      // Canvas not rotated: label below circle
      return {
        x: centerX,
        y: centerY + circleRadius + labelOffset,
        textAngle: 0
      };
    } else { // canvasRotation === 90
      // Canvas rotated 90°: label to the right of circle
      return {
        x: centerX + circleRadius + labelOffset,
        y: centerY,
        textAngle: -Math.PI / 2
      };
    }
  }
};

export function useBaseExport({
  enclosureTypeRef,
  componentsRef,
  unitRef,
  rotationRef
}: UseBaseExportProps) {
  const getOptimalRotation = useCallback((enclosureType: EnclosureType): boolean => {
    const dimensions = getUnwrappedDimensions(enclosureType);
    const totalWidth = dimensions.left.width + dimensions.front.width + dimensions.right.width;
    const totalHeight = dimensions.top.height + dimensions.front.height + dimensions.bottom.height;
    return totalWidth > totalHeight;
  }, []);

  const getPageDimensions = useCallback((enclosureType: EnclosureType, shouldRotate: boolean) => {
    const dimensions = getUnwrappedDimensions(enclosureType);
    const totalWidth = dimensions.left.width + dimensions.front.width + dimensions.right.width;
    const totalHeight = dimensions.top.height + dimensions.front.height + dimensions.bottom.height;
    
    return {
      width: shouldRotate ? totalHeight : totalWidth,
      height: shouldRotate ? totalWidth : totalHeight
    };
  }, []);

  const getPrintableComponents = useCallback((components: any[]): any[] => {
    return components.filter(component => {
      // If component is explicitly marked to exclude from print, exclude it
      if (component.excludeFromPrint) {
        return false;
      }
      
      // If component is explicitly marked to include (excludeFromPrint === false), include it
      if (component.excludeFromPrint === false) {
        return true;
      }
      
      // Default behavior: exclude Footprint Guides, include everything else
      const compData = COMPONENT_TYPES[component.type];
      const isUtilityGuide = compData.category === "Footprint Guides";
      return !isUtilityGuide;
    });
  }, []);

  const renderCanvas = useCallback((
    currentEnclosureType: EnclosureType, 
    shouldRotate: boolean = false, 
    currentRotation: number = 0,
    options: {
      forPDF?: boolean;
      forPrint?: boolean;
    } = {}
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const dimensions = getUnwrappedDimensions(currentEnclosureType);
        const currentUnit = unitRef.current;
        const rotatesLabels = ENCLOSURE_TYPES[currentEnclosureType].rotatesLabels || false;
        const printableComponents = getPrintableComponents(componentsRef.current);

        // Select quality preset based on export type
        const config = options.forPDF ? QUALITY_PRESETS.pdf : QUALITY_PRESETS.print;

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

        // Use EXACT 96 DPI calculation for 1:1 scale
        const PIXELS_PER_INCH = 96;
        const MM_PER_INCH = 25.4;
        const pixelsPerMM = PIXELS_PER_INCH / MM_PER_INCH; // 3.779527559055118

        // Round UP to nearest pixel to ensure full coverage
        const canvasWidth = Math.ceil(totalWidthMM * pixelsPerMM);
        const canvasHeight = Math.ceil(totalHeightMM * pixelsPerMM);

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        // Set explicit physical dimensions
        canvas.style.width = `${totalWidthMM}mm`;
        canvas.style.height = `${totalHeightMM}mm`;
        
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set DPI metadata
        canvas.setAttribute('data-dpi', '96');
        canvas.setAttribute('data-scale', '100%');

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
            ? getRotatedSideLabel(originalLabel, currentRotation, rotatesLabels)
            : originalLabel;

          // Draw enclosure border using central config
          ctx.strokeStyle = config.fonts.sideLabel.color;
          ctx.lineWidth = config.lineWidths.enclosureBorder;
          
          if (sideKey === 'front') {
            const cornerRadius = config.enclosure.frontCornerRadius * pixelsPerMM;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, cornerRadius);
            ctx.stroke();
          } else {
            // Draw borders selectively to avoid overlapping lines
            ctx.beginPath();
            
            if (sideKey === 'top') {
              // Top: draw top, left, right (bottom overlaps with front)
              ctx.moveTo(x, y);
              ctx.lineTo(x + w, y); // top edge
              ctx.lineTo(x + w, y + h); // right edge
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + h); // left edge
            } else if (sideKey === 'bottom') {
              // Bottom: draw left, right, bottom (top overlaps with front)
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + h); // left edge
              ctx.lineTo(x + w, y + h); // bottom edge
              ctx.lineTo(x + w, y); // right edge
            } else if (sideKey === 'left') {
              // Left: draw top, left, bottom (right overlaps with front)
              ctx.moveTo(x, y);
              ctx.lineTo(x + w, y); // top edge
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + h); // left edge
              ctx.lineTo(x + w, y + h); // bottom edge
            } else if (sideKey === 'right') {
              // Right: draw top, right, bottom (left overlaps with front)
              ctx.moveTo(x, y);
              ctx.lineTo(x + w, y); // top edge
              ctx.lineTo(x + w, y + h); // right edge
              ctx.lineTo(x, y + h); // bottom edge
            }
            
            ctx.stroke();
          }

          // Draw side label using central config
          ctx.save();
          ctx.fillStyle = config.fonts.sideLabel.color;
          ctx.font = `${config.fonts.sideLabel.style} ${config.fonts.sideLabel.size}px ${config.fonts.sideLabel.family}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          if (rotatesLabels && currentRotation !== 0) {
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(displayLabel, 0, 0);
          } else {
            ctx.fillText(displayLabel, x + w / 2, y + h / 2);
          }
          ctx.restore();

          const sideComponents = printableComponents.filter((c: any) => c.side === originalLabel);

          sideComponents.forEach((component: any) => {
            const compData = COMPONENT_TYPES[component.type];
            const centerX = x + (w / 2) + component.x;
            const centerY = y + (h / 2) + component.y;

            // Check if this is a utility guide (Footprint Guide)
            const isUtilityGuide = compData.category === "Footprint Guides";

            if (compData.shape === 'rectangle' || compData.shape === 'square') {
              ctx.save();
              if (component.rotation) {
                ctx.translate(centerX, centerY);
                ctx.rotate((component.rotation * Math.PI) / 180);
              }
              
              const baseWidth = (compData.width || 10) * pixelsPerMM;
              const baseHeight = (compData.height || 10) * pixelsPerMM;
              
              const drawX = component.rotation ? -baseWidth / 2 : centerX - baseWidth / 2;
              const drawY = component.rotation ? -baseHeight / 2 : centerY - baseHeight / 2;
              
              // Fill: transparent for utility guides, white for regular components
              if (isUtilityGuide) {
                ctx.fillStyle = 'transparent';
              } else {
                ctx.fillStyle = 'white';
              }
              ctx.fillRect(drawX, drawY, baseWidth, baseHeight);
              
              ctx.strokeStyle = config.fonts.sideLabel.color;
              ctx.lineWidth = config.lineWidths.componentBorder;
              
              // Use dashed line for utility guides
              if (isUtilityGuide) {
                ctx.setLineDash([5, 5]);
              }
              
              ctx.strokeRect(drawX, drawY, baseWidth, baseHeight);
              
              if (isUtilityGuide) {
                ctx.setLineDash([]);
              }
              
              // Draw crosshair only for non-utility guides
              if (!isUtilityGuide) {
                const crosshairSizeH = Math.max(baseWidth / 2, config.components.crosshairSize);
                const crosshairSizeV = Math.max(baseHeight / 2, config.components.crosshairSize);
                
                ctx.lineWidth = config.lineWidths.componentCrosshair;
                ctx.beginPath();
                if (component.rotation) {
                  ctx.moveTo(-crosshairSizeH, 0);
                  ctx.lineTo(crosshairSizeH, 0);
                  ctx.moveTo(0, -crosshairSizeV);
                  ctx.lineTo(0, crosshairSizeV);
                } else {
                  ctx.moveTo(centerX - crosshairSizeH, centerY);
                  ctx.lineTo(centerX + crosshairSizeH, centerY);
                  ctx.moveTo(centerX, centerY - crosshairSizeV);
                  ctx.lineTo(centerX, centerY + crosshairSizeV);
                }
                ctx.stroke();
              }

              ctx.restore();

              // Only draw labels for non-utility guides
              if (!isUtilityGuide) {
                // FIXED: Use calculateLabelPosition to match on-screen behavior
                const labelPos = calculateLabelPosition(
                  centerX,
                  centerY,
                  component.rotation || 0,  // Component's own rotation
                  currentRotation,           // User's canvas rotation setting
                  true,                      // Is rectangular
                  baseWidth,
                  baseHeight,
                  undefined,
                  config.components.labelOffset
                );

                // Generate label text (swap dimensions for 90° component rotation)
                const labelText = component.rotation === 90 
                  ? currentUnit === "metric"
                    ? `${compData.height}mm×${compData.width}mm`
                    : compData.imperialLabel
                  : currentUnit === "metric"
                    ? `${compData.width}mm×${compData.height}mm`
                    : compData.imperialLabel;

                ctx.save();
                ctx.translate(labelPos.x, labelPos.y);
                ctx.rotate(labelPos.textAngle);

                ctx.font = `${config.fonts.componentLabel.style} ${config.fonts.componentLabel.size}px ${config.fonts.componentLabel.family}`;
                const textMetrics = ctx.measureText(labelText);
                const textWidth = textMetrics.width;
                const padding = config.components.labelBackgroundPadding;

                // Draw label background
                ctx.fillStyle = 'white';
                ctx.fillRect(
                  -textWidth / 2 - padding,
                  -config.fonts.componentLabel.size / 2 - padding,
                  textWidth + padding * 2,
                  config.fonts.componentLabel.size + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, 0, 0);
                
                ctx.restore();
              }
              
              // Footprint Guide labels (commented out - uncomment to show labels for utility guides)
              // else {
              //   const labelPos = calculateLabelPosition(
              //     centerX,
              //     centerY,
              //     component.rotation || 0,
              //     currentRotation,
              //     true,
              //     baseWidth,
              //     baseHeight,
              //     undefined,
              //     config.components.labelOffset
              //   );
              //
              //   const labelText = component.rotation === 90 
              //     ? currentUnit === "metric"
              //       ? `${compData.height}mm×${compData.width}mm`
              //       : compData.imperialLabel
              //     : currentUnit === "metric"
              //       ? `${compData.width}mm×${compData.height}mm`
              //       : compData.imperialLabel;
              //
              //   ctx.save();
              //   ctx.translate(labelPos.x, labelPos.y);
              //   ctx.rotate(labelPos.textAngle);
              //
              //   ctx.font = `${config.fonts.componentLabel.style} ${config.fonts.componentLabel.size}px ${config.fonts.componentLabel.family}`;
              //   const textMetrics = ctx.measureText(labelText);
              //   const textWidth = textMetrics.width;
              //   const padding = config.components.labelBackgroundPadding;
              //
              //   ctx.fillStyle = 'white';
              //   ctx.fillRect(
              //     -textWidth / 2 - padding,
              //     -config.fonts.componentLabel.size / 2 - padding,
              //     textWidth + padding * 2,
              //     config.fonts.componentLabel.size + padding * 2
              //   );
              //   
              //   ctx.fillStyle = config.fonts.componentLabel.color;
              //   ctx.textAlign = 'center';
              //   ctx.textBaseline = 'middle';
              //   ctx.fillText(labelText, 0, 0);
              //   
              //   ctx.restore();
              // }
              
            } else {
              // CIRCLE COMPONENTS
              const radius = (compData.drillSize / 2) * pixelsPerMM;

              // Fill: transparent for utility guides, white for regular components
              if (isUtilityGuide) {
                ctx.fillStyle = 'transparent';
              } else {
                ctx.fillStyle = 'white';
              }
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.fill();

              ctx.strokeStyle = config.fonts.sideLabel.color;
              ctx.lineWidth = config.lineWidths.componentBorder;
              
              // Use dashed line for utility guides
              if (isUtilityGuide) {
                ctx.setLineDash([5, 5]);
              }
              
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.stroke();
              
              if (isUtilityGuide) {
                ctx.setLineDash([]);
              }

              // Draw crosshair only for non-utility guides
              if (!isUtilityGuide) {
                const crosshairSize = Math.max(radius, config.components.crosshairSize);
                ctx.lineWidth = config.lineWidths.componentCrosshair;
                ctx.beginPath();
                ctx.moveTo(centerX - crosshairSize, centerY);
                ctx.lineTo(centerX + crosshairSize, centerY);
                ctx.moveTo(centerX, centerY - crosshairSize);
                ctx.lineTo(centerX, centerY + crosshairSize);
                ctx.stroke();
              }

              // Only draw labels for non-utility guides
              if (!isUtilityGuide) {
                // FIXED: Use calculateLabelPosition to match on-screen behavior
                const labelPos = calculateLabelPosition(
                  centerX,
                  centerY,
                  component.rotation || 0,  // Component's own rotation (not used for circles)
                  currentRotation,           // User's canvas rotation setting
                  false,                     // Is circular
                  undefined,
                  undefined,
                  radius,
                  config.components.labelOffset
                );

                const drillText = currentUnit === "metric"
                  ? `${compData.drillSize.toFixed(1)}mm`
                  : compData.imperialLabel;

                ctx.save();
                ctx.translate(labelPos.x, labelPos.y);
                ctx.rotate(labelPos.textAngle);

                ctx.font = `${config.fonts.componentLabel.style} ${config.fonts.componentLabel.size}px ${config.fonts.componentLabel.family}`;
                const textMetrics = ctx.measureText(drillText);
                const textWidth = textMetrics.width;
                const padding = config.components.labelBackgroundPadding;

                // Draw label background
                ctx.fillStyle = 'white';
                ctx.fillRect(
                  -textWidth / 2 - padding,
                  -config.fonts.componentLabel.size / 2 - padding,
                  textWidth + padding * 2,
                  config.fonts.componentLabel.size + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(drillText, 0, 0);
                
                ctx.restore();
              }
              
              // Footprint Guide labels (commented out - uncomment to show labels for utility guides)
              // else {
              //   const labelPos = calculateLabelPosition(
              //     centerX,
              //     centerY,
              //     component.rotation || 0,
              //     currentRotation,
              //     false,
              //     undefined,
              //     undefined,
              //     radius,
              //     config.components.labelOffset
              //   );
              //
              //   const drillText = currentUnit === "metric"
              //     ? `${compData.drillSize.toFixed(1)}mm`
              //     : compData.imperialLabel;
              //
              //   ctx.save();
              //   ctx.translate(labelPos.x, labelPos.y);
              //   ctx.rotate(labelPos.textAngle);
              //
              //   ctx.font = `${config.fonts.componentLabel.style} ${config.fonts.componentLabel.size}px ${config.fonts.componentLabel.family}`;
              //   const textMetrics = ctx.measureText(drillText);
              //   const textWidth = textMetrics.width;
              //   const padding = config.components.labelBackgroundPadding;
              //
              //   ctx.fillStyle = 'white';
              //   ctx.fillRect(
              //     -textWidth / 2 - padding,
              //     -config.fonts.componentLabel.size / 2 - padding,
              //     textWidth + padding * 2,
              //     config.fonts.componentLabel.size + padding * 2
              //   );
              //   
              //   ctx.fillStyle = config.fonts.componentLabel.color;
              //   ctx.textAlign = 'center';
              //   ctx.textBaseline = 'middle';
              //   ctx.fillText(drillText, 0, 0);
              //   
              //   ctx.restore();
              // }
            }
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
  }, [getPrintableComponents]);

  const prepareExportData = useCallback(async (options: {
    forPDF?: boolean;
    forPrint?: boolean;
  } = {}) => {
    const enclosureType = enclosureTypeRef.current;
    const currentRotation = rotationRef.current;
    
    const shouldRotate = getOptimalRotation(enclosureType);
    const pageDimensions = getPageDimensions(enclosureType, shouldRotate);

    const imageData = await renderCanvas(
      enclosureType,
      shouldRotate,
      currentRotation,
      options
    );

    return {
      imageData,
      pageDimensions,
      shouldRotate,
      currentRotation,
      enclosureType
    };
  }, [renderCanvas, getOptimalRotation, getPageDimensions]);

  return {
    prepareExportData,
    getOptimalRotation,
    getPageDimensions,
    getPrintableComponents,
    renderCanvas
  };
}