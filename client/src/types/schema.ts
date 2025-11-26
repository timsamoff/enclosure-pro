import { z } from "zod";

export type EnclosureSide = "Front" | "Right" | "Left" | "Top" | "Bottom";
export type MeasurementUnit = "metric" | "imperial";

export const CORNER_RADIUS = 5;

export interface EnclosureDimensions {
  width: number;
  height: number;
  depth: number;
  cornerStyle: "rounded" | "sharp";
  frontDepth?: number;
  isTrapezoidal?: boolean;
  rotatesLabels?: boolean;
}

export const ENCLOSURE_TYPES = {
  "1590A": { width: 38.5, height: 93.6, depth: 28, rotatesLabels: true, cornerStyle: "rounded" as const },
  "1590B": { width: 60.9, height: 111.9, depth: 29, rotatesLabels: true, cornerStyle: "rounded" as const },
  "1590LB": { width: 50.5, height: 50.5, depth: 29, rotatesLabels: false, cornerStyle: "rounded" as const },
  "125B": { width: 66, height: 121, depth: 35.94, rotatesLabels: true, cornerStyle: "rounded" as const },
  "1590BB": { width: 119.5, height: 94, depth: 30, rotatesLabels: true, cornerStyle: "rounded" as const },
  "1590BB2": { width: 120, height: 94, depth: 34, rotatesLabels: true, cornerStyle: "rounded" as const },
  "1590DD": { width: 188, height: 120, depth: 33, rotatesLabels: true, cornerStyle: "rounded" as const },
  "1590XX": { width: 145, height: 120, depth: 35, rotatesLabels: true, cornerStyle: "rounded" as const },
} as const;

export type EnclosureType = keyof typeof ENCLOSURE_TYPES;

export interface ComponentTypeData {
  name: string;
  drillSize: number;
  imperialLabel: string;
  category: string;
  shape?: "circle" | "rectangle" | "square";
  width?: number;
  height?: number;
}

