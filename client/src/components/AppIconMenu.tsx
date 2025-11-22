import { SiInstagram } from "react-icons/si";
import { Book, Coffee, Download, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import enclosureProIcon from "@/../../images/EnclosureProIcon.svg";
import { useEffect, useState } from "react";
import ProgressDialog from "@/components/ProgressDialog";

export default function AppIconMenu() {
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressDetails, setProgressDetails] = useState({} as any);

  useEffect(() => {
    // Get version from Electron
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(version => {
        setAppVersion(version);
      });

      // Listen for update events
      const removeUpdateAvailable = window.electronAPI.onUpdateAvailable((event, info) => {
        setUpdateAvailable(true);
      });

      const removeUpdateDownloaded = window.electronAPI.onUpdateDownloaded((event, info) => {
        // Update is ready to install
        setShowProgress(false);
        setDownloadProgress(0);
      });

      // Progress event listeners
      const removeDownloadStarted = window.electronAPI.onDownloadStarted(() => {
        setShowProgress(true);
        setDownloadProgress(0);
      });

      const removeDownloadProgress = window.electronAPI.onDownloadProgress((event, progress) => {
        setDownloadProgress(progress.percent);
        setProgressDetails(progress);
      });

      const removeUpdateError = window.electronAPI.onUpdateError((event, error) => {
        setShowProgress(false);
        setDownloadProgress(0);
        console.error('Update error:', error);
      });

      return () => {
        removeUpdateAvailable();
        removeUpdateDownloaded();
        removeDownloadStarted();
        removeDownloadProgress();
        removeUpdateError();
      };
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) return;
    
    setIsChecking(true);
    try {
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSimulateUpdate = async () => {
    if (!window.electronAPI) return;
    
    try {
      await window.electronAPI.simulateUpdate();
    } catch (error) {
      console.error('Failed to simulate update:', error);
    }
  };

  // Simple development detection (always show test option when running locally)
  const isDevelopment = false; // Set this to false when building for production

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            data-testid="button-app-menu"
          >
            <img src={enclosureProIcon} alt="Enclosure Pro" className="w-full h-full object-contain" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" data-testid="menu-app-dropdown">
          {/* 1. App Info (First) */}
          <DropdownMenuItem disabled className="flex flex-col items-start gap-1 py-3">
            <div className="font-semibold text-base">Enclosure Pro</div>
            <div className="text-xs text-muted-foreground">Version {appVersion}</div>
            {updateAvailable && (
              <div className="text-xs text-green-600 font-medium">Update Available!</div>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          
          {/* 2. Created By (Second) */}
          <div className="px-2 py-3">
            <div className="text-xs text-muted-foreground mb-2">Created by Tim Samoff</div>
            <a
              href="https://www.instagram.com/circuitous.fx/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
              data-testid="link-instagram"
            >
              <span>Circuitous FX</span>
              <SiInstagram className="w-4 h-4" />
            </a>
          </div>
          
          <DropdownMenuSeparator />
          
          {/* 3. Documentation (Third) */}
          <DropdownMenuItem asChild>
            <a
              href="https://samoff.com/enclosure-pro/documentation.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 cursor-pointer"
              data-testid="link-documentation"
            >
              <Book className="w-4 h-4" />
              <span>Documentation</span>
            </a>
          </DropdownMenuItem>

          {/* Test Simulate Update - Always show in development */}
          {isDevelopment && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSimulateUpdate}
                className="flex items-center gap-2 cursor-pointer text-yellow-600"
              >
                <RefreshCw className="w-4 h-4" />
                <span>TEST: Simulate Update</span>
              </DropdownMenuItem>
            </>
          )}

          {/* Check for Updates (Second to Last) */}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleCheckForUpdates} 
            disabled={isChecking}
            className="flex items-center gap-2 cursor-pointer"
          >
            {isChecking ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
          </DropdownMenuItem>

          {/* Buy Me a Cup of Coffee (Last) */}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a
              href="https://www.paypal.com/paypalme/circuitousfx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 cursor-pointer"
              data-testid="link-buy-me-coffee"
            >
              <Coffee className="w-4 h-4" />
              <span>Buy Me a Cup of Coffee</span>
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Progress Dialog */}
      <ProgressDialog
        isOpen={showProgress}
        progress={downloadProgress}
        bytesPerSecond={progressDetails.bytesPerSecond}
        total={progressDetails.total}
        transferred={progressDetails.transferred}
      />
    </>
  );
}