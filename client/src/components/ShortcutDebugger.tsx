import { useEffect, useState, useRef } from "react";
import { X, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DebugEvent {
  timestamp: string;
  type: 'keydown' | 'menu-action' | 'focus-change' | 'electron-event';
  description: string;
  details: any;
}

export default function ShortcutDebugger() {
  const [isVisible, setIsVisible] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [currentFocus, setCurrentFocus] = useState<string>('none');
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const maxEvents = 50;

  const addEvent = (type: DebugEvent['type'], description: string, details?: any) => {
    const event: DebugEvent = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      description,
      details: details || {}
    };
    
    setEvents(prev => {
      const updated = [...prev, event];
      return updated.slice(-maxEvents); // Keep only last 50 events
    });
  };

  useEffect(() => {
    if (!isVisible) return;

    // Track keyboard events
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.metaKey) modifiers.push('Cmd');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.altKey) modifiers.push('Alt');
      
      const keyCombo = modifiers.length > 0 
        ? `${modifiers.join('+')}+${e.key}`
        : e.key;

      const target = e.target as HTMLElement;
      const targetInfo = target.tagName + (target.id ? `#${target.id}` : '') + 
                        (target.className ? `.${target.className.split(' ')[0]}` : '');

      addEvent('keydown', `Key: ${keyCombo}`, {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        target: targetInfo,
        defaultPrevented: e.defaultPrevented
      });
    };

    // Track focus changes
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const focusInfo = target.tagName + 
                       (target.id ? `#${target.id}` : '') +
                       (target.className ? `.${target.className.split(' ')[0]}` : '');
      
      setCurrentFocus(focusInfo);
      addEvent('focus-change', `Focus: ${focusInfo}`, {
        tagName: target.tagName,
        id: target.id,
        className: target.className
      });
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const focusInfo = target.tagName + 
                       (target.id ? `#${target.id}` : '') +
                       (target.className ? `.${target.className.split(' ')[0]}` : '');
      
      addEvent('focus-change', `Blur: ${focusInfo}`, {
        tagName: target.tagName,
        id: target.id,
        className: target.className
      });
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('focusin', handleFocusIn, { capture: true });
    document.addEventListener('focusout', handleFocusOut, { capture: true });

    // Track Electron menu actions
    if (window.electronAPI) {
      const cleanupFns: (() => void)[] = [];

      if (window.electronAPI.onMenuNew) {
        cleanupFns.push(window.electronAPI.onMenuNew(() => {
          addEvent('electron-event', 'Electron Menu: New', {});
        }));
      }

      if (window.electronAPI.onMenuOpen) {
        cleanupFns.push(window.electronAPI.onMenuOpen(() => {
          addEvent('electron-event', 'Electron Menu: Open', {});
        }));
      }

      if (window.electronAPI.onMenuSave) {
        cleanupFns.push(window.electronAPI.onMenuSave(() => {
          addEvent('electron-event', 'Electron Menu: Save', {});
        }));
      }

      if (window.electronAPI.onMenuSaveAs) {
        cleanupFns.push(window.electronAPI.onMenuSaveAs(() => {
          addEvent('electron-event', 'Electron Menu: Save As', {});
        }));
      }

      if (window.electronAPI.onMenuPrint) {
        cleanupFns.push(window.electronAPI.onMenuPrint(() => {
          addEvent('electron-event', 'Electron Menu: Print', {});
        }));
      }

      if (window.electronAPI.onMenuExportPDF) {
        cleanupFns.push(window.electronAPI.onMenuExportPDF(() => {
          addEvent('electron-event', 'Electron Menu: Export PDF', {});
        }));
      }

      if (window.electronAPI.onMenuQuit) {
        cleanupFns.push(window.electronAPI.onMenuQuit(() => {
          addEvent('electron-event', 'Electron Menu: Quit', {});
        }));
      }

      return () => {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
        document.removeEventListener('focusin', handleFocusIn, { capture: true });
        document.removeEventListener('focusout', handleFocusOut, { capture: true });
        cleanupFns.forEach(fn => fn());
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('focusin', handleFocusIn, { capture: true });
      document.removeEventListener('focusout', handleFocusOut, { capture: true });
    };
  }, [isVisible]);

  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    const handleToggle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleToggle);
    return () => window.removeEventListener('keydown', handleToggle);
  }, []);

  const clearEvents = () => {
    setEvents([]);
  };

  const getEventColor = (type: DebugEvent['type']) => {
    switch (type) {
      case 'keydown': return 'text-blue-600 bg-blue-50';
      case 'menu-action': return 'text-purple-600 bg-purple-50';
      case 'focus-change': return 'text-orange-600 bg-orange-50';
      case 'electron-event': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 z-[9999] bg-purple-600 hover:bg-purple-700"
        size="icon"
      >
        <Bug className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 w-96 h-[600px] bg-white border-2 border-purple-600 rounded-lg shadow-2xl z-[9999] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-purple-600 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4" />
          <h3 className="font-semibold">Shortcut Debugger</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearEvents}
            className="px-2 py-1 text-xs bg-purple-700 hover:bg-purple-800 rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="hover:bg-purple-700 rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Current Focus */}
      <div className="p-2 border-b bg-gray-50 text-xs">
        <strong>Current Focus:</strong> <code className="ml-1 text-purple-600">{currentFocus}</code>
      </div>

      {/* Info */}
      <div className="p-2 border-b bg-yellow-50 text-xs text-yellow-800">
        <strong>Toggle:</strong> Ctrl+Shift+D | Events auto-clear after 50
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-auto p-2 space-y-1 text-xs font-mono">
        {events.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No events yet. Press some keys or use menu shortcuts!
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={index}
              className={`p-2 rounded border ${getEventColor(event.type)}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{event.type}</span>
                <span className="text-gray-500">{event.timestamp}</span>
              </div>
              <div className="font-medium">{event.description}</div>
              {Object.keys(event.details).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    Details
                  </summary>
                  <pre className="mt-1 text-[10px] bg-white p-1 rounded overflow-x-auto">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
        <div ref={eventsEndRef} />
      </div>

      {/* Stats */}
      <div className="p-2 border-t bg-gray-50 text-xs grid grid-cols-4 gap-2">
        <div className="text-center">
          <div className="font-semibold text-blue-600">{events.filter(e => e.type === 'keydown').length}</div>
          <div className="text-gray-500">Keys</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-green-600">{events.filter(e => e.type === 'electron-event').length}</div>
          <div className="text-gray-500">Electron</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-orange-600">{events.filter(e => e.type === 'focus-change').length}</div>
          <div className="text-gray-500">Focus</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-gray-600">{events.length}</div>
          <div className="text-gray-500">Total</div>
        </div>
      </div>
    </div>
  );
}