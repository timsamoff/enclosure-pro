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
  isEnclosureSelected: boolean;
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
  isEnclosureSelected,
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
          className="gap-2 cursor-pointer"
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
        <DropdownMenuItem 
          onClick={onNew}
          disabled={!isEnclosureSelected}
          data-testid="menu-item-new"
          className={`${isEnclosureSelected ? "cursor-pointer" : "cursor-not-allowed !cursor-not-allowed"}`}
        >
          <FileText className="w-4 h-4 mr-2" />
          <span className="flex-1">New</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.new}</span>
        </DropdownMenuItem>
        {/* Open is always enabled */}
        <DropdownMenuItem 
          onClick={onOpen}
          data-testid="menu-item-open"
          className="cursor-pointer"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          <span className="flex-1">Open</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.open}</span>
        </DropdownMenuItem>
        {/* Save - disabled when no enclosure */}
        <DropdownMenuItem 
          onClick={onSave}
          disabled={!isEnclosureSelected}
          data-testid="menu-item-save"
          className={`${isEnclosureSelected ? "cursor-pointer" : "cursor-not-allowed !cursor-not-allowed"}`}
        >
          <Save className="w-4 h-4 mr-2" />
          <span className="flex-1">Save</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.save}</span>
        </DropdownMenuItem>
        {/* Save As - disabled when no enclosure */}
        <DropdownMenuItem 
          onClick={onSaveAs}
          disabled={!isEnclosureSelected}
          data-testid="menu-item-save-as"
          className={`${isEnclosureSelected ? "cursor-pointer" : "cursor-not-allowed !cursor-not-allowed"}`}
        >
          <FilePlus className="w-4 h-4 mr-2" />
          <span className="flex-1">Save As</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.saveAs}</span>
        </DropdownMenuItem>
        {/* Print/Export - disabled when no enclosure - CHANGED: Now shows Ctrl+P shortcut */}
        <DropdownMenuItem 
          onClick={onExportPDF}
          disabled={!isEnclosureSelected}
          data-testid="menu-item-export-pdf"
          className={`${isEnclosureSelected ? "cursor-pointer" : "cursor-not-allowed !cursor-not-allowed"}`}
        >
          <Printer className="w-4 h-4 mr-2" /> {/* Changed icon from Download to Printer */}
          <span className="flex-1">Print/Export to PDF</span>
          {/* Changed: Show Ctrl+P instead of Ctrl+E for consistency with menu label */}
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.print}</span>
        </DropdownMenuItem>
        {/* Commented out separate Print item
        <DropdownMenuItem 
          onClick={onPrint}
          disabled={!isEnclosureSelected}
          data-testid="menu-item-print"
          className={`${isEnclosureSelected ? "cursor-pointer" : "cursor-not-allowed !cursor-not-allowed"}`}
        >
          <Printer className="w-4 h-4 mr-2" />
          <span className="flex-1">Print</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.print}</span>
        </DropdownMenuItem>
        */}
        <DropdownMenuSeparator />
        {/* Quit is always enabled */}
        <DropdownMenuItem 
          onClick={onQuit}
          data-testid="menu-item-quit"
          className="cursor-pointer"
        >
          <X className="w-4 h-4 mr-2" />
          <span className="flex-1">Quit</span>
          <span className="text-xs text-muted-foreground ml-4">{shortcuts.quit}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}