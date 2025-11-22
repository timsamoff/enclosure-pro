import { z } from "zod";

export type EnclosureSide = "Front" | "Right" | "Left" | "Top" | "Bottom";
export type MeasurementUnit = "metric" | "imperial";

export const CORNER_RADIUS = 5;

export interface EnclosureDimensions {
  width: number;
  height: number;
  depth: number;
  cornerStyle: "rounded" | "sharp";
  frontDepth?: number; // For trapezoidal enclosures
  isTrapezoidal?: boolean; // Add this flag
  rotatesLabels?: boolean; // Add rotation flag
}

export const ENCLOSURE_TYPES = {
  "1590A": { width: 38.5, height: 93.6, depth: 28, rotatesLabels: true },
  "1590B": { width: 60.9, height: 111.9, depth: 29, rotatesLabels: true },
  "1590LB": { width: 50.5, height: 50.5, depth: 29, rotatesLabels: false },
  "125B": { width: 66, height: 121, depth: 35.94, rotatesLabels: true },
  "1590BB": { width: 119.5, height: 94, depth: 30, rotatesLabels: true },
  "1590BB2": { width: 120, height: 94, depth: 34, rotatesLabels: true },
  "1590DD": { width: 188, height: 120, depth: 33, rotatesLabels: true },
  "1590XX": { width: 145, height: 120, depth: 35, cornerStyle: "rounded" as const, rotatesLabels: true },
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

export interface ProjectState {
  enclosureType: EnclosureType;
  components: PlacedComponent[];
  gridEnabled: boolean;
  gridSize: number;
  zoom: number;
  rotation: number;
  unit: MeasurementUnit;
  appIcon?: string;
}

export interface PlacedComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  side: EnclosureSide;
}

export interface SideDimensions {
  width: number;
  height: number;
  cornerStyle: "rounded" | "sharp";
  isTrapezoidal?: boolean;
  frontWidth?: number; // For trapezoidal sides - narrow end width
}

export function getUnwrappedDimensions(enclosureType: EnclosureType): {
  front: SideDimensions;
  top: SideDimensions;
  bottom: SideDimensions;
  left: SideDimensions;
  right: SideDimensions;
} {
  const enc = ENCLOSURE_TYPES[enclosureType];
  const isTrapezoidal = enc.isTrapezoidal || false;
  
  if (isTrapezoidal && enc.frontDepth) {
    // For trapezoidal enclosures
    return {
      front: { 
        width: enc.width, 
        height: enc.height, 
        cornerStyle: enc.cornerStyle 
      },
      top: { 
        width: enc.width, 
        height: enc.depth, // Top uses full depth
        cornerStyle: enc.cornerStyle 
      },
      bottom: { 
        width: enc.width, 
        height: enc.frontDepth, // Bottom uses front depth (narrow)
        cornerStyle: enc.cornerStyle 
      },
      left: { 
        width: enc.depth, // Width at top (back - wide)
        height: enc.height, 
        cornerStyle: enc.cornerStyle,
        isTrapezoidal: true,
        frontWidth: enc.frontDepth // Narrow width at bottom
      },
      right: { 
        width: enc.depth, // Width at top (back - wide)
        height: enc.height, 
        cornerStyle: enc.cornerStyle,
        isTrapezoidal: true,
        frontWidth: enc.frontDepth // Narrow width at bottom
      },
    };
  }
  
  // Original logic for rectangular enclosures
  return {
    front: { width: enc.width, height: enc.height, cornerStyle: enc.cornerStyle },
    top: { width: enc.width - (2 * CORNER_RADIUS), height: enc.depth, cornerStyle: enc.cornerStyle },
    bottom: { width: enc.width - (2 * CORNER_RADIUS), height: enc.depth, cornerStyle: enc.cornerStyle },
    left: { width: enc.depth, height: enc.height - (2 * CORNER_RADIUS), cornerStyle: enc.cornerStyle },
    right: { width: enc.depth, height: enc.height - (2 * CORNER_RADIUS), cornerStyle: enc.cornerStyle },
  };
}