import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getHistoryManager, 
  type HistoryManager, 
  type Command,
  UndoRedoError,
  PersistenceError,
  CommandExecutionError,
  configureUndoRedo
} from '@/lib/undoRedo';
import { formatDateKey } from '@/lib/date-utils';

export interface UseUndoRedoOptions {
  onError?: (error: Error) => void;
  onSuccess?: (action: 'undo' | 'redo') => void;
  maxHistorySize?: number;
  enableOptimisticUpdates?: boolean;
  mergeTimeWindow?: number;
}

export interface UseUndoRedoReturn {
  executeCommand: (command: Command) => Promise<void>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  isExecuting: boolean;
  stackSizes: { undo: number; redo: number };
  clearHistory: () => Promise<void>;
}

export function useUndoRedo(
  selectedDate: Date, 
  options: UseUndoRedoOptions = {}
): UseUndoRedoReturn {
  const { 
    onError, 
    onSuccess, 
    maxHistorySize,
    enableOptimisticUpdates,
    mergeTimeWindow
  } = options;
  
  // Configure undo/redo system if options provided
  useEffect(() => {
    if (enableOptimisticUpdates !== undefined || mergeTimeWindow !== undefined) {
      configureUndoRedo({
        enableOptimisticUpdates,
        mergeTimeWindow
      });
    }
  }, [enableOptimisticUpdates, mergeTimeWindow]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDescription, setUndoDescription] = useState<string | null>(null);
  const [redoDescription, setRedoDescription] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [stackSizes, setStackSizes] = useState({ undo: 0, redo: 0 });
  
  const historyManagerRef = useRef<HistoryManager | null>(null);
  const dateKey = formatDateKey(selectedDate);

  // Initialize history manager for the current date
  useEffect(() => {
    const historyManager = getHistoryManager(dateKey, maxHistorySize);
    historyManagerRef.current = historyManager;

    // Update state from history manager
    const updateState = () => {
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
      setUndoDescription(historyManager.getLastUndoDescription());
      setRedoDescription(historyManager.getLastRedoDescription());
      setStackSizes(historyManager.getStackSizes());
    };

    // Initial state update
    updateState();

    // Listen for history changes
    historyManager.addListener(updateState);

    // Switch to new date if needed
    if (historyManager['currentDateKey'] !== dateKey) {
      historyManager.switchDate(dateKey).then(updateState);
    }

    return () => {
      historyManager.removeListener(updateState);
    };
  }, [dateKey]);

  // Execute a command with error handling
  const executeCommand = useCallback(async (command: Command): Promise<void> => {
    if (!historyManagerRef.current) {
      throw new UndoRedoError('History manager not initialized');
    }
    
    if (isExecuting) {
      throw new UndoRedoError('Cannot execute command while another command is executing');
    }

    setIsExecuting(true);
    try {
      await historyManagerRef.current.executeCommand(command);
    } catch (error) {
      let errorObj: Error;
      
      if (error instanceof UndoRedoError) {
        errorObj = error;
      } else {
        errorObj = error instanceof Error ? error : new Error(String(error));
      }
      
      // Provide more specific error messages for different error types
      if (error instanceof PersistenceError) {
        console.warn('Persistence failed, but command was executed:', error.message);
      } else if (error instanceof CommandExecutionError) {
        console.error('Command execution failed:', error.message);
      }
      
      onError?.(errorObj);
      throw errorObj;
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, onError]);

  // Undo last command
  const undo = useCallback(async (): Promise<boolean> => {
    if (!historyManagerRef.current || isExecuting || !canUndo) return false;

    setIsExecuting(true);
    try {
      const success = await historyManagerRef.current.undo();
      if (success) {
        onSuccess?.('undo');
      }
      return success;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, canUndo, onError, onSuccess]);

  // Redo last undone command
  const redo = useCallback(async (): Promise<boolean> => {
    if (!historyManagerRef.current || isExecuting || !canRedo) return false;

    setIsExecuting(true);
    try {
      const success = await historyManagerRef.current.redo();
      if (success) {
        onSuccess?.('redo');
      }
      return success;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, canRedo, onError, onSuccess]);

  // Clear all history for current date
  const clearHistory = useCallback(async (): Promise<void> => {
    if (!historyManagerRef.current || isExecuting) return;

    setIsExecuting(true);
    try {
      await historyManagerRef.current.clearHistory();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
    } finally {
      setIsExecuting(false);
    }
  }, [isExecuting, onError]);

  return {
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    isExecuting,
    stackSizes,
    clearHistory
  };
}

// Hook for keyboard shortcuts
export function useUndoRedoKeyboard(undoRedoHook: UseUndoRedoReturn, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Only handle shortcuts when not in input elements unless specifically overridden
      const target = event.target as HTMLElement;
      const isInEditableElement = (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      );
      
      // Skip if in editable element and not specifically allowing
      if (isInEditableElement && !event.altKey) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifierPressed = isMac ? event.metaKey : event.ctrlKey;

      if (!isModifierPressed) return;

      try {
        if (event.key === 'z' || event.key === 'Z') {
          if (event.shiftKey) {
            // Ctrl/Cmd + Shift + Z = Redo
            event.preventDefault();
            if (undoRedoHook.canRedo) {
              await undoRedoHook.redo();
            }
          } else {
            // Ctrl/Cmd + Z = Undo
            event.preventDefault();
            if (undoRedoHook.canUndo) {
              await undoRedoHook.undo();
            }
          }
        } else if (event.key === 'y' || event.key === 'Y') {
          // Ctrl/Cmd + Y = Redo (alternative)
          event.preventDefault();
          if (undoRedoHook.canRedo) {
            await undoRedoHook.redo();
          }
        }
      } catch (error) {
        // Errors are already handled by the undo/redo hooks
        console.debug('Keyboard shortcut error:', error);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undoRedoHook, enabled]);
}

// Hook for error notifications with better error categorization
export function useUndoRedoNotifications() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleError = useCallback((error: Error) => {
    if (error instanceof PersistenceError) {
      // For persistence errors, show warning instead of error since the action succeeded
      setWarning('Action completed but could not be saved. Changes may be lost on page reload.');
      setTimeout(() => setWarning(null), 7000);
    } else if (error instanceof CommandExecutionError) {
      setError(`Failed to ${error.message.includes('undo') ? 'undo' : error.message.includes('redo') ? 'redo' : 'execute'} action`);
      setTimeout(() => setError(null), 5000);
    } else {
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  const handleSuccess = useCallback((action: 'undo' | 'redo') => {
    setSuccess(action === 'undo' ? 'Action undone' : 'Action redone');
    // Clear after 2 seconds
    setTimeout(() => setSuccess(null), 2000);
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearSuccess = useCallback(() => setSuccess(null), []);
  const clearWarning = useCallback(() => setWarning(null), []);

  return {
    error,
    success,
    warning,
    handleError,
    handleSuccess,
    clearError,
    clearSuccess,
    clearWarning
  };
}