import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface ProgressDialogProps {
  isOpen: boolean;
  progress: number;
  bytesPerSecond?: number;
  total?: number;
  transferred?: number;
}

export default function ProgressDialog({ 
  isOpen, 
  progress, 
  bytesPerSecond, 
  total, 
  transferred 
}: ProgressDialogProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      // Smooth progress animation
      setDisplayProgress(progress);
    }
  }, [progress, isOpen]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Downloading Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Progress value={displayProgress} className="w-full" />
          <div className="text-sm text-center text-muted-foreground">
            {progress.toFixed(0)}% complete
          </div>
          {(bytesPerSecond || transferred) && (
            <div className="text-xs text-center text-muted-foreground space-y-1">
              {bytesPerSecond && (
                <div>Speed: {formatSpeed(bytesPerSecond)}</div>
              )}
              {transferred && total && (
                <div>
                  {formatBytes(transferred)} of {formatBytes(total)}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}