import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileText, Save, FilePlus, FolderOpen, Printer, Download, X } from "lucide-react";
import { shortcuts } from "@/lib/hotkeys";

interface FileDropdownMenuProps {
  fileName: string;
  isDirty: boolean;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onPrint: () => void;
  onExportPDF: () => void;
  onQuit: () => void;
}

export default function FileDropdownMenu({
  fileName,
  isDirty,
  onNew,
  onSave,
  onSaveAs,
  onOpen,
  onPrint,
  onExportPDF,
  onQuit,
}: FileDropdownMenuProps) {
  const displayName = fileName || "Untitled";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2"
          data-testid="button-file-dropdown"
        >
          <span className="font-medium">
            {displayName}
            {isDirty && <span style={{ color: '#ff8c42' }}>*</span>}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="menu-file-dropdown">
        <DropdownMenuItem onClick={onNew} data-testid="menu-item-new">
          <FileText className="w-4 h-4 mr-2" />
          <span className="flex-1">New</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.new}</span>
        </DropdownMenuItem>
        {/* MOVED: Open is now after New */}
        <DropdownMenuItem onClick={onOpen} data-testid="menu-item-open">
          <FolderOpen className="w-4 h-4 mr-2" />
          <span className="flex-1">Open</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.open}</span>
        </DropdownMenuItem>
        {/* MOVED: Save is now after Open */}
        <DropdownMenuItem onClick={onSave} data-testid="menu-item-save">
          <Save className="w-4 h-4 mr-2" />
          <span className="flex-1">Save</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.save}</span>
        </DropdownMenuItem>
        {/* MOVED: Save As is now after Save */}
        <DropdownMenuItem onClick={onSaveAs} data-testid="menu-item-save-as">
          <FilePlus className="w-4 h-4 mr-2" />
          <span className="flex-1">Save As</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.saveAs}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint} data-testid="menu-item-print">
          <Printer className="w-4 h-4 mr-2" />
          <span className="flex-1">Print</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.print}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} data-testid="menu-item-export-pdf">
          <Download className="w-4 h-4 mr-2" />
          <span className="flex-1">Export PDF</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.exportPDF}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onQuit} data-testid="menu-item-quit">
          <X className="w-4 h-4 mr-2" />
          <span className="flex-1">Quit</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.quit}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}