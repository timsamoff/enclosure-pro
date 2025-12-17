export const isMac = typeof navigator !== 'undefined' 
  ? navigator.platform.toUpperCase().indexOf('MAC') >= 0
  : false;

/**
 * Get the modifier key symbol for the current platform
 */
export const modifierKey = isMac ? '⌘' : 'Ctrl';

/**
 * Get the shift key symbol for the current platform
 */
export const shiftKey = isMac ? '⇧' : 'Shift';

/**
 * Format a keyboard shortcut for display
 * @param key - The main key (e.g., 'S', 'N', 'O')
 * @param useShift - Whether to include Shift modifier
 * @returns Formatted shortcut string (e.g., '⌘S' or 'Ctrl+S')
 */
export function formatShortcut(key: string, useShift: boolean = false): string {
  if (isMac) {
    // Mac format: ⇧⌘S (no separators)
    const shift = useShift ? '⇧' : '';
    return `${shift}⌘${key}`;
  } else {
    // Windows/Linux format: Ctrl+Shift+S
    const shift = useShift ? 'Shift+' : '';
    return `Ctrl+${shift}${key}`;
  }
}

/**
 * Common shortcuts used in the app
 */
export const shortcuts = {
  new: formatShortcut('N'),
  open: formatShortcut('O'),
  save: formatShortcut('S'),
  saveAs: formatShortcut('S', true),
  print: formatShortcut('P'), // Shows as Ctrl+P in menus
  exportPDF: formatShortcut('E'), // Still functional but not shown in menus
  quit: formatShortcut('Q'),
  zoomIn: isMac ? '⌘+' : 'Ctrl++',
  zoomOut: isMac ? '⌘-' : 'Ctrl+-',
};