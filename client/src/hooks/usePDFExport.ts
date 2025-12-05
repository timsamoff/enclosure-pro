import { useCallback } from "react";
import { EnclosureType } from "@/types/schema";
import jsPDF from "jspdf";
import { useBaseExport } from "./useBaseExport";

interface UsePDFExportProps {
  enclosureTypeRef: React.MutableRefObject<EnclosureType>;
  componentsRef: React.MutableRefObject<any[]>;
  unitRef: React.MutableRefObject<any>;
  rotationRef: React.MutableRefObject<number>;
  projectName: string;
  enclosureType: EnclosureType;
  toast: any;
}

// Standard paper sizes in mm (ISO 216)
const PAPER_SIZES = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
} as const;

type PaperSize = keyof typeof PAPER_SIZES;

export function usePDFExport({
  enclosureTypeRef,
  componentsRef,
  unitRef,
  rotationRef,
  projectName,
  enclosureType,
  toast
}: UsePDFExportProps) {
  const { prepareExportData } = useBaseExport({
    enclosureTypeRef,
    componentsRef,
    unitRef,
    rotationRef
  });

  // Function to find the smallest paper that can fit template at 100% scale
  const getBestPaperSize = useCallback((templateWidth: number, templateHeight: number): {
    size: PaperSize;
    width: number;
    height: number;
    needsRotation: boolean;
    scale: number;
  } => {
    // Determine which paper sizes to check based on template size
    let sizes: PaperSize[];
    
    if (templateWidth > 200 || templateHeight > 200) {
      // Large template (like 1590XX): start with A3
      sizes = ['A3', 'A2', 'A1', 'A0'];
    } else if (templateWidth > 180 || templateHeight > 180) {
      // Medium template: check A4 first, but A3 is likely
      sizes = ['A4', 'A3', 'A2', 'A1', 'A0'];
    } else {
      // Small template: A4 should work
      sizes = ['A4', 'A3', 'A2', 'A1', 'A0'];
    }
    
    for (const size of sizes) {
      const paper = PAPER_SIZES[size];
      
      // Try portrait
      const fitsPortrait = templateWidth <= paper.width && templateHeight <= paper.height;
      
      // Try landscape  
      const fitsLandscape = templateWidth <= paper.height && templateHeight <= paper.width;
      
      if (fitsPortrait) {
        return {
          size,
          width: paper.width,
          height: paper.height,
          needsRotation: false,
          scale: 1,
        };
      }
      
      if (fitsLandscape) {
        return {
          size,
          width: paper.height,
          height: paper.width,
          needsRotation: true,
          scale: 1,
        };
      }
    }
    
    return {
      size: 'A0',
      width: PAPER_SIZES.A0.width,
      height: PAPER_SIZES.A0.height,
      needsRotation: templateWidth > templateHeight,
      scale: 1,
    };
  }, []);

  const generatePDF = useCallback(async (options: {
    forPrint?: boolean;
  } = {}): Promise<jsPDF> => {
    try {
      const exportData = await prepareExportData({ 
        forPDF: !options.forPrint, 
        forPrint: options.forPrint 
      });

      const templateWidth = exportData.pageDimensions.width;
      const templateHeight = exportData.pageDimensions.height;
      
      // Get current unit from ref
      const currentUnit = unitRef.current;
      
      // Find best paper size (MUST be 100% scale when possible)
      const paperInfo = getBestPaperSize(templateWidth, templateHeight);
      
      // KEY CHANGE: For printing, ALWAYS use A4 PDF size to prevent automatic scaling
      // For export, use the actual paper size
      const pdfPageSize = options.forPrint ? 'a4' : paperInfo.size.toLowerCase() as any;
      const pdfPageWidth = options.forPrint ? PAPER_SIZES.A4.width : paperInfo.width;
      const pdfPageHeight = options.forPrint ? PAPER_SIZES.A4.height : paperInfo.height;
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: paperInfo.needsRotation ? "landscape" : "portrait",
        unit: "mm",
        format: pdfPageSize
      });

      // Fixed measurements in mm
      const INCH_TO_MM = 25.4;
      
      // Calculate centered position at 100% scale
      const scaledWidth = templateWidth * paperInfo.scale;
      const scaledHeight = templateHeight * paperInfo.scale;
      
      // Position header 0.5" from top of page
      const TOP_MARGIN = 0.5 * INCH_TO_MM; // 0.5" = 12.7mm
      
      // Header positions (starting from TOP_MARGIN)
      const titleY = TOP_MARGIN + 10; // 10mm down from top margin
      const enclosureInfoY = TOP_MARGIN + 16;
      const dimensionsInfoY = TOP_MARGIN + 22;
      const paperInfoY = TOP_MARGIN + 28;
      
      // Calculate positioning - different for print vs export
      let x, y;
      
      if (options.forPrint) {
  // For printing on A4: Center content on A4 page
  x = (pdfPageWidth - scaledWidth) / 2; // Center horizontally on A4
  y = TOP_MARGIN + 47; // Start enclosure lower to make room for additional instructions
} else {
  // For export: Use normal positioning
  const HEADER_BOTTOM = TOP_MARGIN + 45; // Bottom of header area
  x = (pdfPageWidth - scaledWidth) / 2; // Center horizontally
  y = HEADER_BOTTOM + (0.75 * INCH_TO_MM); // 0.75" below header
}

      // Check if we need to rotate wider templates -90° (270°) for portrait orientation
      const isWiderThanTall = templateWidth > templateHeight;
      const isPortraitPage = !paperInfo.needsRotation;
      const needsMinus90degRotation = isWiderThanTall && isPortraitPage;

      // ORIGINAL HEADER STYLE - keep as is
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const title = projectName ? `${projectName} - Drill Template` : "Enclosure Pro - Drill Template";
      pdf.text(title, pdfPageWidth / 2, titleY, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      // Format dimensions based on unit
      const dimensionsInfo = currentUnit === "metric" 
        ? `Template: ${templateWidth.toFixed(1)}mm × ${templateHeight.toFixed(1)}mm`
        : `Template: ${(templateWidth / INCH_TO_MM).toFixed(2)}" × ${(templateHeight / INCH_TO_MM).toFixed(2)}"`;
      
      // Update enclosure info to include unit
      const enclosureInfo = `${exportData.enclosureType} Enclosure - 100% scale`;
      pdf.text(enclosureInfo, pdfPageWidth / 2, enclosureInfoY, { align: "center" });
      
      pdf.text(dimensionsInfo, pdfPageWidth / 2, dimensionsInfoY, { align: "center" });
      
      // Paper size info - ALWAYS in mm (paper sizes are standard)
      const paperInfoText = options.forPrint 
  ? `Designed for ${paperInfo.size} paper (${paperInfo.width.toFixed(0)}mm × ${paperInfo.height.toFixed(0)}mm)`
  : `${paperInfo.size} paper (${paperInfo.width.toFixed(0)}mm × ${paperInfo.height.toFixed(0)}mm)`;
pdf.text(paperInfoText, pdfPageWidth / 2, paperInfoY, { align: "center" });
      
      // CRITICAL PRINT INSTRUCTIONS
      pdf.setTextColor(255, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      
      if (options.forPrint) {
        if (paperInfo.size !== 'A4') {
          // Template is designed for larger paper but being printed on A4
          pdf.text(`PRINTING ON A4: Set 'Scale: 100%' and DISABLE 'Fit to Page'`, pdfPageWidth / 2, TOP_MARGIN + 34, { align: "center" });
          pdf.text(`Template will print at 100% scale (may overflow A4 paper)`, pdfPageWidth / 2, TOP_MARGIN + 40, { align: "center" });
        } else {
          // Template is designed for A4
          pdf.text(`PRINT SETTINGS: Set 'Scale: 100%' and DISABLE 'Fit to Page'`, pdfPageWidth / 2, TOP_MARGIN + 34, { align: "center" });
        }
      } else {
        // For PDF export, show warning if template overflows
        const fitsHorizontally = templateWidth <= pdfPageWidth;
        const fitsVertically = templateHeight <= pdfPageHeight;
        
        if (!fitsHorizontally || !fitsVertically) {
          pdf.text(`WARNING: Template overflows ${paperInfo.size} paper`, pdfPageWidth / 2, TOP_MARGIN + 34, { align: "center" });
        }
      }
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");

      // Handle image drawing with -90° rotation for wider enclosures in portrait
      if (needsMinus90degRotation) {
        // For -90° rotation: we need to adjust position
        // After -90° rotation, the image dimensions swap
        const rotatedWidth = scaledHeight;
        const rotatedHeight = scaledWidth;
        
        // Recalculate position for the rotated dimensions
        x = (pdfPageWidth - rotatedWidth) / 2;
        y = options.forPrint ? TOP_MARGIN + 47 : TOP_MARGIN + 45 + (0.75 * INCH_TO_MM);
        
        // Rotate wider template by -90° (270°) to put left edge at bottom
        pdf.saveGraphicsState();
        
        // Translate to the center of where the image should be
        const centerX = x + rotatedWidth / 2;
        const centerY = y + rotatedHeight / 2;
        
        pdf.translate(centerX, centerY);
        pdf.rotate(-90, "degrees"); // -90° rotation
        pdf.translate(-centerX, -centerY);
        
        // Draw the image (rotated -90°)
        pdf.addImage(
          exportData.imageData, 
          'PNG', 
          x, y, 
          scaledWidth,
          scaledHeight,
          undefined,
          'FAST'
        );
        
        pdf.restoreGraphicsState();
      } else {
        // Normal drawing for taller templates or landscape pages
        pdf.addImage(
          exportData.imageData, 
          'PNG', 
          x, y, 
          scaledWidth,
          scaledHeight,
          undefined,
          'FAST'
        );
      }

      // Add calibration markings - need to handle -90° rotation for wider enclosures
      const addCalibrationMarkings = () => {
        const offset = 5; // 5mm from template edge
        const markLength = INCH_TO_MM; // 25.4mm (1 inch)
        
        let startX, startY, labelX, labelY;
        
        if (needsMinus90degRotation) {
          // For -90° rotated wider templates: 
          // After -90° rotation, original top-left becomes bottom-right
          // We want calibration mark at bottom-left (after rotation)
          startX = x + offset;
          startY = y + scaledWidth - offset; // Bottom of rotated template
          labelX = startX + (markLength / 2);
          labelY = startY + 3; // Below the line
        } else {
          // For normal taller templates: calibration mark at top-left
          startX = x + offset;
          startY = y + offset;
          labelX = startX + (markLength / 2);
          labelY = startY - 1; // Above the line
        }
        
        // Only draw if mark would be visible on page
        if (startX >= 0 && startX <= pdfPageWidth && startY >= 0 && startY <= pdfPageHeight) {
          // Draw the calibration line
          pdf.setDrawColor(255, 0, 0);
          pdf.setLineWidth(0.5);
          pdf.line(startX, startY, startX + markLength, startY);
          
          // Label
          pdf.setFontSize(6);
          pdf.setTextColor(255, 0, 0);
          
          // Draw calibration label based on current unit
          if (currentUnit === "metric") {
            pdf.text("25.4mm", labelX, labelY, { align: "center" });
          } else {
            pdf.text("1\"", labelX, labelY, { align: "center" });
          }
          
          // Draw a small vertical mark at the end to show it's measured
          pdf.line(startX + markLength, startY - 1, startX + markLength, startY + 1);
          pdf.line(startX, startY - 1, startX, startY + 1);
          
          pdf.setTextColor(0, 0, 0);
          pdf.setDrawColor(0, 0, 0);
        }
      };

      // Draw calibration marks
      addCalibrationMarkings();

      // Add footer with critical information
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      const dateStr = new Date().toLocaleDateString();
      pdf.text(`Generated: ${dateStr}`, 10, pdfPageHeight - 10);
      
      // Add scale and unit info to footer
      const scaleText = paperInfo.scale === 1 ? "100%" : `${(paperInfo.scale * 100).toFixed(1)}%`;
      pdf.text(`Scale: ${scaleText} | Units: ${currentUnit}`, pdfPageWidth / 2, pdfPageHeight - 10, { align: "center" });
      
      // Add print instructions in footer for printing
      if (options.forPrint && paperInfo.size !== 'A4') {
        pdf.setTextColor(255, 0, 0);
        pdf.setFontSize(7);
        pdf.text(`Designed for ${paperInfo.size} - Printing on A4 at 100% scale`, pdfPageWidth / 2, pdfPageHeight - 15, { align: "center" });
        pdf.setTextColor(0, 0, 0);
      }
      
      pdf.text("Enclosure Pro", pdfPageWidth - 10, pdfPageHeight - 10, { align: "right" });

      // Set PDF metadata with STRONG anti-scaling instructions
      pdf.setProperties({
        title: `${title} - DO NOT SCALE - PRINT AT 100%`,
        subject: `Enclosure Drill Template - PRINT AT 100% SCALE ONLY - NO FIT TO PAGE`,
        creator: 'Enclosure Pro',
        producer: 'Enclosure Pro',
        keywords: `DO NOT SCALE, NO FIT TO PAGE, PRINT AT 100%, exact size, ${templateWidth.toFixed(1)}mm x ${templateHeight.toFixed(1)}mm, ${currentUnit}`
      });

      // CRITICAL: Set ALL PDF boxes to exact size to prevent ANY scaling
      try {
        const pdfInternal = (pdf as any).internal;
        if (pdfInternal && pdfInternal.pages && pdfInternal.pages[1]) {
          // Set ALL boxes to exact page size - this prevents scaling
          pdfInternal.pages[1].mediaBox = [0, 0, pdfPageWidth, pdfPageHeight];
          pdfInternal.pages[1].cropBox = [0, 0, pdfPageWidth, pdfPageHeight];
          pdfInternal.pages[1].bleedBox = [0, 0, pdfPageWidth, pdfPageHeight];
          pdfInternal.pages[1].trimBox = [0, 0, pdfPageWidth, pdfPageHeight];
          pdfInternal.pages[1].artBox = [0, 0, pdfPageWidth, pdfPageHeight];
        }
      } catch (e) {
        console.warn('Could not set PDF boxes:', e);
      }

      return pdf;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF');
    }
  }, [prepareExportData, getBestPaperSize, projectName]);

  const handleExportPDF = async () => {
    try {
      const pdf = await generatePDF();
      const currentUnit = unitRef.current;
      // Removed -metric/-imperial from filename
      const filename = projectName 
        ? `${projectName}.pdf` 
        : `${enclosureTypeRef.current}-template.pdf`;
      
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast({
        title: "PDF Exported",
        description: `PDF with 100% scale and calibration marks (${currentUnit})`,
        duration: 4000,
      });
      
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  return {
    handleExportPDF,
    generatePDF
  };
}