import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileText, FilePlus, FolderOpen, Printer, Download, X } from "lucide-react";

interface FileDropdownMenuProps {
  fileName: string;
  isDirty: boolean;
  onNew: () => void;
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
          <span className="text-xs text-muted-foreground ml-4">Ctrl+N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSaveAs} data-testid="menu-item-save-as">
          <FilePlus className="w-4 h-4 mr-2" />
          <span className="flex-1">Save As</span>
          <span className="text-xs text-muted-foreground ml-4">Ctrl+S</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpen} data-testid="menu-item-open">
          <FolderOpen className="w-4 h-4 mr-2" />
          <span className="flex-1">Open</span>
          <span className="text-xs text-muted-foreground ml-4">Ctrl+O</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint} data-testid="menu-item-print">
          <Printer className="w-4 h-4 mr-2" />
          <span className="flex-1">Print</span>
          <span className="text-xs text-muted-foreground ml-4">Ctrl+P</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF} data-testid="menu-item-export-pdf">
          <Download className="w-4 h-4 mr-2" />
          <span className="flex-1">Export PDF</span>
          <span className="text-xs text-muted-foreground ml-4">Ctrl+E</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onQuit} data-testid="menu-item-quit">
          <X className="w-4 h-4 mr-2" />
          <span className="flex-1">Quit</span>
          <span className="text-xs text-muted-foreground ml-4">Ctrl+Q</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}