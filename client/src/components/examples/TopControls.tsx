import { useState } from "react";
import TopControls from "../TopControls";
import { EnclosureSide } from "@/types/schema";

export default function TopControlsExample() {
  const [zoom, setZoom] = useState(1);
  const [side, setSide] = useState<EnclosureSide>("Front");

  return (
    <div className="relative w-full h-64 bg-muted/20">
      <TopControls
        currentSide={side}
        zoom={zoom}
        onZoomIn={() => setZoom(z => Math.min(z + 0.1, 3))}
        onZoomOut={() => setZoom(z => Math.max(z - 0.1, 0.5))}
        onRotate={() => console.log("Rotate clicked")}
        onPrevSide={() => console.log("Previous side")}
        onNextSide={() => console.log("Next side")}
        onFileMenuClick={() => console.log("File menu clicked")}
      />
    </div>
  );
}
