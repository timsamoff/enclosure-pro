import { z } from "zod";

export type EnclosureSide = "Front" | "Right" | "Left" | "Top" | "Bottom";
export type MeasurementUnit = "metric" | "imperial";
export type EnclosureManufacturer = "Hammond" | "CNC Pro" | "GØRVA design" | "Tayda";

export const CORNER_RADIUS = 5;

export interface EnclosureDimensions {
  width: number;
  height: number;
  depth: number;
  cornerStyle: "rounded" | "sharp";
  frontDepth?: number;
  isTrapezoidal?: boolean;
  rotatesLabels?: boolean;
  manufacturer: EnclosureManufacturer;
  displayName?: string; // For showing "1590BB" instead of "Hammond-1590BB"
}

export const ENCLOSURE_TYPES = {
  // Hammond enclosures (prefixed)
  "Hammond-1590A": { width: 39, height: 93, depth: 30, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590A" },
  "Hammond-1590B": { width: 60, height: 113, depth: 30, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590B" },
  "Hammond-1590LB": { width: 51, height: 51, depth: 29, rotatesLabels: false, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590LB" },
  "Hammond-125B": { width: 66.98, height: 121, depth: 35.94, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "125B" },
  "Hammond-1590BB": { width: 119, height: 94, depth: 33, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590BB" },
  "Hammond-1590BB2": { width: 119, height: 94, depth: 37, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590BB2" },
  "Hammond-1590BBS": { width: 120, height: 94, depth: 38.3, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590BBS" },
  "Hammond-1590DD": { width: 188, height: 120, depth: 36, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590DD" },
  "Hammond-1590XX": { width: 153, height: 122.5, depth: 38, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590XX" },
  
  // Legacy names (backward compatibility - map to Hammond)
  "1590A": { width: 39, height: 93, depth: 30, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590A" },
  "1590B": { width: 60, height: 113, depth: 30, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590B" },
  "1590LB": { width: 51, height: 51, depth: 29, rotatesLabels: false, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590LB" },
  "125B": { width: 66.98, height: 121, depth: 35.94, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "125B" },
  "1590BB": { width: 119, height: 94, depth: 33, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590BB" },
  "1590BB2": { width: 119, height: 94, depth: 37, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590BB2" },
  "1590BBS": { width: 120, height: 94, depth: 38.3, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590BBS" },
  "1590DD": { width: 188, height: 120, depth: 36, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590DD" },
  "1590XX": { width: 153, height: 122.5, depth: 38, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Hammond" as const, displayName: "1590XX" },
  
  // Other manufacturers
  "CNC-1590BB": { width: 119.5, height: 94.5, depth: 33.2, rotatesLabels: true, cornerStyle: "sharp" as const, manufacturer: "CNC Pro" as const, displayName: "1590BB" },
  "GORVA-125B": { width: 67, height: 121.5, depth: 36, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "GØRVA design" as const, displayName: "125B" },
  "Tayda-1590BB": { width: 119.2, height: 94.3, depth: 33.1, rotatesLabels: true, cornerStyle: "rounded" as const, manufacturer: "Tayda" as const, displayName: "1590BB" },
} as const;

export type EnclosureType = keyof typeof ENCLOSURE_TYPES;

// Helper to get manufacturer icon/prefix
export function getManufacturerPrefix(manufacturer: EnclosureManufacturer): string {
  const prefixes: Record<EnclosureManufacturer, string> = {
    "Hammond": "H",
    "CNC Pro": "C",
    "GØRVA design": "G",
    "Tayda": "T"
  };
  return prefixes[manufacturer];
}

// Helper to get display name for enclosure
export function getEnclosureDisplayName(type: EnclosureType): string {
  const enclosure = ENCLOSURE_TYPES[type];
  return enclosure?.displayName || type;
}

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
  
  // Footprint Guides
  "spst-toggle": { 
    name: "SPST Toggle",
    drillSize: 0, 
    imperialLabel: '17/64" × 1/2"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 6.8, 
    height: 12.8
  },
  "spst-mini": { 
    name: "SPST Mini Toggle", 
    drillSize: 0, 
    imperialLabel: '1/4" × 3/8"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 6.35, 
    height: 9.5
  },
  "slide-slide": { 
    name: "SPDT Slide", 
    drillSize: 0, 
    imperialLabel: '15/64" × 1/2"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 6, 
    height: 12.7
  },
  "dpdt-toggle": { 
    name: "DPDT Toggle", 
    drillSize: 0, 
    imperialLabel: '29/64" × 1/2"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 11.43, 
    height: 12.7
  },
  "dpdt-vintage": { 
    name: "Vintage DPDT", 
    drillSize: 0, 
    imperialLabel: '35/64" × 35/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 14, 
    height: 14
  },
  "dpdt-slide": { 
    name: "Mini DPDT Slide", 
    drillSize: 0, 
    imperialLabel: '2/5" x 63/100"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 10, 
    height: 16 
  },
  "3pdt-generic": { 
    name: "Generic 3PDT", 
    drillSize: 0,
    imperialLabel: '45/64" × 43/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 18, 
    height: 17.1 
  },
  "3pdt-gorva": { 
    name: "Gorva 3PDT", 
    drillSize: 0, 
    imperialLabel: '43/64" × 21/32"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 17, 
    height: 16.7 
  },
  "3pdt-toggle": { 
    name: "3PDT Toggle", 
    drillSize: 0, 
    imperialLabel: '25/64" × 33/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 10, 
    height: 13.2 
  },
  "4pdt-generic": { 
    name: "Generic 4PDT", 
    drillSize: 0, 
    imperialLabel: '51/64" × 43/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 20, 
    height: 17
  },
  "4pdt-vintage": { 
    name: "Vintage 4PDT", 
    drillSize: 0, 
    imperialLabel: '45/64" × 45/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 18, 
    height: 18
  },
  "5pdt-generic": { 
    name: "Generic 5PDT", 
    drillSize: 0, 
    imperialLabel: '57/64" × 43/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 22.5, 
    height: 17
  },
  "dip-2": { 
    name: "2-Pos DIP", 
    drillSize: 0, 
    imperialLabel: '25/64" x 13/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 10, 
    height: 5 
  },
"dip-4": { 
    name: "4-Pos DIP", 
    drillSize: 0, 
    imperialLabel: '29/64" x 13/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 11.6, 
    height: 5 
  },
"rotary-1": { 
    name: "1P4T Rotary", 
    drillSize: 10, 
    imperialLabel: '25/64"', 
    category: "Footprint Guides", 
    shape: "circle",
  },
  "rotary-2": { 
    name: "2P6T Rotary", 
    drillSize: 13, 
    imperialLabel: '33/64"', 
    category: "Footprint Guides", 
    shape: "circle",
  },
  "pushbutton-momentary": { 
    name: "Momentary Pushbutton", 
    drillSize: 6, 
    imperialLabel: '15/64"', 
    category: "Footprint Guides", 
    shape: "circle",
  },
  "3pdt-washer": { 
    name: "Generic 3PDT Washer", 
    drillSize: 17.2, 
    imperialLabel: '43/64"', 
    category: "Footprint Guides", 
    shape: "circle",
  },
  "3pdt-nut": { 
    name: "3PDT Aluminum Nut", 
    drillSize: 18.9, 
    imperialLabel: '3/4"', 
    category: "Footprint Guides", 
    shape: "circle",
  },
  "3pdt-dress": { 
    name: "3PDT Dress Nut", 
    drillSize: 19.6, 
    imperialLabel: '49/64"', 
    category: "Footprint Guides", 
    shape: "circle",
  },
  
  // Circle Footprint guides
  "pot-7": { 
    name: "7mm Potentiometer", 
    drillSize: 7, 
    imperialLabel: '9/32"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-9": { 
    name: "9mm Potentiometer", 
    drillSize: 9, 
    imperialLabel: '23/64"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-10": { 
    name: "10mm Potentiometer", 
    drillSize: 10, 
    imperialLabel: '25/64"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-11": { 
    name: "11mm Potentiometer", 
    drillSize: 11, 
    imperialLabel: '7/16"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-16": { 
    name: "16mm Potentiometer", 
    drillSize: 16, 
    imperialLabel: '5/8"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-17": { 
    name: "17mm Potentiometer", 
    drillSize: 17, 
    imperialLabel: '43/64"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-18": { 
    name: "18mm Potentiometer", 
    drillSize: 18, 
    imperialLabel: '45/64"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-20": { 
    name: "20mm Potentiometer", 
    drillSize: 20, 
    imperialLabel: '13/16"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-24": { 
    name: "24mm Potentiometer", 
    drillSize: 24, 
    imperialLabel: '15/16"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-27": { 
    name: "27mm Potentiometer", 
    drillSize: 27, 
    imperialLabel: '1 1/16"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-30": { 
    name: "30mm Potentiometer", 
    drillSize: 30, 
    imperialLabel: '1 3/16"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "pot-35": { 
    name: "35mm Potentiometer", 
    drillSize: 35, 
    imperialLabel: '1 3/8"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "jack-mono-open": { 
    name: '1/4" Mono Jack (Open)', 
    drillSize: 17.5, 
    imperialLabel: '11/16"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
    "jack-stereo-open": { 
    name: '1/4" Stereo Jack (Open)', 
    drillSize: 19.05, 
    imperialLabel: '3/4"', 
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "jack-mono-enclosed": { 
    name: '1/4" Jack (Enclosed)', 
    drillSize: 0, 
    imperialLabel: '25/32" x 39/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 20, 
    height: 15.5 
  },
  "jack-mono-lumberg": { 
    name: '1/4" Jack (Lumberg)', 
    drillSize: 0, 
    imperialLabel: '37/64" x 37/64"', 
    category: "Footprint Guides", 
    shape: "rectangle", 
    width: 14.75, 
    height: 14.75 
  },
  "knob-10": { 
    name: '10mm Knob', 
    drillSize: 10, 
    imperialLabel: '25/64"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-125": { 
    name: '12.5mm Knob', 
    drillSize: 12.5, 
    imperialLabel: '1/2"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-135": { 
    name: '13.5mm Knob', 
    drillSize: 13.5, 
    imperialLabel: '17/32"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-16": { 
    name: '16mm Knob', 
    drillSize: 16, 
    imperialLabel: '5/8"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-19": { 
    name: '19mm Knob', 
    drillSize: 19, 
    imperialLabel: '3/4"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-20": { 
    name: '20mm Knob', 
    drillSize: 20, 
    imperialLabel: '13/16"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-22": { 
    name: '22mm Knob', 
    drillSize: 22, 
    imperialLabel: '7/8"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-25": { 
    name: '25mm Knob', 
    drillSize: 25, 
    imperialLabel: '1"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-29": { 
    name: '29mm Knob', 
    drillSize: 29, 
    imperialLabel: '1 1/8"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-32": { 
    name: '32mm Knob', 
    drillSize: 32, 
    imperialLabel: '1 1/4"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-35": { 
    name: '35mm Knob', 
    drillSize: 35, 
    imperialLabel: '1 3/8"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-40": { 
    name: '40mm Knob', 
    drillSize: 40, 
    imperialLabel: '1 9/16"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-52": { 
    name: '52mm Knob', 
    drillSize: 52, 
    imperialLabel: '2 1/16"',
    category: "Footprint Guides", 
    shape: "circle" 
  },
  "knob-61": { 
    name: '61mm Knob', 
    drillSize: 61, 
    imperialLabel: '2 3/8"',
    category: "Footprint Guides", 
    shape: "circle" 
  }
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
  rotation: number;
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