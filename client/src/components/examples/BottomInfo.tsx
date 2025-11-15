import BottomInfo from "../BottomInfo";

export default function BottomInfoExample() {
  return (
    <div className="relative w-full h-64 bg-muted/20">
      <BottomInfo
        gridEnabled={true}
        gridSize={5}
        enclosureType="1590B"
        unit="metric"
        onEnclosureClick={() => console.log("Enclosure clicked")}
        onGridClick={() => console.log("Grid clicked")}
        onComponentsClick={() => console.log("Components clicked")}
      />
    </div>
  );
}
