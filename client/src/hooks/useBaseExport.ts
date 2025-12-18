import { useCallback, type MutableRefObject } from "react";
import { EnclosureType, ENCLOSURE_TYPES, COMPONENT_TYPES, getUnwrappedDimensions } from "@/types/schema";

interface UseBaseExportProps {
  enclosureTypeRef: React.MutableRefObject<EnclosureType>;
  componentsRef: React.MutableRefObject<any[]>;
  unitRef: React.MutableRefObject<any>;
  rotationRef: React.MutableRefObject<number>;
}

// Base configuration for print/export styling
// Define base sizes that can be overridden by specific presets
const BASE_CONFIG = {
  // Line widths
  lineWidths: {
    enclosureBorder: 0.5,           // Border around enclosure sides
    componentBorder: 0.25,         // Border around components (lineWidth - 1)
    componentCrosshair: 0.25,      // Crosshair lines for components
  },
  
  // Font settings
  fonts: {
    sideLabel: {
      sizePt: 8,
      family: 'Arial',
      style: 'normal',
      color: '#000000'
    },
    componentLabel: {
      sizePt: 6,
      family: 'Arial',
      style: 'normal',
      color: '#000000'
    }
  },
  
  // Component styling
  components: {
    labelOffset: 7,              // Distance from component to its label (in mm)
    labelBackgroundPadding: 4,    // Padding around label text background
    crosshairSize: 10,            // Minimum crosshair size in pixels
  },
  
  // Enclosure styling
  enclosure: {
    frontCornerRadius: 5,         // Corner radius for front panel in mm
  }
};

// DPI configuration for different export types
const DPI_CONFIG = {
  print: 72,      // Standard print DPI (matches jsPDF default)
  pdf: 300        // High quality for PDF export
};

// Quality presets for different export types - THEY SHOULD REFERENCE BASE_CONFIG
const QUALITY_PRESETS = {
  print: {
    ...BASE_CONFIG,
    dpi: DPI_CONFIG.print,
    // Print-specific overrides go here
    lineWidths: {
      ...BASE_CONFIG.lineWidths,
      // No changes for print
    },
    fonts: {
      sideLabel: {
        ...BASE_CONFIG.fonts.sideLabel,
        // Use base font size for print
      },
      componentLabel: {
        ...BASE_CONFIG.fonts.componentLabel,
        // Use base font size for print
      }
    }
  },
  pdf: {
    ...BASE_CONFIG,
    dpi: DPI_CONFIG.pdf,
    // PDF-specific overrides
    lineWidths: {
      ...BASE_CONFIG.lineWidths,
      enclosureBorder: 1.2,
    },
    fonts: {
      sideLabel: {
        ...BASE_CONFIG.fonts.sideLabel,
        // Use base font size for PDF - NO OVERRIDE!
      },
      componentLabel: {
        ...BASE_CONFIG.fonts.componentLabel,
        // Use base font size for PDF - NO OVERRIDE!
      }
    }
  }
};

