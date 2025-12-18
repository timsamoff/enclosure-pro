import { useCallback, useRef, type MutableRefObject } from "react";
import { EnclosureType, getUnwrappedDimensions } from "@/types/schema";
import jsPDF from "jspdf";
import { useBaseExport } from "./useBaseExport";

interface UsePDFExportProps {
  enclosureTypeRef: MutableRefObject<EnclosureType>;
  componentsRef: MutableRefObject<any[]>;
  unitRef: MutableRefObject<any>;
  rotationRef: MutableRefObject<number>;
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
      
      // Determine if we need to rotate for portrait
      const needsRotation = trueWidth > trueHeight;
      
      // Check if ORIGINAL (unrotated) template fits on A4
      const originalFitsOnA4 = trueWidth <= 210 && trueHeight <= 297;
      
      // Generate canvas WITHOUT any rotation - we'll rotate in PDF if needed
      // Use 300 DPI for high-quality PDF export
      const imageData = await renderCanvas(
        currentEnclosureType,
        false, // NEVER rotate at canvas level
        currentRotation,
        {
          ...options,
          forPDF: true,
          dpi: 300 // High DPI for crisp PDF output
        }
      );
      
      // If we need to rotate, rotate the image data itself
      let finalImageData = imageData;
      let finalWidth = trueWidth;
      let finalHeight = trueHeight;
      
