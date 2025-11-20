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
  const modifier = isMac ? '⌘' : 'Ctrl+';
  const shift = useShift ? (isMac ? '⇧' : 'Shift+') : '';
  
  if (isMac) {
    // Mac format: ⇧⌘S (no separators)
    return `${shift}${modifier}${key}`;
  } else {
    // Windows/Linux format: Ctrl+Shift+S
    return `${modifier}${shift}${key}`;
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
  print: formatShortcut('P'),
  exportPDF: formatShortcut('E'),
  quit: formatShortcut('Q'),
  zoomIn: isMac ? '⌘+' : 'Ctrl++',
  zoomOut: isMac ? '⌘-' : 'Ctrl+-',
};