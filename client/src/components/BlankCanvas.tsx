import { Box } from "lucide-react";

interface BlankCanvasProps {
  onSelectEnclosure: () => void;
  appIcon?: string | null;
  appVersion?: string;
}

export default function BlankCanvas({ 
  onSelectEnclosure, 
  appIcon, 
  // Use the injected version, with fallbacks
  appVersion = import.meta.env.APP_VERSION || "1.1.0"
}: BlankCanvasProps) {
  // For debugging - check what value we're getting
  console.log('App version:', import.meta.env.APP_VERSION);
  console.log('Using version:', appVersion);
  
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8">
        {appIcon ? (
          <div className="w-24 h-24 mx-auto mb-6">
            <img 
              src={appIcon} 
              alt="Enclosure Pro Logo" 
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <Box className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        )}
        
        <h2 className="text-2xl font-semibold mb-2">Welcome to Enclosure Pro</h2>
        
        {/* Show version from import.meta.env */}
        <p className="text-sm text-muted-foreground mb-3">
          v{import.meta.env.APP_VERSION || appVersion}
        </p>
        
        <p className="text-muted-foreground mb-6">
          Get started by selecting an enclosure<br />to begin your design
        </p>
        
        <button
          onClick={onSelectEnclosure}
          className="px-6 py-3 bg-[#ff8c42] text-white rounded-lg hover-elevate active-elevate-2 font-medium cursor-pointer"
        >
          Choose Enclosure
        </button>
      </div>
    </div>
  );
}