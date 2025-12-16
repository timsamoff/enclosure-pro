import { useCallback } from "react";
import { EnclosureType } from "@/types/schema";
import { usePDFExport } from "./usePDFExport";

interface UsePrintProps {
  enclosureTypeRef: React.MutableRefObject<EnclosureType>;
  componentsRef: React.MutableRefObject<any[]>;
  unitRef: React.MutableRefObject<any>;
  rotationRef: React.MutableRefObject<number>;
  projectName: string;
  enclosureType: EnclosureType;
  toast: any;
}

export function usePrint(props: UsePrintProps) {
  const { generatePDF } = usePDFExport(props);

  const handlePrint = useCallback(async (printOptions = {}) => {
    try {
      const pdf = await generatePDF({ forPrint: true });
      
      if (window.electronAPI?.isElectron) {
        const pdfBlob = pdf.output('blob');
        const pdfBuffer = await pdfBlob.arrayBuffer();
        
        try {
          // Get PDF dimensions - these are now EXACT template dimensions
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          console.log('Print PDF page size:', pageWidth, 'x', pageHeight, 'mm');
          
          // CRITICAL: Always use Custom paper size with exact dimensions
          // This is the ONLY way to prevent printer scaling
          const printOpts: any = {
            printBackground: true,
            // REMOVED: scale property - let it default
            // Setting scale: 1.0 might still trigger fit-to-page
            landscape: false,
            margins: {
              marginType: 'none',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0
            },
            pageSize: 'Custom',
            // Convert mm to points (1 point = 1/72 inch)
            pageWidth: pageWidth * 72 / 25.4,
            pageHeight: pageHeight * 72 / 25.4,
            // CRITICAL: Disable all auto-fitting
            scaleFactor: 100,
            shouldPrintBackgrounds: true,
            printScaling: 'none', // Chromium-specific: disable scaling
          };
          
          console.log('Print options:', printOpts);
          
          // CRITICAL: Use silent printing to bypass dialog that might apply scaling
          await window.electronAPI.printPDF({
            pdfData: Array.from(new Uint8Array(pdfBuffer)),
            printOptions: printOpts,
            silent: true
          });
          
          props.toast({
            title: "Print Sent",
            description: `Printing at exact 100% scale (${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm). Verify with ruler or calibration mark if available.`,
            duration: 5000,
          });
          return;
        } catch (error) {
          console.warn('Electron silent print failed, trying with dialog:', error);
          
          // Fallback: Try with dialog
          try {
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            await window.electronAPI.printPDF({
              pdfData: Array.from(new Uint8Array(pdfBuffer)),
              printOptions: {
                printBackground: true,
                landscape: false,
                pageSize: 'Custom',
                pageWidth: pageWidth * 72 / 25.4,
                pageHeight: pageHeight * 72 / 25.4,
                margins: {
                  marginType: 'none',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0
                },
              },
              silent: false
            });
            
            props.toast({
              title: "⚠️ VERIFY PRINT SETTINGS!",
              description: "In print dialog: Set 'Scale' to 100% or 'Actual Size'. DISABLE 'Fit to Page'. Template size: " + pageWidth.toFixed(1) + "mm × " + pageHeight.toFixed(1) + "mm",
              duration: 8000,
              variant: "default"
            });
            return;
          } catch (dialogError) {
            console.warn('Dialog print also failed:', dialogError);
            // Continue to browser fallback
          }
        }
      }

      // Browser print fallback - show preview without auto-printing
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank', 'width=900,height=700,scrollbars=yes');
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      if (printWindow) {
        // Simple preview with just the warning and PDF
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Preview - SET SCALE TO 100%</title>
              <style>
                * {
                  box-sizing: border-box;
                  margin: 0;
                  padding: 0;
                }
                
                body { 
                  font-family: Arial, sans-serif; 
                  padding: 20px;
                  background: #fff3cd;
                  min-height: 100vh;
                  overflow-y: auto;
                  display: flex;
                  flex-direction: column;
                }
                
                .warning {
                  background: #ffeaa7;
                  border: 2px solid #fdcb6e;
                  padding: 15px;
                  margin-bottom: 20px;
                  border-radius: 5px;
                  font-weight: bold;
                  flex-shrink: 0;
                }
                
                @media print {
                  .no-print { display: none !important; }
                  body { background: white; padding: 0; }
                  .warning { display: none !important; }
                }
                
                .pdf-container {
                  flex: 1;
                  overflow: auto;
                  border: 1px solid #ccc;
                  background: white;
                  min-height: 400px;
                }
                
                iframe {
                  width: 100%;
                  height: 100%;
                  border: none;
                }
              </style>
            </head>
            <body>
              <div class="no-print warning">
                ⚠️ CRITICAL: Template size is ${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm
                <br><br>
                When printing, in the print dialog:
                <ol style="margin-left: 20px; margin-top: 8px;">
                  <li><strong>Set "Page Scaling" to "None" or "Actual Size"</strong></li>
                  <li><strong>DISABLE "Fit to Page" or "Shrink to Fit"</strong></li>
                  <li><strong>Set "Scale" to 100%</strong></li>
                  <li>Use custom paper size or a paper larger than template</li>
                </ol>
                <p style="margin-top: 10px; color: #d63031;">
                  ⚠️ If your printer doesn't support custom sizes, the template may be cropped or scaled. 
                  Consider exporting to PDF and printing from Adobe Reader with "Actual Size" selected.
                </p>
              </div>
              <div class="pdf-container">
                <iframe 
                  src="${pdfUrl}" 
                  onload="this.contentWindow.focus()"
                ></iframe>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        
        props.toast({
          title: "Print Preview (Exact Size)",
          description: `Template: ${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm. MUST print at 100% scale.`,
          duration: 6000,
        });
      } else {
        // If popup blocked, download and instruct
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${props.projectName || props.enclosureType}-print.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        props.toast({
          title: "PDF Downloaded",
          description: `Template: ${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm. Open and print with 'Actual Size' or '100% Scale' - NO SCALING.`,
          duration: 6000,
        });
      }

    } catch (error) {
      console.error('Print failed:', error);
      props.toast({
        title: "Print Failed",
        description: "Failed to generate print document",
        variant: "destructive",
      });
    }
  }, [generatePDF, props]);

  const handleQuickPrint = async () => {
    return handlePrint({ silent: true });
  };

  const handlePrintPreview = useCallback(async () => {
    try {
      const pdf = await generatePDF({ forPrint: true });
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const previewWindow = window.open(pdfUrl, '_blank', 'width=900,height=700,scrollbars=yes');
      if (previewWindow) {
        props.toast({
          title: "Print Preview (Exact Size)",
          description: `Template: ${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm. Print at 100% scale only.`,
        });
      }
    } catch (error) {
      console.error('Print preview failed:', error);
      props.toast({
        title: "Preview Failed",
        description: "Failed to generate preview",
        variant: "destructive",
      });
    }
  }, [generatePDF, props]);

  return {
    handlePrint,
    handleQuickPrint,
    handlePrintPreview
  };
}