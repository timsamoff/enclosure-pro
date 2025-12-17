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
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open instructions FIRST, then download when they click "Got It"
      const instructionWindow = window.open('', 'PrintInstructions', 'width=600,height=700');
      
      if (instructionWindow) {
        instructionWindow.document.write(`
          <html>
            <head>
              <title>Print Instructions</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  padding: 30px;
                  max-width: 550px;
                  margin: 0 auto;
                  background: #f5f5f5;
                }
                .container {
                  background: white;
                  padding: 30px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 {
                  color: #d63031;
                  margin-top: 0;
                  font-size: 24px;
                }
                .warning {
                  background: #ff6b6b;
                  color: white;
                  padding: 15px;
                  border-radius: 5px;
                  margin: 20px 0;
                  font-weight: bold;
                }
                .steps {
                  background: #f8f9fa;
                  padding: 20px;
                  border-radius: 5px;
                  border-left: 4px solid #0984e3;
                  margin: 20px 0;
                }
                .steps ol {
                  margin: 10px 0 0 0;
                  padding-left: 20px;
                }
                .steps li {
                  margin: 10px 0;
                  line-height: 1.6;
                }
                .steps strong {
                  color: #d63031;
                }
                .info {
                  background: #fff3cd;
                  border: 1px solid #ffc107;
                  padding: 15px;
                  border-radius: 5px;
                  margin: 20px 0;
                }
                .size {
                  font-size: 18px;
                  font-weight: bold;
                  color: #0984e3;
                  text-align: center;
                  margin: 15px 0;
                  padding: 10px;
                  background: #e3f2fd;
                  border-radius: 5px;
                }
                button {
                  background: #0984e3;
                  color: white;
                  border: none;
                  padding: 12px 24px;
                  border-radius: 5px;
                  cursor: pointer;
                  font-size: 16px;
                  margin-top: 20px;
                  width: 100%;
                  font-weight: bold;
                }
                button:hover {
                  background: #0770c4;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🖨️ Precision Print Instructions</h1>
                
                <div class="size">
                  Template Size: ${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm
                </div>
                
                <div class="warning">
                  ⚠️ CRITICAL: This template must print at EXACT size for accurate drilling.
                </div>
                
                <div class="steps">
                  <strong>Follow these steps for accurate printing:</strong>
                  <ol>
                    <li>Click "Download & Print" below to save the PDF</li>
                    <li><strong>Open the PDF</strong> in Adobe Reader, Preview, or your system PDF viewer</li>
                    <li><strong>Open Print dialog</strong> (Ctrl+P or Cmd+P)</li>
                    <li><strong>Find "Page Scaling" or "Scale" setting</strong></li>
                    <li><strong>Select "None", "Actual Size", or "100%"</strong></li>
                    <li><strong>DISABLE "Fit to Page" or "Shrink to Fit"</strong></li>
                    <li>Choose paper size A4 or larger</li>
                    <li><strong>Verify with red calibration mark</strong> (exactly 25.4mm / 1 inch)</li>
                  </ol>
                </div>
                
                <div class="info">
                  <strong>💡 Tip:</strong> The red line at top-left is exactly 25.4mm (1 inch). 
                  Measure it after printing to verify no scaling occurred.
                </div>
                
                <div class="info">
                  <strong>🔧 Troubleshooting:</strong> If the calibration mark measures wrong, your printer scaled it. 
                  Look for "Scale" settings and ensure they're set to 100% or "Actual Size".
                </div>
                
                <button id="downloadBtn">Download & Print Template</button>
              </div>
              
              <script>
                document.getElementById('downloadBtn').onclick = function() {
                  // Tell parent window to download
                  window.opener.postMessage({ action: 'downloadPrintPDF' }, '*');
                  window.close();
                };
              </script>
            </body>
          </html>
        `);
        instructionWindow.document.close();
        
        // Listen for message from instruction window
        const messageHandler = (event) => {
          if (event.data && event.data.action === 'downloadPrintPDF') {
            // Now download the PDF
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `${props.projectName || props.enclosureType}-print-template.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            props.toast({
              title: "Print Template Downloaded",
              description: `${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm. Open and print at "Actual Size" (100% scale).`,
              duration: 6000,
            });
            
            // Clean up
            window.removeEventListener('message', messageHandler);
            setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
          }
        };
        
        window.addEventListener('message', messageHandler);
      } else {
        // Popup blocked - just download directly
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${props.projectName || props.enclosureType}-print-template.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        props.toast({
          title: "Print Template Downloaded",
          description: `${pageWidth.toFixed(1)}mm × ${pageHeight.toFixed(1)}mm. Open and print at "Actual Size" or "100% scale".`,
          duration: 8000,
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