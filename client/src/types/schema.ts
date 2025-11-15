import { z } from "zod";

export type EnclosureSide = "Front" | "Right" | "Left" | "Top" | "Bottom";
export type MeasurementUnit = "metric" | "imperial";

export const CORNER_RADIUS = 5;

export const ENCLOSURE_TYPES = {
  "1590A": { width: 39, height: 92, depth: 31 },
  "1590B": { width: 60, height: 111, depth: 31 },
  "1590LB": { width: 50.5, height: 50.5, depth: 31 },
  "125B": { width: 66.5, height: 120.5, depth: 39.5 },
  "1590BB": { width: 118, height: 94, depth: 35 },
  "1590BB2": { width: 119, height: 94, depth: 54 },
  "1590DD": { width: 187.5, height: 119.5, depth: 56 },
} as const;

export type EnclosureType = keyof typeof ENCLOSURE_TYPES;

export const COMPONENT_TYPES = {
  "pot-16mm": { name: "16mm Potentiometer", drillSize: 7.0, imperialLabel: '9/32"', category: "Potentiometers" },
  "pot-24mm": { name: "24mm Potentiometer", drillSize: 8.0, imperialLabel: '5/16"', category: "Potentiometers" },
  "quarter-jack": { name: '1/4" Jack', drillSize: 10.0, imperialLabel: '3/8"', category: "Jacks" },
  "eighth-jack": { name: '1/8" Jack', drillSize: 6.0, imperialLabel: '1/4"', category: "Jacks" },
  "dc-jack": { name: "DC Jack", drillSize: 12.0, imperialLabel: '1/2"', category: "Jacks" },
  footswitch: { name: "Footswitch", drillSize: 12.0, imperialLabel: '1/2"', category: "Switches" },
  toggle: { name: "Toggle Switch", drillSize: 7.0, imperialLabel: '1/4"', category: "Switches" },
  "led-3mm-bezel": { name: "3mm LED (bezel)", drillSize: 7.0, imperialLabel: '1/4"', category: "LEDs" },
  "led-3mm-no-bezel": { name: "3mm LED (no bezel)", drillSize: 3.0, imperialLabel: '1/8"', category: "LEDs" },
  "led-5mm-bezel": { name: "5mm LED (bezel)", drillSize: 8.0, imperialLabel: '5/16"', category: "LEDs" },
  "led-5mm-no-bezel": { name: "5mm LED (no bezel)", drillSize: 5.0, imperialLabel: '3/16"', category: "LEDs" },
  "jewel-light": { name: "Jewel Light Fixture", drillSize: 16.0, imperialLabel: '5/8"', category: "Fixtures" },
  "pilot-light": { name: "Pilot Light Fixture", drillSize: 23.0, imperialLabel: '7/8"', category: "Fixtures" },
  potentiometer: { name: "Potentiometer (Legacy)", drillSize: 8.0, imperialLabel: '5/16"', category: "Potentiometers" },
} as const;

export type ComponentType = keyof typeof COMPONENT_TYPES;

export interface PlacedComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  side: EnclosureSide;
}

export interface ProjectState {
  enclosureType: EnclosureType;
  components: PlacedComponent[];
  gridEnabled: boolean;
  gridSize: number;
  zoom: number;
  unit: MeasurementUnit;
}

export function getUnwrappedDimensions(enclosureType: EnclosureType) {
  const enc = ENCLOSURE_TYPES[enclosureType];
  return {
    front: { width: enc.width, height: enc.height },
    top: { width: enc.width - (2 * CORNER_RADIUS), height: enc.depth },
    bottom: { width: enc.width - (2 * CORNER_RADIUS), height: enc.depth },
    left: { width: enc.depth, height: enc.height - (2 * CORNER_RADIUS) },
    right: { width: enc.depth, height: enc.height - (2 * CORNER_RADIUS) },
  };
}
