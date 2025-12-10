import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelText?: string;
  confirmText?: string;
  destructiveText?: string;
  onConfirm: () => void;
  onDestructive?: () => void;
  onCancel?: () => void;
  testId?: string;
  showDestructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelText = "Cancel",
  confirmText = "Save",
  destructiveText = "Don't Save",
  onConfirm,
  onDestructive,
  onCancel,
  testId = "confirm-dialog",
  showDestructive = true
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={testId}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleCancel}
            data-testid={`${testId}-cancel`}
          >
            {cancelText}
          </AlertDialogCancel>
          {showDestructive && (
            <AlertDialogAction
              onClick={onDestructive}
              data-testid={`${testId}-destructive`}
              className="bg-destructive hover:bg-destructive/90"
            >
              {destructiveText}
            </AlertDialogAction>
          )}
          <AlertDialogAction 
            onClick={onConfirm}
            data-testid={`${testId}-confirm`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}