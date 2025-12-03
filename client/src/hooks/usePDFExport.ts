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

      // Create PDF with A4 format
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Calculate maximum image dimensions while maintaining aspect ratio
      const maxImageWidth = pageWidth - 40; // 20mm margins on each side
      const maxImageHeight = pageHeight - 60; // Space for header and footer
      
      let imageWidth = exportData.pageDimensions.width;
      let imageHeight = exportData.pageDimensions.height;
      
      // Scale down if image is too large for the page
      if (imageWidth > maxImageWidth || imageHeight > maxImageHeight) {
        const widthRatio = maxImageWidth / imageWidth;
        const heightRatio = maxImageHeight / imageHeight;
        const scale = Math.min(widthRatio, heightRatio);
        
        imageWidth *= scale;
        imageHeight *= scale;
      }
      
      // Center the image horizontally
      const x = (pageWidth - imageWidth) / 2;
      // Position image lower on the page to leave room for header
      const y = 40;

      // ALWAYS add header section (for both export and print)
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      const title = projectName ? `${projectName}` : "Enclosure Drill Template";
      pdf.text(title, pageWidth / 2, 15, { align: "center" });
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      const enclosureInfo = `${exportData.enclosureType} Enclosure`;
      pdf.text(enclosureInfo, pageWidth / 2, 22, { align: "center" });
      
      pdf.setFontSize(10);
      const dimensionsInfo = `Dimensions: ${exportData.pageDimensions.width.toFixed(1)}mm × ${exportData.pageDimensions.height.toFixed(1)}mm`;
      pdf.text(dimensionsInfo, pageWidth / 2, 28, { align: "center" });
      
      // Add print scale information
      const scaleInfo = `Print Scale: ${((imageWidth / exportData.pageDimensions.width) * 100).toFixed(1)}%`;
      pdf.text(scaleInfo, pageWidth / 2, 34, { align: "center" });
      
      // Add rotation indicator if rotated
      if (exportData.shouldRotate) {
        pdf.setFontSize(8);
        pdf.text("(Optimally rotated for printing)", pageWidth / 2, 37, { align: "center" });
      }

      // Add the image
      pdf.addImage(
        exportData.imageData, 
        'PNG', 
        x, y, 
        imageWidth,  // Scaled width
        imageHeight, // Scaled height
        undefined,
        'FAST'
      );

      // ALWAYS add footer (for both export and print)
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      const dateStr = new Date().toLocaleDateString();
      pdf.text(`Generated: ${dateStr}`, 20, pageHeight - 10);
      pdf.text("EnclosurePro - Drill Template", pageWidth / 2, pageHeight - 10, { align: "center" });
      pdf.text("Page 1/1", pageWidth - 20, pageHeight - 10, { align: "right" });

      // Only set metadata for export (not print)
      if (!options.forPrint) {
        pdf.setProperties({
          title: title,
          subject: 'Enclosure Drill Template',
          creator: 'EnclosurePro',
          producer: 'EnclosurePro',
          keywords: `96 DPI, ${((imageWidth / exportData.pageDimensions.width) * 100).toFixed(1)}% scale, ${exportData.pageDimensions.width.toFixed(1)}mm x ${exportData.pageDimensions.height.toFixed(1)}mm`
        });
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
      const filename = projectName ? `${projectName}.pdf` : `${enclosureTypeRef.current}-drill-template.pdf`;
      
      // Use manual download approach (more reliable than pdf.save())
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
        description: "High-quality PDF exported at exact 100% scale (96 DPI)",
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