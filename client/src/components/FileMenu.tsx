import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { MeasurementUnit } from "@/types/schema";
import { Button } from "@/components/ui/button";
import { Download, Printer, FolderOpen, Save } from "lucide-react";

interface FileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: MeasurementUnit;
  onUnitChange: (unit: MeasurementUnit) => void;
  onSave: () => void;
  onLoad: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
}

export default function FileMenu({
  open,
  onOpenChange,
  unit,
  onUnitChange,
  onSave,
  onLoad,
  onExportPDF,
  onPrint,
}: FileMenuProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-file-menu">
        <DialogHeader>
          <DialogTitle>File</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            {/* The 'Open Project' button is now the first element, placing it before 'Save'. */}
            <Button
              onClick={() => {
                onLoad();
                onOpenChange(false);
              }}
              className="w-full cursor-pointer"
              variant="outline"
              data-testid="button-load-enc"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Open Project (.enc)
            </Button>
            {/* The 'Save Project' button is now the second element. */}
            <Button
              onClick={() => {
                onSave();
                onOpenChange(false);
              }}
              className="w-full cursor-pointer"
              variant="outline"
              data-testid="button-save-enc"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Project (.enc)
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            {/* Changed: Now says "Print/Export to PDF" but uses Ctrl+P shortcut hint */}
            <Button
              onClick={() => {
                onExportPDF();
                onOpenChange(false);
              }}
              className="w-full cursor-pointer"
              data-testid="button-export-pdf"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print/Export to PDF
              <span className="text-xs text-muted-foreground ml-2">
                {/* Show Ctrl+P as the shortcut hint */}
                {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘P' : 'Ctrl+P'}
              </span>
            </Button>
            {/* Commented out the separate Print button */}
            {/*
            <Button
              onClick={() => {
                onPrint();
                onOpenChange(false);
              }}
              className="w-full cursor-pointer"
              variant="outline"
              data-testid="button-print"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            */}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Measurement Unit</Label>
              <Select value={unit} onValueChange={(v) => onUnitChange(v as MeasurementUnit)}>
                <SelectTrigger id="unit" data-testid="select-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric (mm)</SelectItem>
                  <SelectItem value="imperial">Imperial (in)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">About</h4>
            <p>Created by Tim Samoff</p>
            <a
              href="https://twitter.com/circuitousfx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-block"
              data-testid="link-circuitousfx"
            >
              Circuitous FX – @circuitousfx
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}