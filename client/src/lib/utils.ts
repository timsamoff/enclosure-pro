import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mmToFraction(mm: number): string {
  const overrides: Record<string, string> = {
    "13.493750": "17/32\"",
    "12.700000": "1/2\"",
    "10.318750": "13/32\"",
    "6.350000": "1/4\"",
  };
  
  const mmKey = mm.toFixed(6);
  if (overrides[mmKey]) {
    return overrides[mmKey];
  }
  
  const inches = mm / 25.4;
  let whole = Math.floor(inches);
  let decimal = inches - whole;
  
  const fractions: Array<{ decimal: number; num: number; den: number }> = [];
  
  for (let i = 0; i <= 64; i++) {
    fractions.push({ decimal: i / 64, num: i, den: 64 });
  }
  
  let closest = fractions[0];
  let minDiff = Math.abs(decimal - fractions[0].decimal);
  
  for (const frac of fractions) {
    const diff = Math.abs(decimal - frac.decimal);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frac;
    }
  }
  
  if (closest.num === 64) {
    whole += 1;
    closest = { decimal: 0, num: 0, den: 64 };
  }
  
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(closest.num, closest.den);
  const simplifiedNum = closest.num / divisor;
  const simplifiedDen = closest.den / divisor;
  
  if (whole === 0 && simplifiedNum === 0) {
    return `${inches.toFixed(3)}"`;
  } else if (whole === 0) {
    return `${simplifiedNum}/${simplifiedDen}"`;
  } else if (simplifiedNum === 0) {
    return `${whole}"`;
  } else {
    return `${whole} ${simplifiedNum}/${simplifiedDen}"`;
  }
}
