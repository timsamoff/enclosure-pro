import { useCallback } from "react";
import { EnclosureType, getUnwrappedDimensions } from "@/types/schema";
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

export function usePDFExport({
  enclosureTypeRef,
  componentsRef,
  unitRef,
  rotationRef,
  projectName,
  enclosureType,
  toast
}: UsePDFExportProps) {
  const { renderCanvas } = useBaseExport({
    enclosureTypeRef,
    componentsRef,
    unitRef,
    rotationRef
  });

  const generatePDF = useCallback(async (options: {
    forPrint?: boolean;
  } = {}): Promise<jsPDF> => {
    try {
      const currentEnclosureType = enclosureTypeRef.current;
      const currentRotation = rotationRef.current;
      const currentUnit = unitRef.current;
      
      // Get the ACTUAL unrotated dimensions - this is the TRUE size in mm
      const dimensions = getUnwrappedDimensions(currentEnclosureType);
      const trueWidth = dimensions.left.width + dimensions.front.width + dimensions.right.width;
      const trueHeight = dimensions.top.height + dimensions.front.height + dimensions.bottom.height;
      
      console.log('TRUE template dimensions (mm):', trueWidth, 'x', trueHeight);
      
      // Determine if we need to rotate for portrait
      const needsRotation = trueWidth > trueHeight;
      console.log('Needs rotation to portrait:', needsRotation);
      
      // Check if ORIGINAL (unrotated) template fits on A4
      // This determines page size choice - not affected by rotation
      const originalFitsOnA4 = trueWidth <= 210 && trueHeight <= 297;
      console.log('Original template fits on A4:', originalFitsOnA4);
      
      // Generate canvas WITHOUT any rotation - we'll rotate in PDF if needed
      const imageData = await renderCanvas(
        currentEnclosureType,
        false, // NEVER rotate at canvas level
        currentRotation,
        options
      );
      
      // If we need to rotate, rotate the image data itself
      let finalImageData = imageData;
      let finalWidth = trueWidth;
      let finalHeight = trueHeight;
      
      if (needsRotation) {
        console.log('Rotating image 90° clockwise before adding to PDF');
        
        // Create a canvas to rotate the image
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageData;
        });
        
        // Create canvas with swapped dimensions for 90° rotation
        const rotateCanvas = document.createElement('canvas');
        rotateCanvas.width = img.height;  // Swap width/height
        rotateCanvas.height = img.width;
        
        // Set explicit physical dimensions to preserve DPI
        const PIXELS_PER_INCH = 72;
        const MM_PER_INCH = 25.4;
        rotateCanvas.style.width = `${(img.height / PIXELS_PER_INCH) * MM_PER_INCH}mm`;
        rotateCanvas.style.height = `${(img.width / PIXELS_PER_INCH) * MM_PER_INCH}mm`;
        
        const rotateCtx = rotateCanvas.getContext('2d');
        
        if (!rotateCtx) {
          throw new Error('Could not get rotation canvas context');
        }
        
        // Rotate 90° clockwise: translate, rotate, draw
        rotateCtx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
        rotateCtx.rotate(Math.PI / 2);  // 90° clockwise
        rotateCtx.drawImage(img, -img.width / 2, -img.height / 2);
        
        // Get rotated image data at maximum quality
        finalImageData = rotateCanvas.toDataURL('image/png', 1.0);
        finalWidth = trueHeight;   // After rotation
        finalHeight = trueWidth;   // After rotation
        
        console.log('Image rotated. New dimensions:', finalWidth, 'x', finalHeight);
      }
      
      // Page setup - HYBRID APPROACH
      let pdfPageWidth: number;
      let pdfPageHeight: number;
      let skipHeadersFooters = false;
      const A4_WIDTH = 210;
      const A4_HEIGHT = 297;
      
      if (options.forPrint) {
        // HYBRID: Use A4 if ORIGINAL template fits, otherwise use exact template size
        // Use originalFitsOnA4 instead of checking finalWidth/finalHeight
        
        if (originalFitsOnA4) {
          // Original template fits on A4 - use A4 page size
          pdfPageWidth = A4_WIDTH;
          pdfPageHeight = A4_HEIGHT;
          console.log('Print mode: Original template fits on A4, using A4 page');
        } else {
          // Original template too large for A4 - use exact final size (after rotation)
          pdfPageWidth = finalWidth;
          pdfPageHeight = finalHeight;
          console.log('Print mode: Original template larger than A4, using exact template size');
          console.log('User will need A3/tabloid or print will be cropped');
        }
        
        skipHeadersFooters = true; // Skip extended headers for print mode
      } else {
        // For export: Custom size with margins for headers/footers
        const EXTRA_MARGIN = 50;
        pdfPageWidth = finalWidth + EXTRA_MARGIN;
        pdfPageHeight = finalHeight + EXTRA_MARGIN + 100;
      }
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfPageWidth, pdfPageHeight] as any
      });

      const INCH_TO_MM = 25.4;
      const TOP_MARGIN = 0.5 * INCH_TO_MM;
      
      // Header positions
      const titleY = TOP_MARGIN + 10;
      const enclosureInfoY = TOP_MARGIN + 16;
      const dimensionsInfoY = TOP_MARGIN + 22;
      
      // Centering logic - different for small vs large enclosures
      let imageX: number;
      let imageY: number;
      
      if (options.forPrint && originalFitsOnA4) {
        // Small enclosures: Center on A4
        const centerX = pdfPageWidth / 2;
        const centerY = pdfPageHeight / 2;
        imageX = centerX - (finalWidth / 2);
        imageY = centerY - (finalHeight / 2);
        console.log('Centering small enclosure on A4');
      } else if (options.forPrint && !originalFitsOnA4) {
        // Large enclosures: Position at top-left (0,0)
        imageX = 0;
        imageY = 0;
        console.log('Positioning large enclosure at 0,0');
      } else {
        // Export mode: center with header space
        const centerX = pdfPageWidth / 2;
        const centerY = TOP_MARGIN + 40 + (finalHeight / 2);
        imageX = centerX - (finalWidth / 2);
        imageY = centerY - (finalHeight / 2);
      }
      
      console.log('Center point:', imageX + (finalWidth / 2), imageY + (finalHeight / 2));
      console.log('Final image dimensions:', finalWidth, 'x', finalHeight);
      console.log('Image position:', imageX, imageY);
      
      console.log('=== ADDING IMAGE TO PDF ===');
      console.log('PDF Page size:', pdfPageWidth, 'x', pdfPageHeight, 'mm');
      console.log('Image dimensions being added:', finalWidth, 'x', finalHeight, 'mm');
      console.log('Image position:', imageX, imageY);
      
      // Get the actual pixel dimensions of the image we're adding
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = finalImageData;
      });
      
      console.log('Image pixel dimensions:', img.width, 'x', img.height);
      console.log('Calculated DPI: X=' + (img.width / finalWidth * 25.4) + ', Y=' + (img.height / finalHeight * 25.4));
      console.log('Should be 72 DPI for both');
      
      // CRITICAL FIX: jsPDF might be using the image's pixel dimensions to recalculate
      // We need to ensure jsPDF uses OUR specified mm dimensions, not its own calculation
      // The trick is to use the 'alias' parameter and explicitly set compression to NONE
      const alias = `img_${Date.now()}`;
      
      // Add image - explicitly tell jsPDF not to recalculate dimensions
      pdf.addImage(
        finalImageData,
        'PNG',
        imageX,
        imageY,
        finalWidth,    // Explicit width in mm - jsPDF MUST honor this
        finalHeight,   // Explicit height in mm - jsPDF MUST honor this  
        alias,
        'NONE',        // No compression - preserve exact pixels
        0              // No rotation
      );
      
      console.log('Image added');
      console.log('For 1590XX front face: should be 153mm x 122.5mm');
      console.log('Total template added:', finalWidth, 'x', finalHeight);

      // Add minimal header/footer overlay for ALL modes (including print)
      const pdfTitle = projectName ? `${projectName} - Drill Template` : "Enclosure Pro - Drill Template";
      
      // Simple header at top
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text(pdfTitle, pdfPageWidth / 2, 5, { align: "center" });
      
      // Simple footer at bottom
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      const dateStr = new Date().toLocaleDateString();
      pdf.text(`${currentEnclosureType} | ${currentUnit}`, 5, pdfPageHeight - 3);
      pdf.text(`100% Scale`, pdfPageWidth / 2, pdfPageHeight - 3, { align: "center" });
      pdf.text(dateStr, pdfPageWidth - 5, pdfPageHeight - 3, { align: "right" });

      // Only add full headers/footers/calibration for export mode
      if (!skipHeadersFooters) {
        // Header (drawn on top)
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(pdfTitle, pdfPageWidth / 2, titleY, { align: "center" });
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        
        const dimensionsInfo = currentUnit === "metric" 
          ? `Template: ${trueWidth.toFixed(1)}mm × ${trueHeight.toFixed(1)}mm`
          : `Template: ${(trueWidth / INCH_TO_MM).toFixed(2)}" × ${(trueHeight / INCH_TO_MM).toFixed(2)}"`;
        
        const enclosureInfo = `${currentEnclosureType} Enclosure - 100% scale`;
        pdf.text(enclosureInfo, pdfPageWidth / 2, enclosureInfoY, { align: "center" });
        pdf.text(dimensionsInfo, pdfPageWidth / 2, dimensionsInfoY, { align: "center" });
        
        pdf.setTextColor(255, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text(`PRINT AT 100% SCALE - VERIFY WITH CALIBRATION MARK`, pdfPageWidth / 2, TOP_MARGIN + 34, { align: "center" });
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");

        // Calibration mark
        const addCalibrationMarkings = () => {
          const offset = 5;
          const markLength = INCH_TO_MM;
          
          let startX, startY, labelX, labelY;
          
          // Position based on final dimensions (after rotation if applicable)
          startX = (pdfPageWidth - finalWidth) / 2 + offset;
          startY = TOP_MARGIN + 40 + offset;
          
          labelX = startX + (markLength / 2);
          labelY = startY - 1;
          
          if (startX >= 0 && startX <= pdfPageWidth && startY >= 0 && startY <= pdfPageHeight) {
            pdf.setDrawColor(255, 0, 0);
            pdf.setLineWidth(0.5);
            pdf.line(startX, startY, startX + markLength, startY);
            
            pdf.setFontSize(6);
            pdf.setTextColor(255, 0, 0);
            
            if (currentUnit === "metric") {
              pdf.text("25.4mm", labelX, labelY, { align: "center" });
            } else {
              pdf.text("1\"", labelX, labelY, { align: "center" });
            }
            
            pdf.line(startX + markLength, startY - 1, startX + markLength, startY + 1);
            pdf.line(startX, startY - 1, startX, startY + 1);
            
            pdf.setTextColor(0, 0, 0);
            pdf.setDrawColor(0, 0, 0);
          }
        };

        addCalibrationMarkings();

        // Paper size warning
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(255, 0, 0);
        
        let paperSizeText = "";
        if (Math.abs(pdfPageWidth - 210) < 5 && Math.abs(pdfPageHeight - 297) < 5) {
          paperSizeText = "Designed for A4 size - Printing on A4 at 100% scale";
        } else if (Math.abs(pdfPageWidth - 297) < 5 && Math.abs(pdfPageHeight - 420) < 5) {
          paperSizeText = "Designed for A3 size - Printing on A3 at 100% scale";
        } else if (Math.abs(pdfPageWidth - 279.4) < 10 && Math.abs(pdfPageHeight - 431.8) < 10) {
          paperSizeText = "Designed for Tabloid (11x17\") size - Printing at 100% scale";
        } else {
          paperSizeText = `Designed for custom size (${pdfPageWidth.toFixed(0)}mm × ${pdfPageHeight.toFixed(0)}mm) - Printing at 100% scale`;
        }
        
        pdf.text(paperSizeText, pdfPageWidth / 2, pdfPageHeight - 20, { align: "center" });
        pdf.setTextColor(0, 0, 0);

        // Footer
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        const dateStr = new Date().toLocaleDateString();
        pdf.text(`Generated: ${dateStr}`, 10, pdfPageHeight - 10);
        pdf.text(`Scale: 100% | Units: ${currentUnit}`, pdfPageWidth / 2, pdfPageHeight - 10, { align: "center" });
        pdf.text("Enclosure Pro", pdfPageWidth - 10, pdfPageHeight - 10, { align: "right" });
      }

      // Set PDF metadata
      pdf.setProperties({
        title: `${pdfTitle} - DO NOT SCALE - PRINT AT 100%`,
        subject: `Enclosure Drill Template - PRINT AT 100% SCALE ONLY`,
        creator: 'Enclosure Pro',
        producer: 'Enclosure Pro',
        keywords: `DO NOT SCALE, PRINT AT 100%, exact size, ${trueWidth.toFixed(1)}mm x ${trueHeight.toFixed(1)}mm, ${currentUnit}`
      });

      // Force 100% scale in PDF
      try {
        const pdfInternal = (pdf as any).internal;
        if (pdfInternal && pdfInternal.pages && pdfInternal.pages[1]) {
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
      console.error('PDF generation failed with error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [renderCanvas, projectName]);

  const handleExportPDF = async () => {
    try {
      const pdf = await generatePDF();
      const currentUnit = unitRef.current;
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