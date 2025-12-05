import jsPDF from "jspdf";

export function usePrintScaleTest() {
  const createScaleTestPDF = () => {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Title
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("PRINTER SCALE VERIFICATION", pageWidth / 2, 20, { align: "center" });
    
    // Instructions
    pdf.setFontSize(12);
    pdf.setTextColor(255, 0, 0);
    pdf.text("CRITICAL: Before printing, in print dialog set:", pageWidth / 2, 30, { align: "center" });
    pdf.setTextColor(0, 0, 0);
    
    pdf.setFontSize(10);
    pdf.text("1. 'Page Scaling' = 'None' or 'Actual Size'", pageWidth / 2, 38, { align: "center" });
    pdf.text("2. Disable 'Fit to Page' or 'Shrink to Fit'", pageWidth / 2, 44, { align: "center" });
    pdf.text("3. 'Scale' = 100%", pageWidth / 2, 50, { align: "center" });
    
    // Draw 100mm verification line
    const lineY = 70;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.line(55, lineY, 155, lineY); // 100mm line
    
    // End marks
    pdf.line(55, lineY - 2, 55, lineY + 2);
    pdf.line(155, lineY - 2, 155, lineY + 2);
    
    pdf.setFontSize(12);
    pdf.text("100.0 mm", pageWidth / 2, lineY - 5, { align: "center" });
    pdf.text("← Measure this line with a ruler →", pageWidth / 2, lineY + 8, { align: "center" });
    
    // Draw 10mm grid
    const gridY = 90;
    const gridSize = 100; // 100mm grid
    const cellSize = 10; // 10mm cells
    
    // Grid border
    pdf.setDrawColor(0, 0, 255);
    pdf.setLineWidth(0.3);
    pdf.rect(55, gridY, gridSize, gridSize);
    
    // Grid lines
    pdf.setDrawColor(200, 200, 200);
    for (let i = 1; i < 10; i++) {
      const x = 55 + (i * cellSize);
      pdf.line(x, gridY, x, gridY + gridSize);
      const y = gridY + (i * cellSize);
      pdf.line(55, y, 55 + gridSize, y);
    }
    
    // Label cells
    pdf.setFontSize(6);
    pdf.setTextColor(0, 0, 255);
    for (let i = 0; i <= 10; i++) {
      const x = 55 + (i * cellSize);
      pdf.text(`${i * 10}mm`, x, gridY - 1, { align: "center" });
      pdf.text(`${i * 10}mm`, 52, gridY + (i * cellSize), { align: "right" });
    }
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text("10mm × 10mm Grid", pageWidth / 2, gridY + gridSize + 8, { align: "center" });
    
    // Results table
    const tableY = gridY + gridSize + 25;
    pdf.setFontSize(9);
    pdf.text("AFTER PRINTING, MEASURE AND RECORD:", 20, tableY);
    
    pdf.setFontSize(8);
    const measurements = [
      { label: "100mm line measures:", placeholder: "__________ mm" },
      { label: "Grid width (100mm) measures:", placeholder: "__________ mm" },
      { label: "Grid height (100mm) measures:", placeholder: "__________ mm" },
      { label: "Single cell (10mm) measures:", placeholder: "__________ mm" }
    ];
    
    measurements.forEach((m, i) => {
      const y = tableY + 8 + (i * 6);
      pdf.text(m.label, 25, y);
      pdf.text(m.placeholder, 90, y);
    });
    
    // Scale calculation
    const calcY = tableY + 40;
    pdf.setFontSize(9);
    pdf.text("CALCULATE ACTUAL SCALE:", 20, calcY);
    pdf.text("(Measured 100mm line ÷ 100mm) × 100% = __________ %", 25, calcY + 6);
    
    // If scale is not 100%, instructions
    const fixY = calcY + 20;
    pdf.setTextColor(255, 0, 0);
    pdf.setFontSize(9);
    pdf.text("IF SCALE IS NOT 100%:", 20, fixY);
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    const fixes = [
      "1. Check printer driver settings",
      "2. Try different PDF viewer (Adobe Reader vs Preview vs Browser)",
      "3. Try printing from different computer",
      "4. Some printers have hardware scaling - check manual",
      "5. Contact printer manufacturer support"
    ];
    
    fixes.forEach((fix, i) => {
      pdf.text(fix, 25, fixY + 8 + (i * 5));
    });
    
    // Footer
    const footerY = pageHeight - 10;
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "italic");
    pdf.text("EnclosurePro Printer Scale Test", pageWidth / 2, footerY, { align: "center" });
    pdf.text(new Date().toLocaleDateString(), pageWidth - 20, footerY, { align: "right" });
    
    return pdf;
  };

  const downloadScaleTest = () => {
    const pdf = createScaleTestPDF();
    const pdfBlob = pdf.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'printer-scale-verification.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return true;
  };

  return {
    downloadScaleTest,
    createScaleTestPDF
  };
}