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
          await window.electronAPI.printPDF({
            pdfData: Array.from(new Uint8Array(pdfBuffer)),
            printOptions: {
              printBackground: true,
              scale: 1.0,
              landscape: false,
              margins: {
                marginType: 'none',
              },
              ...printOptions
            }
          });
          
          props.toast({
            title: "Print Sent",
            description: "High-quality template sent to printer at exact 100% scale (96 DPI)",
          });
          return;
        } catch (error) {
          console.warn('Electron print failed, falling back to browser:', error);
        }
      }

      // Browser print with auto-print (keeps window open like old version)
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            // Don't auto-close - let user close when ready
          }, 500);
        };
        
        props.toast({
          title: "Print Ready",
          description: "High-quality PDF opened for printing (96 DPI)",
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
      
      const previewWindow = window.open(pdfUrl, '_blank');
      if (previewWindow) {
        props.toast({
          title: "Print Preview",
          description: "High-quality preview opened at 100% scale (96 DPI)",
        });
        
        previewWindow.addEventListener('load', () => {
          previewWindow.document.title = `Print Preview - ${props.projectName || props.enclosureTypeRef.current}`;
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