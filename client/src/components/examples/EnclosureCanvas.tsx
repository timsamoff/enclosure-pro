import { useState } from "react";
import EnclosureCanvas from "../EnclosureCanvas";
import { PlacedComponent } from "@/types/schema";

export default function EnclosureCanvasExample() {
  const [components, setComponents] = useState<PlacedComponent[]>([
    { id: "1", type: "potentiometer", x: -50, y: -50, side: "Front" },
    { id: "2", type: "quarter-jack", x: 50, y: -50, side: "Front" },
    { id: "3", type: "footswitch", x: 0, y: 50, side: "Front" },
  ]);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="w-full h-screen">
      <EnclosureCanvas
        width={111}
        height={60}
        components={components}
        currentSide="Front"
        zoom={1}
        rotation={0}
        gridEnabled={true}
        gridSize={5}
        unit="metric"
        onComponentMove={(id, x, y) => {
          setComponents(prev => 
            prev.map(c => c.id === id ? { ...c, x, y } : c)
          );
        }}
        onComponentDelete={(id) => {
          setComponents(prev => prev.filter(c => c.id !== id));
        }}
        onComponentAdd={(type, x, y) => {
          console.log("Add component", type, x, y);
        }}
        selectedComponent={selected}
        onSelectComponent={setSelected}
      />
    </div>
  );
}