// Helper function to convert point size to canvas pixels based on DPI
const getCanvasFontSize = (pointSize: number, dpi: number): number => {
  // Convert points to inches: points / 72 = inches
  // Convert inches to pixels: inches * dpi = pixels
  return (pointSize / 72) * dpi;
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
      if (component.excludeFromPrint) {
        return false;
      }
      
      if (component.excludeFromPrint === false) {
        return true;
      }
      
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
      dpi?: number;
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
        
        // Choose DPI: explicit DPI param > forPDF/forPrint > default
        const targetDPI = options.dpi || (options.forPDF ? DPI_CONFIG.pdf : DPI_CONFIG.print);
        const MM_PER_INCH = 25.4;
        const pixelsPerMM = targetDPI / MM_PER_INCH; // DPI-aware pixels per mm
        const dpiScaleFactor = targetDPI / DPI_CONFIG.print; // Scale relative to 72 DPI

        // DEBUG: Log the font sizes being used
        console.log('Font sizes being used:', {
          sideLabelPt: config.fonts.sideLabel.sizePt,
          componentLabelPt: config.fonts.componentLabel.sizePt,
          targetDPI: targetDPI,
          sideLabelPixels: getCanvasFontSize(config.fonts.sideLabel.sizePt, targetDPI),
          componentLabelPixels: getCanvasFontSize(config.fonts.componentLabel.sizePt, targetDPI)
        });

        // Calculate actual canvas font sizes from point sizes
        const sideLabelCanvasSize = getCanvasFontSize(config.fonts.sideLabel.sizePt, targetDPI);
        const componentLabelCanvasSize = getCanvasFontSize(config.fonts.componentLabel.sizePt, targetDPI);

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

        // Canvas component positions use this conversion (from UnwrappedCanvas.tsx)
        const CANVAS_MM_TO_PIXELS = 3.7795275591;

        // Calculate canvas pixel dimensions using the target DPI
        const canvasWidth = Math.ceil(totalWidthMM * pixelsPerMM);
        const canvasHeight = Math.ceil(totalHeightMM * pixelsPerMM);

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        // CRITICAL: Keep the SAME physical dimensions in mm
        canvas.style.width = `${totalWidthMM}mm`;
        canvas.style.height = `${totalHeightMM}mm`;
        
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set DPI metadata
        canvas.setAttribute('data-dpi', targetDPI.toString());
        canvas.setAttribute('data-scale', '100%');

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (shouldRotate) {
          ctx.translate(canvasWidth / 2, canvasHeight / 2);
          ctx.rotate(Math.PI / 2);
          ctx.translate(-canvasHeight / 2, -canvasWidth / 2);
          
          [totalWidthMM, totalHeightMM] = [totalHeightMM, totalWidthMM];
        }

        // Calculate offsets using pixelsPerMM
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

          // Draw enclosure border with DPI-scaled line width
          ctx.strokeStyle = config.fonts.sideLabel.color;
          ctx.lineWidth = config.lineWidths.enclosureBorder * dpiScaleFactor;
          
          if (sideKey === 'front') {
            const cornerRadius = config.enclosure.frontCornerRadius * pixelsPerMM;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, cornerRadius);
            ctx.stroke();
          } else {
            ctx.beginPath();
            
            if (sideKey === 'top') {
              ctx.moveTo(x, y);
              ctx.lineTo(x + w, y);
              ctx.lineTo(x + w, y + h);
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + h);
            } else if (sideKey === 'bottom') {
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + h);
              ctx.lineTo(x + w, y + h);
              ctx.lineTo(x + w, y);
            } else if (sideKey === 'left') {
              ctx.moveTo(x, y);
              ctx.lineTo(x + w, y);
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + h);
              ctx.lineTo(x + w, y + h);
            } else if (sideKey === 'right') {
              ctx.moveTo(x, y);
              ctx.lineTo(x + w, y);
              ctx.lineTo(x + w, y + h);
              ctx.lineTo(x, y + h);
            }
            
            ctx.stroke();
          }

          // Draw side label - Use DPI-converted font size
          ctx.save();
          ctx.fillStyle = config.fonts.sideLabel.color;
          ctx.font = `${config.fonts.sideLabel.style} ${sideLabelCanvasSize}px ${config.fonts.sideLabel.family}`;
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
            if (!compData) {
              console.warn(`Unknown component type: ${component.type}`);
              return;
            }
            
            const componentXmm = component.x / CANVAS_MM_TO_PIXELS;
            const componentYmm = component.y / CANVAS_MM_TO_PIXELS;
            
            const centerX = x + (w / 2) + (componentXmm * pixelsPerMM);
            const centerY = y + (h / 2) + (componentYmm * pixelsPerMM);

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
              
              if (isUtilityGuide) {
                ctx.fillStyle = 'transparent';
              } else {
                ctx.fillStyle = 'white';
              }
              ctx.fillRect(drawX, drawY, baseWidth, baseHeight);
              
              ctx.strokeStyle = config.fonts.sideLabel.color;
              ctx.lineWidth = config.lineWidths.componentBorder * dpiScaleFactor;
              
              if (isUtilityGuide) {
                ctx.setLineDash([5, 5]);
              }
              
              ctx.strokeRect(drawX, drawY, baseWidth, baseHeight);
              
              if (isUtilityGuide) {
                ctx.setLineDash([]);
              }
              
              if (!isUtilityGuide) {
                const crosshairSizeH = Math.max(baseWidth / 2, config.components.crosshairSize * dpiScaleFactor);
                const crosshairSizeV = Math.max(baseHeight / 2, config.components.crosshairSize * dpiScaleFactor);
                
                ctx.lineWidth = config.lineWidths.componentCrosshair * dpiScaleFactor;
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

              if (!isUtilityGuide) {
                const labelPos = calculateLabelPosition(
                  centerX,
                  centerY,
                  component.rotation || 0,
                  currentRotation,
                  true,
                  baseWidth,
                  baseHeight,
                  undefined,
                  config.components.labelOffset * dpiScaleFactor
                );

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

                // Use DPI-converted font size
                ctx.font = `${config.fonts.componentLabel.style} ${componentLabelCanvasSize}px ${config.fonts.componentLabel.family}`;
                const textMetrics = ctx.measureText(labelText);
                const textWidth = textMetrics.width;
                // Scale padding by DPI for visual consistency
                const padding = config.components.labelBackgroundPadding * dpiScaleFactor;

                ctx.fillStyle = 'white';
                ctx.fillRect(
                  -textWidth / 2 - padding,
                  -componentLabelCanvasSize / 2 - padding,
                  textWidth + padding * 2,
                  componentLabelCanvasSize + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, 0, 0);
                
                ctx.restore();
              }
              
            } else {
              // CIRCLE COMPONENTS
              const radius = (compData.drillSize / 2) * pixelsPerMM;

              if (isUtilityGuide) {
                ctx.fillStyle = 'transparent';
              } else {
                ctx.fillStyle = 'white';
              }
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.fill();

              ctx.strokeStyle = config.fonts.sideLabel.color;
              ctx.lineWidth = config.lineWidths.componentBorder * dpiScaleFactor;
              
              if (isUtilityGuide) {
                ctx.setLineDash([5, 5]);
              }
              
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.stroke();
              
              if (isUtilityGuide) {
                ctx.setLineDash([]);
              }

              if (!isUtilityGuide) {
                const crosshairSize = Math.max(radius, config.components.crosshairSize * dpiScaleFactor);
                ctx.lineWidth = config.lineWidths.componentCrosshair * dpiScaleFactor;
                ctx.beginPath();
                ctx.moveTo(centerX - crosshairSize, centerY);
                ctx.lineTo(centerX + crosshairSize, centerY);
                ctx.moveTo(centerX, centerY - crosshairSize);
                ctx.lineTo(centerX, centerY + crosshairSize);
                ctx.stroke();
              }

              if (!isUtilityGuide) {
                const labelPos = calculateLabelPosition(
                  centerX,
                  centerY,
                  component.rotation || 0,
                  currentRotation,
                  false,
                  undefined,
                  undefined,
                  radius,
                  config.components.labelOffset * dpiScaleFactor
                );

                const drillText = currentUnit === "metric"
                  ? `${compData.drillSize.toFixed(1)}mm`
                  : compData.imperialLabel;

                ctx.save();
                ctx.translate(labelPos.x, labelPos.y);
                ctx.rotate(labelPos.textAngle);

                // Use DPI-converted font size
                ctx.font = `${config.fonts.componentLabel.style} ${componentLabelCanvasSize}px ${config.fonts.componentLabel.family}`;
                const textMetrics = ctx.measureText(drillText);
                const textWidth = textMetrics.width;
                // Scale padding by DPI for visual consistency
                const padding = config.components.labelBackgroundPadding * dpiScaleFactor;

                ctx.fillStyle = 'white';
                ctx.fillRect(
                  -textWidth / 2 - padding,
                  -componentLabelCanvasSize / 2 - padding,
                  textWidth + padding * 2,
                  componentLabelCanvasSize + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(drillText, 0, 0);
                
                ctx.restore();
              }
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
    disableRotation?: boolean;
  } = {}) => {
    const enclosureType = enclosureTypeRef.current;
    const currentRotation = rotationRef.current;
    
    const shouldRotate = options.disableRotation ? false : getOptimalRotation(enclosureType);
    
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