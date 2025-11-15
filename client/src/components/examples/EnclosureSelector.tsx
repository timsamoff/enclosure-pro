import { useState } from "react";
import EnclosureSelector from "../EnclosureSelector";
import { EnclosureType } from "@/types/schema";

export default function EnclosureSelectorExample() {
  const [open, setOpen] = useState(true);
  const [type, setType] = useState<EnclosureType>("1590B");

  return (
    <div className="w-full h-screen flex items-center justify-center bg-muted/20">
      <EnclosureSelector
        open={open}
        onOpenChange={setOpen}
        currentType={type}
        onSelect={setType}
        unit="metric"
      />
    </div>
  );
}
