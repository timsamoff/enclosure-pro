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
    enclosureBorder: 1,           // Border around enclosure sides
    componentBorder: 0.5,         // Border around components (lineWidth - 1)
    componentCrosshair: 0.5,      // Crosshair lines for components
  },
  
  // Font settings
  fonts: {
    sideLabel: {
      size: 14,                   // Size for side labels (Front, Top, etc.)
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
      const compData = COMPONENT_TYPES[component.type];
      const isUtilityGuide = compData.category === "Footprint Guides";
      return !isUtilityGuide && !component.excludeFromPrint;
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
            ctx.strokeRect(x, y, w, h);
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
              
              ctx.fillStyle = 'white';
              ctx.fillRect(drawX, drawY, baseWidth, baseHeight);
              
              ctx.strokeStyle = config.fonts.sideLabel.color;
              ctx.lineWidth = config.lineWidths.componentBorder;
              ctx.strokeRect(drawX, drawY, baseWidth, baseHeight);
              
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

              ctx.restore();

              // Calculate visual dimensions after component rotation
              const visualWidthPx = component.rotation === 90 ? baseHeight : baseWidth;
              const visualHeightPx = component.rotation === 90 ? baseWidth : baseHeight;

              // Determine label position based on canvas rotation
              let labelX = centerX;
              let labelY = centerY;

              if (shouldRotate) {
                // Canvas is rotated 90°: label goes to the right (visual bottom)
                labelX = centerX + visualWidthPx / 2 + config.components.labelOffset;
                labelY = centerY;
              } else {
                // Canvas not rotated: label goes below
                labelX = centerX;
                labelY = centerY + visualHeightPx / 2 + config.components.labelOffset;
              }

              // Generate label text (swap dimensions for 90° component rotation)
              const labelText = component.rotation === 90 
                ? currentUnit === "metric"
                  ? `${compData.height}mm×${compData.width}mm`
                  : compData.imperialLabel
                : currentUnit === "metric"
                  ? `${compData.width}mm×${compData.height}mm`
                  : compData.imperialLabel;

              ctx.font = `${config.fonts.componentLabel.style} ${config.fonts.componentLabel.size}px ${config.fonts.componentLabel.family}`;
              const textMetrics = ctx.measureText(labelText);
              const textWidth = textMetrics.width;
              const padding = config.components.labelBackgroundPadding;

              // Draw label background
              ctx.fillStyle = 'white';
              
              if (shouldRotate) {
                // Rotate label text when canvas is rotated 90°
                ctx.save();
                ctx.translate(labelX, labelY);
                ctx.rotate(Math.PI / 2);
                ctx.translate(-labelX, -labelY);
                
                ctx.fillRect(
                  labelX - textWidth / 2 - padding,
                  labelY - config.fonts.componentLabel.size / 2 - padding,
                  textWidth + padding * 2,
                  config.fonts.componentLabel.size + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, labelX, labelY);
                
                ctx.restore();
              } else {
                ctx.fillRect(
                  labelX - textWidth / 2 - padding,
                  labelY - config.fonts.componentLabel.size / 2 - padding,
                  textWidth + padding * 2,
                  config.fonts.componentLabel.size + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, labelX, labelY);
              }
              
            } else {
              // CIRCLE COMPONENTS
              const radius = (compData.drillSize / 2) * pixelsPerMM;

              ctx.fillStyle = 'white';
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.fill();

              ctx.strokeStyle = config.fonts.sideLabel.color;
              ctx.lineWidth = config.lineWidths.componentBorder;
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.stroke();

              const crosshairSize = Math.max(radius, config.components.crosshairSize);
              ctx.lineWidth = config.lineWidths.componentCrosshair;
              ctx.beginPath();
              ctx.moveTo(centerX - crosshairSize, centerY);
              ctx.lineTo(centerX + crosshairSize, centerY);
              ctx.moveTo(centerX, centerY - crosshairSize);
              ctx.lineTo(centerX, centerY + crosshairSize);
              ctx.stroke();

              // Determine label position based on canvas rotation
              let labelX = centerX;
              let labelY = centerY;

              if (shouldRotate) {
                // Canvas rotated 90°: label to the right
                labelX = centerX + radius + config.components.labelOffset;
                labelY = centerY;
              } else {
                // Canvas not rotated: label below
                labelX = centerX;
                labelY = centerY + radius + config.components.labelOffset;
              }

              const drillText = currentUnit === "metric"
                ? `${compData.drillSize.toFixed(1)}mm`
                : compData.imperialLabel;

              ctx.font = `${config.fonts.componentLabel.style} ${config.fonts.componentLabel.size}px ${config.fonts.componentLabel.family}`;
              const textMetrics = ctx.measureText(drillText);
              const textWidth = textMetrics.width;
              const padding = config.components.labelBackgroundPadding;

              // Draw label background
              ctx.fillStyle = 'white';
              
              if (shouldRotate) {
                // Rotate label text when canvas is rotated 90°
                ctx.save();
                ctx.translate(labelX, labelY);
                ctx.rotate(Math.PI / 2);
                ctx.translate(-labelX, -labelY);
                
                ctx.fillRect(
                  labelX - textWidth / 2 - padding,
                  labelY - config.fonts.componentLabel.size / 2 - padding,
                  textWidth + padding * 2,
                  config.fonts.componentLabel.size + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(drillText, labelX, labelY);
                
                ctx.restore();
              } else {
                ctx.fillRect(
                  labelX - textWidth / 2 - padding,
                  labelY - config.fonts.componentLabel.size / 2 - padding,
                  textWidth + padding * 2,
                  config.fonts.componentLabel.size + padding * 2
                );
                
                ctx.fillStyle = config.fonts.componentLabel.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(drillText, labelX, labelY);
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