      if (needsRotation) {
        // Create a canvas to rotate the image
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageData;
        });
        
        // Create canvas with swapped dimensions for 90° rotation
        const rotateCanvas = document.createElement('canvas');
        rotateCanvas.width = img.height;
        rotateCanvas.height = img.width;
        
        // Set explicit physical dimensions to preserve scale
        // For rotated image, use the original dimensions
        rotateCanvas.style.width = `${trueHeight}mm`;
        rotateCanvas.style.height = `${trueWidth}mm`;
        
        const rotateCtx = rotateCanvas.getContext('2d');
        
        if (!rotateCtx) {
          throw new Error('Could not get rotation canvas context');
        }
        
        // Rotate 90° clockwise
        rotateCtx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
        rotateCtx.rotate(Math.PI / 2);
        rotateCtx.drawImage(img, -img.width / 2, -img.height / 2);
        
        finalImageData = rotateCanvas.toDataURL('image/png', 1.0);
        finalWidth = trueHeight;
        finalHeight = trueWidth;
      }
      
      // Page setup - Use A4 if template fits, otherwise use custom size with margins
      let pdfPageWidth: number;
      let pdfPageHeight: number;
      const A4_WIDTH = 210;
      const A4_HEIGHT = 297;
      
      if (originalFitsOnA4) {
        // Small enclosures: Use A4 page size
        pdfPageWidth = A4_WIDTH;
        pdfPageHeight = A4_HEIGHT;
      } else {
        // Large enclosures: Custom size with margins for headers/footers
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
      
      // Centering logic - center with header space
      const centerX = pdfPageWidth / 2;
      const centerY = TOP_MARGIN + 40 + (finalHeight / 2);
      const imageX = centerX - (finalWidth / 2);
      const imageY = centerY - (finalHeight / 2);
      
      // Get the actual pixel dimensions of the image we're adding
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = finalImageData;
      });
      
      const alias = `img_${Date.now()}`;
      
      // Add image
      pdf.addImage(
        finalImageData,
        'PNG',
        imageX,
        imageY,
        finalWidth,
        finalHeight,
        alias,
        'NONE',
        0
      );

      // Add headers/footers/calibration
      const pdfTitle = projectName ? `${projectName} - Drill Template` : "Enclosure Pro - Drill Template";
      
      // Header
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
        paperSizeText = "Designed for Tabloid (11\"x17\") size - Printing at 100% scale";
      } else {
        paperSizeText = `Designed for custom size (${pdfPageWidth.toFixed(0)}mm × ${pdfPageHeight.toFixed(0)}mm) - Printing at 100% scale`;
      }
      
      pdf.text(paperSizeText, pdfPageWidth / 2, pdfPageHeight - 25, { align: "center" });
      pdf.setTextColor(0, 0, 0);

      // Footer
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      const dateStr = new Date().toLocaleDateString();
      pdf.text(`Generated: ${dateStr}`, 10, pdfPageHeight - 15);
      pdf.text(`Scale: 100% | Units: ${currentUnit}`, pdfPageWidth / 2, pdfPageHeight - 15, { align: "center" });
      pdf.text("Enclosure Pro", pdfPageWidth - 10, pdfPageHeight - 15, { align: "right" });

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

  const isExportingRef = useRef(false);

  const handleExportPDF = async () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;

    let instructionWindow: Window | null = null;
    let messageHandler: ((event: MessageEvent) => void) | null = null;
    
    try {
      const pdf = await generatePDF();
      const currentUnit = unitRef.current;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Determine paper size for messaging
      let paperDisplay = '';
      let paperSizeForStep = '';
      let toastPaperDescription = '';

      if (Math.abs(pageWidth - 210) < 5 && Math.abs(pageHeight - 297) < 5) {
        paperDisplay = 'A4 (210mmx297mm) / Letter (8.5"x11")';
        paperSizeForStep = 'A4/Letter';
        toastPaperDescription = 'A4/Letter';
      } else if (Math.abs(pageWidth - 297) < 5 && Math.abs(pageHeight - 420) < 5) {
        paperDisplay = 'A3 (297mmx420mm)';
        paperSizeForStep = 'A3';
        toastPaperDescription = 'A3';
      } else if (Math.abs(pageWidth - 279.4) < 10 && Math.abs(pageHeight - 431.8) < 10) {
        paperDisplay = 'Tabloid (11"×17")';
        paperSizeForStep = 'Tabloid (11"×17")';
        toastPaperDescription = 'Tabloid';
      } else {
        paperDisplay = 'Custom<br />Consider printing on A3 (297mmx420mm)<br />or tabloid (11"x17") sized paper.';
        paperSizeForStep = 'custom';
        toastPaperDescription = 'Custom';
      }
      
      // Show print instructions FIRST
      instructionWindow = window.open('', 'PrintInstructions', 'width=650,height=750');
      
      if (instructionWindow) {
        instructionWindow.document.write(`
  <html>
    <head>
      <title>Export Template - Printing Instructions</title>
      <style>
        :root {
            --primary-color: #ff8c42;
            --secondary-color: #333333;
            --text-color: #212121;
            --bg-color: #e8dcc8;
        }

        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: var(--text-color);
          background-color: var(--bg-color);
          margin: 0;
          padding: 40px 20px 20px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .container {
          width: 100%;
          max-width: 550px;
          padding: 40px 30px;
          background: white;
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
          border-radius: 12px;
          margin-bottom: 25px;
        }

        h1 {
          color: var(--secondary-color);
          font-size: 2em;
          text-align: center;
          border-bottom: 5px solid var(--primary-color);
          padding-bottom: 15px;
          margin-top: 0;
        }

        .subtitle {
          text-align: center;
          color: #616161;
          font-style: italic;
          margin-bottom: 25px;
          font-size: 0.9em;
        }

        .paper-info {
          background-color: #f0f0f0; 
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 25px;
        }

        .paper-info .size {
          font-size: 1.4em;
          font-weight: bold;
          color: var(--secondary-color);
        }

        .warning {
          border-left: 5px solid #ff9966; 
          background: #fff5f0;
          padding: 15px;
          margin-bottom: 25px;
          color: var(--text-color);
        }

        .warning strong {
          color: var(--primary-color);
          display: block;
          text-transform: uppercase;
          font-size: 0.85em;
          letter-spacing: 1px;
        }

        .steps-list h3 {
          font-size: 1.5em;
          color: var(--secondary-color);
          border-bottom: 2px solid #b8a991;
          padding-bottom: 5px;
        }

        .steps-list ol {
          padding-left: 20px;
          margin-bottom: 0;
        }

        .steps-list li {
          margin: 12px 0;
        }

        .verification-wrapper {
          width: 100%;
          max-width: 550px;
          margin-bottom: 25px; 
        }

        .calibration {
          background-color: #f0f0f0;
          color: var(--text-color); 
          padding: 18px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 0.95em;
        }

        .calibration strong {
          color: var(--primary-color);
        }

        .button-wrapper {
          width: 100%;
          max-width: 550px;
          padding-bottom: 20px;
        }

        button {
          display: block;
          width: 100%;
          padding: 16px 20px;
          border: 2px solid var(--primary-color);
          border-radius: 30px;
          background-color: var(--primary-color);
          color: #fff;
          font-weight: bold;
          font-size: 1.1em;
          cursor: pointer;
          transition: all 0.3s;
        }

        button:hover {
          background-color: #a34400;
          border-color: #a34400;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Export Template</h1>
        <div class="subtitle">Enclosure Pro Printing Guide</div>
        
        <div class="paper-info">
          <div style="font-size: 0.85em; opacity: 0.8;">Required Paper Size:</div>
          <div class="size">${paperDisplay}</div>
        </div>
        
        <div class="warning">
          <strong>⚠️ Scale Warning</strong>
          Print at 100% scale. "Fit to Page" settings will cause alignment errors.
        </div>
        
        <div class="steps-list">
          <h3>Printer Settings:</h3>
          <ol>
            <li>Open the PDF in <strong>Adobe Reader</strong> or <strong>Mac Preview</strong>.</li>
            <li>Press Print and locate <strong>"Scale"</strong> or <strong>"Page Sizing"</strong>.</li>
            <li>Set to <strong>"Actual Size"</strong> or <strong>100%</strong>.</li>
            <li>Ensure <strong>${paperSizeForStep}</strong> paper is in the tray.</li>
          </ol>
        </div>
      </div>

      <div class="verification-wrapper">
        <div class="calibration">
          <strong>📏 Verification:</strong> After printing, measure the <strong>red calibration line</strong>. 
          It must be exactly <strong>25.4mm (1 inch)</strong>.
        </div>
      </div>

      <div class="button-wrapper">
        <button id="continueBtn">Continue to Save PDF</button>
      </div>
      
      <script>
        document.getElementById('continueBtn').onclick = function() {
          window.opener.postMessage({ action: 'continueExport' }, '*');
          window.close();
        };
      </script>
    </body>
  </html>
`);
        instructionWindow.document.close();
        
        // Wait for user to click continue
        let resolvePromise: (value?: any) => void;
        let checkWindowClosed: ReturnType<typeof setInterval>;
        
        const waitForContinue = new Promise((resolve, reject) => {
          resolvePromise = resolve;
          
          checkWindowClosed = setInterval(() => {
            if (instructionWindow && instructionWindow.closed) {
              clearInterval(checkWindowClosed);
              if (messageHandler) {
                window.removeEventListener('message', messageHandler);
                messageHandler = null;
              }
              resolve(false);
            }
          }, 500);
          
          messageHandler = (event) => {
            if (event.data && event.data.action === 'continueExport') {
              clearInterval(checkWindowClosed);
              if (messageHandler) {
                window.removeEventListener('message', messageHandler);
                messageHandler = null;
              }
              resolve(true);
            }
          };
          
          window.addEventListener('message', messageHandler);
          
          setTimeout(() => {
            clearInterval(checkWindowClosed);
            if (messageHandler) {
              window.removeEventListener('message', messageHandler);
              messageHandler = null;
            }
            resolve(false);
          }, 300000);
        });
        
        const shouldExport = await waitForContinue;
        
        if (!shouldExport) {
          return;
        }
        
        // Now proceed with the export
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
          description: `${toastPaperDescription} template with calibration marks (${currentUnit})`,
          duration: 4000,
        });
      } else {
        // Popup blocked - just export directly
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
          description: `${toastPaperDescription} template with calibration marks (${currentUnit})`,
          duration: 4000,
        });
      }
      
    } catch (error) {
      console.error('PDF export failed:', error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      if (messageHandler) {
        window.removeEventListener('message', messageHandler);
      }
      isExportingRef.current = false;
    }
  };

  return {
    handleExportPDF,
    generatePDF
  };
}