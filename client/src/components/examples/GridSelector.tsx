import { useState } from "react";
import GridSelector from "../GridSelector";

export default function GridSelectorExample() {
  const [open, setOpen] = useState(true);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(5);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-muted/20">
      <GridSelector
        open={open}
        onOpenChange={setOpen}
        gridEnabled={gridEnabled}
        onGridEnabledChange={setGridEnabled}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
      />
    </div>
  );
}
