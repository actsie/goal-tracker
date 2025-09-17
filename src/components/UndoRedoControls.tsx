import { Undo, Redo, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type UseUndoRedoReturn } from '@/hooks/useUndoRedo';

interface UndoRedoControlsProps {
  undoRedo: UseUndoRedoReturn;
  className?: string;
  showLabels?: boolean;
  showClearButton?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

export function UndoRedoControls({
  undoRedo,
  className,
  showLabels = false,
  showClearButton = false,
  size = 'default',
  variant = 'outline'
}: UndoRedoControlsProps) {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    isExecuting,
    clearHistory,
    stackSizes
  } = undoRedo;

  const getUndoTooltip = () => {
    if (!canUndo) return 'Nothing to undo';
    return undoDescription ? `Undo: ${undoDescription}` : 'Undo last action';
  };

  const getRedoTooltip = () => {
    if (!canRedo) return 'Nothing to redo';
    return redoDescription ? `Redo: ${redoDescription}` : 'Redo last action';
  };

  const getKeyboardShortcut = () => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? '⌘' : 'Ctrl';
    return { undo: `${modifier}+Z`, redo: `${modifier}+Shift+Z` };
  };

  const shortcuts = getKeyboardShortcut();

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        {/* Undo Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={undo}
              disabled={!canUndo || isExecuting}
              className={cn(
                "transition-opacity",
                !canUndo && "opacity-50 cursor-not-allowed"
              )}
              aria-label={getUndoTooltip()}
            >
              <Undo className="h-4 w-4" />
              {showLabels && <span className="ml-2">Undo</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="text-sm">
              <div>{getUndoTooltip()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {shortcuts.undo}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Redo Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              onClick={redo}
              disabled={!canRedo || isExecuting}
              className={cn(
                "transition-opacity",
                !canRedo && "opacity-50 cursor-not-allowed"
              )}
              aria-label={getRedoTooltip()}
            >
              <Redo className="h-4 w-4" />
              {showLabels && <span className="ml-2">Redo</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="text-sm">
              <div>{getRedoTooltip()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {shortcuts.redo}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Clear History Button (Optional) */}
        {showClearButton && (stackSizes.undo > 0 || stackSizes.redo > 0) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={size}
                onClick={clearHistory}
                disabled={isExecuting}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Clear undo/redo history"
              >
                <RotateCcw className="h-4 w-4" />
                {showLabels && <span className="ml-2">Clear</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="text-sm">
                Clear all undo/redo history
                <div className="text-xs text-muted-foreground mt-1">
                  ({stackSizes.undo} undo, {stackSizes.redo} redo)
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Loading indicator */}
        {isExecuting && (
          <div className="ml-2 text-sm text-muted-foreground">
            Processing...
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// Compact version for toolbars
export function CompactUndoRedoControls({
  undoRedo,
  className
}: {
  undoRedo: UseUndoRedoReturn;
  className?: string;
}) {
  return (
    <UndoRedoControls
      undoRedo={undoRedo}
      className={className}
      size="sm"
      variant="ghost"
    />
  );
}

// Full-featured version with labels
export function FullUndoRedoControls({
  undoRedo,
  className
}: {
  undoRedo: UseUndoRedoReturn;
  className?: string;
}) {
  return (
    <UndoRedoControls
      undoRedo={undoRedo}
      className={className}
      showLabels={true}
      showClearButton={true}
      variant="outline"
    />
  );
}

// Status display component
export function UndoRedoStatus({
  undoRedo,
  className
}: {
  undoRedo: UseUndoRedoReturn;
  className?: string;
}) {
  const { stackSizes, isExecuting } = undoRedo;

  if (stackSizes.undo === 0 && stackSizes.redo === 0 && !isExecuting) {
    return null;
  }

  return (
    <div className={cn("text-xs text-muted-foreground", className)}>
      {isExecuting ? (
        'Processing...'
      ) : (
        `${stackSizes.undo} undo, ${stackSizes.redo} redo available`
      )}
    </div>
  );
}