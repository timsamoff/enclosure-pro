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
          // Get PDF dimensions for paper size
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          // Determine closest standard paper size
          let paperSize = 'Custom';
          if (Math.abs(pageWidth - 210) < 5 && Math.abs(pageHeight - 297) < 5) {
            paperSize = 'A4';
          } else if (Math.abs(pageWidth - 297) < 5 && Math.abs(pageHeight - 420) < 5) {
            paperSize = 'A3';
          } else if (Math.abs(pageWidth - 148) < 5 && Math.abs(pageHeight - 210) < 5) {
            paperSize = 'A5';
          }
          
          // CRITICAL: Use silent printing with explicit scale settings
          // Some Electron versions support disabling fit-to-page via these options
          await window.electronAPI.printPDF({
            pdfData: Array.from(new Uint8Array(pdfBuffer)),
            printOptions: {
              printBackground: true,
              scale: 1.0, // Explicitly set scale to 100%
              landscape: false,
              pageSize: paperSize,
              margins: {
                marginType: 'custom',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
              },
              disableFitToPage: true, // Some Electron versions support this
              fitToPageEnabled: false, // Alternative flag
              ...printOptions
            },
            silent: true // Silent printing might bypass dialog that enables scaling
          });
          
          props.toast({
            title: "Print Sent (100% Scale)",
            description: `Template printed at exact 100% scale. Verify 25.4mm (1") calibration mark measures correctly with a ruler.`,
            duration: 5000,
          });
          return;
        } catch (error) {
          console.warn('Electron silent print failed, trying with dialog:', error);
          
          // Fallback: Try with dialog but add explicit instructions
          try {
            await window.electronAPI.printPDF({
              pdfData: Array.from(new Uint8Array(pdfBuffer)),
              printOptions: {
                printBackground: true,
                scale: 1.0,
                landscape: false,
                pageSize: 'A4',
              },
              silent: false // Show dialog
            });
            
            props.toast({
              title: "Check Printer Settings!",
              description: "In print dialog, SET 'Scale: 100%' and DISABLE 'Fit to Page'. Check 25.4mm (1\") mark.",
              duration: 6000,
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
                ⚠️ CRITICAL: When printing, in the print dialog:
                <ol style="margin-left: 20px; margin-top: 8px;">
                  <li>Set "Page Scaling" to "None" or "Actual Size"</li>
                  <li>Disable "Fit to Page" or "Shrink to Fit"</li>
                  <li>Set "Scale" to 100%</li>
                  <li>Print, then measure the red 1" (25.4mm) mark with a ruler</li>
                </ol>
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
          title: "Print Preview (100% Scale)",
          description: "Preview opened. Press Ctrl+P/Cmd+P to print.",
          duration: 6000,
        });
      } else {
        // If popup blocked, download and instruct
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${props.projectName || props.enclosureType}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        props.toast({
          title: "PDF Downloaded",
          description: "PDF downloaded. Open and print with 'Scale: 100%' setting.",
          duration: 5000,
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
      
      const previewWindow = window.open(pdfUrl, '_blank', 'width=900,height=700,scrollbars=yes');
      if (previewWindow) {
        props.toast({
          title: "Print Preview (100% Scale)",
          description: "Preview opened. Check 25.4mm (1\") calibration mark.",
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