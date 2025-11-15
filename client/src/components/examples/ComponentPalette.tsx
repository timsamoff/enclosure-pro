import ComponentPalette from "../ComponentPalette";

export default function ComponentPaletteExample() {
  return (
    <div className="relative w-full h-screen bg-muted/20">
      <ComponentPalette
        onComponentSelect={(type) => console.log("Selected:", type)}
        onClose={() => console.log("Close palette")}
        unit="metric"
      />
    </div>
  );
}
