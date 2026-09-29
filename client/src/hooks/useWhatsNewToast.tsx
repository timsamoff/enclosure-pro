import { useEffect } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export const RELEASES_URL = "https://samoff.com/enclosure-pro/releases.html";

const LAST_SEEN_KEY = "enclosurePro.lastSeenVersion";

// Once per update: on the first launch of a new version, offer a link to the release notes.
// A fresh install only records the version; there's nothing "new" to announce yet.
export function useWhatsNewToast() {
  const { toast } = useToast();

  useEffect(() => {
    const current: string = import.meta.env.APP_VERSION;
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(LAST_SEEN_KEY);
      localStorage.setItem(LAST_SEEN_KEY, current);
    } catch {
      return; // storage unavailable: skip rather than nag on every launch
    }
    if (!previous || previous === current) return;

    toast({
      title: `Updated to v${current}`,
      description: "See what changed in this version.",
      duration: 15000,
      action: (
        <ToastAction altText="Open the release notes" onClick={() => window.open(RELEASES_URL, "_blank")}>
          What's new
        </ToastAction>
      ),
    });
  }, [toast]);
}