export const COMPONENT_TYPES: Record<string, ComponentTypeData> = {
  "pot-9mm": { name: "9mm Potentiometer", drillSize: 6.0, imperialLabel: '1/4"', category: "Potentiometers" },
  "pot-16mm": { name: "16mm Potentiometer", drillSize: 7.0, imperialLabel: '9/32"', category: "Potentiometers" },
  "pot-17mm": { name: "17mm Potentiometer", drillSize: 7.5, imperialLabel: '19/64"', category: "Potentiometers" },
  "pot-24mm": { name: "24mm Potentiometer", drillSize: 8.0, imperialLabel: '5/16"', category: "Potentiometers" },
  "eighth-jack": { name: '1/8" Jack', drillSize: 6.0, imperialLabel: '1/4"', category: "Jacks" },
  "quarter-jack": { name: '1/4" Jack', drillSize: 10.0, imperialLabel: '3/8"', category: "Jacks" },
  "dc-jack-2": { name: "2 Pin DC Jack", drillSize: 8.0, imperialLabel: '5/16"', category: "Jacks" },
  "dc-jack-3": { name: "3 Pin DC Jack", drillSize: 12.0, imperialLabel: '1/2"', category: "Jacks" },
  "xlr-jack": { name: "XLR Jack", drillSize: 15.0, imperialLabel: '5/8"', category: "Jacks" },
  "footswitch": { name: "Footswitch", drillSize: 12.0, imperialLabel: '1/2"', category: "Switches" },
  "toggle": { name: "Toggle Switch", drillSize: 7.0, imperialLabel: '1/4"', category: "Switches" },
  "push-button": { name: "Push Button", drillSize: 8.0, imperialLabel: '5/16"', category: "Switches" },
  "rocker-switch": { name: "Rocker Switch", drillSize: 12.0, imperialLabel: '1/2"', category: "Switches" },
  "momentary-button": { name: "Momentary Button", drillSize: 6.0, imperialLabel: '1/4"', category: "Switches" },
  "rotary": { name: "Rotary Switch", drillSize: 10.0, imperialLabel: '3/8"', category: "Switches" },
  "led-3mm-bezel": { name: "3mm LED (bezel)", drillSize: 7.0, imperialLabel: '1/4"', category: "LEDs" },
  "led-3mm-no-bezel": { name: "3mm LED (no bezel)", drillSize: 3.0, imperialLabel: '1/8"', category: "LEDs" },
  "led-5mm-bezel": { name: "5mm LED (bezel)", drillSize: 8.0, imperialLabel: '5/16"', category: "LEDs" },
  "led-5mm-no-bezel": { name: "5mm LED (no bezel)", drillSize: 5.0, imperialLabel: '3/16"', category: "LEDs" },
  "jewel-light": { name: "Jewel Light Fixture", drillSize: 16.0, imperialLabel: '5/8"', category: "Fixtures" },
  "pilot-light": { name: "Pilot Light Fixture", drillSize: 23.0, imperialLabel: '7/8"', category: "Fixtures" },
  "screw-3": { name: "M3 Screw", drillSize: 3, imperialLabel: '1/8"', category: "Screws" },
  "screw-6": { name: "#6-32 Screw", drillSize: 3.5, imperialLabel: '5/8"', category: "Screws" },
  "screw-4": { name: "M4 Screw", drillSize: 4, imperialLabel: '5/32"', category: "Screws" },
  
  // Utility Guides (not printed)
  // "rectangle-10x10": { name: "10mm × 10mm Rectangle", drillSize: 0, imperialLabel: '13/32" × 13/32"', category: "Utility Guides (not printed)", shape: "rectangle", width: 10, height: 10 },
  // "rectangle-15x10": { name: "15mm × 10mm Rectangle", drillSize: 0, imperialLabel: '19/32" × 13/32"', category: "Utility Guides (not printed)", shape: "rectangle", width: 15, height: 10 },
  // "rectangle-20x15": { name: "20mm × 15mm Rectangle", drillSize: 0, imperialLabel: '25/32" × 19/32"', category: "Utility Guides (not printed)", shape: "rectangle", width: 20, height: 15 },
  // "rectangle-25x15": { name: "25mm × 15mm Rectangle", drillSize: 0, imperialLabel: '1" × 19/32"', category: "Utility Guides (not printed)", shape: "rectangle", width: 25, height: 15 },
  // "square-10": { name: "10mm Square", drillSize: 0, imperialLabel: '13/32" sq', category: "Utility Guides (not printed)", shape: "square", width: 10, height: 10 },
  // "square-15": { name: "15mm Square", drillSize: 0, imperialLabel: '19/32" sq', category: "Utility Guides (not printed)", shape: "square", width: 15, height: 15 },
  // "square-20": { name: "20mm Square", drillSize: 0, imperialLabel: '25/32" sq', category: "Utility Guides (not printed)", shape: "square", width: 20, height: 20 },
  
  // NEW: Circle utility guides
  // "circle-10": { name: "10mm Circle", drillSize: 10, imperialLabel: '13/32"', category: "Utility Guides (not printed)", shape: "circle" },
  // "circle-15": { name: "15mm Circle", drillSize: 15, imperialLabel: '19/32"', category: "Utility Guides (not printed)", shape: "circle" },
  // "circle-20": { name: "20mm Circle", drillSize: 20, imperialLabel: '25/32"', category: "Utility Guides (not printed)", shape: "circle" },
  // "circle-25": { name: "25mm Circle", drillSize: 25, imperialLabel: '1"', category: "Utility Guides (not printed)", shape: "circle" },
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
  excludeFromPrint?: boolean;
}

export interface SideDimensions {
  width: number;
  height: number;
  cornerStyle: "rounded" | "sharp";
  isTrapezoidal?: boolean;
  frontWidth?: number;
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
    return {
      front: { 
        width: enc.width, 
        height: enc.height, 
        cornerStyle: enc.cornerStyle 
      },
      top: { 
        width: enc.width, 
        height: enc.depth,
        cornerStyle: enc.cornerStyle 
      },
      bottom: { 
        width: enc.width, 
        height: enc.frontDepth,
        cornerStyle: enc.cornerStyle 
      },
      left: { 
        width: enc.depth,
        height: enc.height, 
        cornerStyle: enc.cornerStyle,
        isTrapezoidal: true,
        frontWidth: enc.frontDepth
      },
      right: { 
        width: enc.depth,
        height: enc.height, 
        cornerStyle: enc.cornerStyle,
        isTrapezoidal: true,
        frontWidth: enc.frontDepth
      },
    };
  }
  
  return {
    front: { width: enc.width, height: enc.height, cornerStyle: enc.cornerStyle },
    top: { width: enc.width - (2 * CORNER_RADIUS), height: enc.depth, cornerStyle: enc.cornerStyle },
    bottom: { width: enc.width - (2 * CORNER_RADIUS), height: enc.depth, cornerStyle: enc.cornerStyle },
    left: { width: enc.depth, height: enc.height - (2 * CORNER_RADIUS), cornerStyle: enc.cornerStyle },
    right: { width: enc.depth, height: enc.height - (2 * CORNER_RADIUS), cornerStyle: enc.cornerStyle },
  };
}