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

  const generatePDF = useCallback(async (options: {
    forPrint?: boolean;
  } = {}): Promise<jsPDF> => {
    try {
      const exportData = await prepareExportData({ 
        forPDF: !options.forPrint, 
        forPrint: options.forPrint 
      });

      const imageWidth = exportData.pageDimensions.width;
      const imageHeight = exportData.pageDimensions.height;
      
      // CRITICAL: Set PDF page size to EXACT template dimensions plus small margins
      const MARGIN = 10; // Small 10mm margin on all sides
      const HEADER_HEIGHT = 40; // Space for header info
      const FOOTER_HEIGHT = 20; // Space for footer
      
      // Calculate page dimensions that exactly fit the template
      const pageWidth = imageWidth + (MARGIN * 2);
      const pageHeight = imageHeight + HEADER_HEIGHT + FOOTER_HEIGHT;
      
      // Create PDF with CUSTOM size that exactly fits the template
      const pdf = new jsPDF({
        orientation: pageWidth > pageHeight ? "landscape" : "portrait",
        unit: "mm",
        format: [pageWidth, pageHeight] as any
      });

      // Position image with margins
      const x = MARGIN;
      const y = HEADER_HEIGHT;

      // Add critical header information
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      const title = projectName ? `${projectName}` : "Enclosure Drill Template";
      pdf.text(title, pageWidth / 2, 10, { align: "center" });
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const enclosureInfo = `${exportData.enclosureType} Enclosure - 100% SCALE`;
      pdf.text(enclosureInfo, pageWidth / 2, 16, { align: "center" });
      
      const dimensionsInfo = `Template: ${imageWidth.toFixed(1)}mm × ${imageHeight.toFixed(1)}mm | Page: ${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm`;
      pdf.text(dimensionsInfo, pageWidth / 2, 22, { align: "center" });
      
      // Add scale warning in RED
      pdf.setTextColor(255, 0, 0);
      pdf.setFontSize(9);
      pdf.text("IMPORTANT: Set printer to 'Actual Size' or 'Scale: 100%'", pageWidth / 2, 28, { align: "center" });
      pdf.setTextColor(0, 0, 0); // Reset to black
      
      // Add rotation indicator if rotated
      if (exportData.shouldRotate) {
        pdf.setFontSize(8);
        pdf.text("(Rotated for optimal fit)", pageWidth / 2, 32, { align: "center" });
      }

      // Add the image at 100% scale
      pdf.addImage(
        exportData.imageData, 
        'PNG', 
        x, y, 
        imageWidth,  // Always 100% width
        imageHeight, // Always 100% height
        undefined,
        'FAST'
      );

      // Add calibration markings - 25.4mm (1") marks only at top-left
      const addCalibrationMarkings = () => {
        const offset = 5; // 5mm from edge
        const markLength = 25.4; // 25.4mm (1 inch) marks
        
        // Top-left corner ONLY - draw AFTER the image so it's on top
        pdf.setDrawColor(255, 0, 0); // Red for visibility
        pdf.setLineWidth(0.5);
        
        // Horizontal mark (25.4mm)
        const startX = x + offset;
        const startY = y + offset;
        
        // Draw the 25.4mm line
        pdf.line(startX, startY, startX + markLength, startY);
        
        // Label - position ABOVE the line
        pdf.setFontSize(6);
        pdf.setTextColor(255, 0, 0);
        
        // Draw "25.4mm" label centered above the line
        const labelX = startX + (markLength / 2);
        const labelY = startY - 1; // 1mm above the line
        pdf.text("1\" (25.4mm)", labelX, labelY, { align: "center" });
        
        // Draw a small vertical mark at the end to show it's measured
        pdf.line(startX + markLength, startY - 1, startX + markLength, startY + 1);
        pdf.line(startX, startY - 1, startX, startY + 1);
        
        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0); // Reset to black
      };

      // Draw calibration marks LAST (so they're on top of everything)
      addCalibrationMarkings();

      // Add footer with critical information
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      const dateStr = new Date().toLocaleDateString();
      pdf.text(`Generated: ${dateStr}`, MARGIN, pageHeight - 5);
      pdf.text("Enclosure Pro Drill Template", pageWidth - MARGIN, pageHeight - 5, { align: "right" });

      // Set PDF metadata to prevent scaling
      if (!options.forPrint) {
        pdf.setProperties({
          title: `${title} - 100% Scale`,
          subject: 'Enclosure Drill Template (100% Scale)',
          creator: 'Enclosure Pro',
          producer: 'Enclosure Pro',
          keywords: `100% scale, no scaling, exact size, ${imageWidth.toFixed(1)}mm x ${imageHeight.toFixed(1)}mm, DO NOT FIT TO PAGE`
        });
      }

      // Add custom PDF box to prevent scaling
      try {
        const pdfInternal = (pdf as any).internal;
        if (pdfInternal && pdfInternal.pages && pdfInternal.pages[1]) {
          pdfInternal.pages[1].mediaBox = [0, 0, pageWidth, pageHeight];
          pdfInternal.pages[1].cropBox = [0, 0, pageWidth, pageHeight];
        }
      } catch (e) {
        // Ignore if not supported
      }

      return pdf;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF');
    }
  }, [prepareExportData, projectName]);

  const handleExportPDF = async () => {
    try {
      const pdf = await generatePDF();
      // Remove the "-100percent" suffix, just use project name or enclosure type
      const filename = projectName ? `${projectName}.pdf` : `${enclosureTypeRef.current}-template.pdf`;
      
      // Use manual download approach
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast({
        title: "PDF Exported",
        description: "PDF with 100% scale and calibration marks",
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