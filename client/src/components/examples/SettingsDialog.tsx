import { useState } from "react";
import SettingsDialog from "../SettingsDialog";
import { MeasurementUnit, EnclosureType } from "@/types/schema";

export default function SettingsDialogExample() {
  const [open, setOpen] = useState(true);
  const [unit, setUnit] = useState<MeasurementUnit>("metric");

  return (
    <div className="w-full h-screen flex items-center justify-center bg-muted/20">
      <SettingsDialog
        open={open}
        onOpenChange={setOpen}
        unit={unit}
        onUnitChange={setUnit}
        onSave={() => console.log("Save")}
        onLoad={() => console.log("Load")}
        onExportPDF={() => console.log("Export PDF")}
        onPrint={() => console.log("Print")}
      />
    </div>
  );
}
