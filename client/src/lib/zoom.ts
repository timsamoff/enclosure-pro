export function snapZoom(value: number): number {
  // Round to nearest 0.1 (10% increment) and clamp to valid range [0.3, 3.0]
  const snapped = Math.round(value * 10) / 10;
  return Math.max(0.3, Math.min(3.0, snapped));
}
