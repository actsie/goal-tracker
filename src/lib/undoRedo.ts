import { openDB, type IDBPDatabase } from 'idb';
import { deserializeCommand } from './commands';

// Command interface for all undoable actions
export interface Command {
  id: string;
  type: string;
  dateKey: string;
  timestamp: Date;
  execute(): Promise<void>;
  undo(): Promise<void>;
  merge?(other: Command): Command | null;
  // Serialization support
  serialize?(): SerializableCommand;
}

// Serializable command data for persistence
export interface SerializableCommand {
  id: string;
  type: string;
  dateKey: string;
  timestamp: string; // ISO string
  data: Record<string, any>; // Command-specific data
}

// History state for persistence
export interface HistoryState {
  undoStack: SerializableCommand[];
  redoStack: SerializableCommand[];
  dateKey: string;
  maxHistorySize: number;
  lastModified: string; // ISO string
}

// Configuration
const HISTORY_DB_NAME = 'goal-tracker-history';
const HISTORY_DB_VERSION = 1;
const DEFAULT_MAX_HISTORY_SIZE = 100;
const MERGE_TIME_WINDOW = 1000; // 1 second

// Error types for better error handling
export class UndoRedoError extends Error {
  public readonly cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'UndoRedoError';
    this.cause = cause;
  }
}

export class PersistenceError extends UndoRedoError {
  constructor(message: string, cause?: Error) {
    super(`Persistence failed: ${message}`, cause);
    this.name = 'PersistenceError';
  }
}

export class CommandExecutionError extends UndoRedoError {
  constructor(message: string, cause?: Error) {
    super(`Command execution failed: ${message}`, cause);
    this.name = 'CommandExecutionError';
  }
}

let historyDbInstance: IDBPDatabase | null = null;
let isHistoryDBAvailable = true;
let fallbackHistoryStorage: Map<string, HistoryState> = new Map();

// Configuration settings
interface UndoRedoConfig {
  maxHistorySize: number;
  enablePersistence: boolean;
  mergeTimeWindow: number;
  enableOptimisticUpdates: boolean;
}

const defaultConfig: UndoRedoConfig = {
  maxHistorySize: DEFAULT_MAX_HISTORY_SIZE,
  enablePersistence: true,
  mergeTimeWindow: MERGE_TIME_WINDOW,
  enableOptimisticUpdates: true
};

let globalConfig = { ...defaultConfig };

// Configuration functions
export function configureUndoRedo(config: Partial<UndoRedoConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getUndoRedoConfig(): UndoRedoConfig {
  return { ...globalConfig };
}

// History manager class
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private currentDateKey: string = '';
  private maxHistorySize: number = DEFAULT_MAX_HISTORY_SIZE;
  private listeners: Set<() => void> = new Set();
  private isExecuting = false;

  constructor(dateKey: string, maxHistorySize = globalConfig.maxHistorySize) {
    this.currentDateKey = dateKey;
    this.maxHistorySize = maxHistorySize;
    this.loadHistory();
  }

  // Initialize history database
  private async initHistoryDB(): Promise<IDBPDatabase | null> {
    try {
      historyDbInstance = await openDB(HISTORY_DB_NAME, HISTORY_DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('history')) {
            const historyStore = db.createObjectStore('history', {
              keyPath: 'dateKey'
            });
            historyStore.createIndex('timestamp', 'timestamp');
          }
        },
      });
      return historyDbInstance;
    } catch (error) {
      console.warn('History IndexedDB not available, falling back to in-memory storage:', error);
      isHistoryDBAvailable = false;
      return null;
    }
  }

  // Load history from persistence
  private async loadHistory(): Promise<void> {
    if (!globalConfig.enablePersistence) {
      console.debug('Persistence disabled - starting with empty history');
      this.undoStack = [];
      this.redoStack = [];
      return;
    }

    try {
      const savedState = await this.getPersistedHistory(this.currentDateKey);
      if (savedState) {
        // Deserialize commands from saved state
        this.undoStack = savedState.undoStack
          .map(cmdData => deserializeCommand(cmdData))
          .filter(Boolean) as Command[];
        
        this.redoStack = savedState.redoStack
          .map(cmdData => deserializeCommand(cmdData))
          .filter(Boolean) as Command[];
        
        console.debug(`Loaded history: ${this.undoStack.length} undo, ${this.redoStack.length} redo commands`);
      } else {
        this.undoStack = [];
        this.redoStack = [];
      }
    } catch (error) {
      console.warn('Failed to load history, starting fresh:', error);
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  // Get persisted history state
  private async getPersistedHistory(dateKey: string): Promise<HistoryState | null> {
    if (!isHistoryDBAvailable) {
      return fallbackHistoryStorage.get(dateKey) || null;
    }

    try {
      if (!historyDbInstance) {
        await this.initHistoryDB();
      }
      
      if (!historyDbInstance) return null;
      
      const data = await historyDbInstance.get('history', dateKey);
      return data || null;
    } catch (error) {
      console.error('Error getting persisted history:', error);
      return fallbackHistoryStorage.get(dateKey) || null;
    }
  }

  // Save history state to persistence
  private async saveHistory(): Promise<void> {
    if (!globalConfig.enablePersistence) {
      return;
    }

    try {
      // Serialize commands properly
      const undoStackSerialized = this.undoStack
        .map(cmd => cmd.serialize?.())
        .filter(Boolean) as SerializableCommand[];
      
      const redoStackSerialized = this.redoStack
        .map(cmd => cmd.serialize?.())
        .filter(Boolean) as SerializableCommand[];

      const state: HistoryState = {
        undoStack: undoStackSerialized,
        redoStack: redoStackSerialized,
        dateKey: this.currentDateKey,
        maxHistorySize: this.maxHistorySize,
        lastModified: new Date().toISOString()
      };

      if (!isHistoryDBAvailable) {
        fallbackHistoryStorage.set(this.currentDateKey, state);
        return;
      }

      if (!historyDbInstance) {
        await this.initHistoryDB();
      }

      if (historyDbInstance) {
        await historyDbInstance.put('history', {
          ...state,
          dateKey: this.currentDateKey
        });
      }
    } catch (error) {
      console.warn('Failed to save history state:', error);
      // Fallback to in-memory storage
      const undoStackSerialized = this.undoStack
        .map(cmd => cmd.serialize?.())
        .filter(Boolean) as SerializableCommand[];
      
      const redoStackSerialized = this.redoStack
        .map(cmd => cmd.serialize?.())
        .filter(Boolean) as SerializableCommand[];

      const state: HistoryState = {
        undoStack: undoStackSerialized,
        redoStack: redoStackSerialized,
        dateKey: this.currentDateKey,
        maxHistorySize: this.maxHistorySize,
        lastModified: new Date().toISOString()
      };
      fallbackHistoryStorage.set(this.currentDateKey, state);
    }
  }

  // Execute command with history tracking and optimistic updates
  async executeCommand(command: Command): Promise<void> {
    if (this.isExecuting) {
      throw new UndoRedoError('Cannot execute command while another command is executing');
    }
    
    this.isExecuting = true;
    let optimisticUpdateApplied = false;
    
    try {
      // Try to merge with the last command if applicable
      const lastCommand = this.undoStack[this.undoStack.length - 1];
      if (lastCommand && command.merge && this.canMergeCommands(lastCommand, command)) {
        const mergedCommand = command.merge(lastCommand);
        if (mergedCommand) {
          // Execute optimistically if enabled
          if (globalConfig.enableOptimisticUpdates) {
            await mergedCommand.execute();
            optimisticUpdateApplied = true;
          }
          
          // Replace last command with merged version
          this.undoStack[this.undoStack.length - 1] = mergedCommand;
          
          // If not optimistic, execute now
          if (!optimisticUpdateApplied) {
            await mergedCommand.execute();
          }
          
          await this.saveHistory();
          this.notifyListeners();
          return;
        }
      }

      // Execute optimistically if enabled
      if (globalConfig.enableOptimisticUpdates) {
        await command.execute();
        optimisticUpdateApplied = true;
      }
      
      // Add to undo stack
      this.undoStack.push(command);
      
      // Clear redo stack since we performed a new action
      this.redoStack = [];
      
      // Trim history if needed
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }
      
      // If not optimistic, execute now
      if (!optimisticUpdateApplied) {
        await command.execute();
      }
      
      // Try to persist
      try {
        await this.saveHistory();
      } catch (persistError) {
        // If persistence fails and we applied optimistically, we need to rollback
        if (optimisticUpdateApplied) {
          try {
            await command.undo();
            // Remove from undo stack
            this.undoStack.pop();
            this.notifyListeners();
          } catch (rollbackError) {
            console.error('Failed to rollback after persistence failure:', rollbackError);
          }
        }
        throw new PersistenceError('Failed to persist command', persistError as Error);
      }
      
      this.notifyListeners();
    } catch (error) {
      // If command execution failed and we haven't done optimistic update yet, that's expected
      if (!optimisticUpdateApplied && error instanceof Error) {
        throw new CommandExecutionError(error.message, error);
      }
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }

  // Check if commands can be merged
  private canMergeCommands(last: Command, current: Command): boolean {
    return (
      last.type === current.type &&
      last.dateKey === current.dateKey &&
      (current.timestamp.getTime() - last.timestamp.getTime()) < globalConfig.mergeTimeWindow
    );
  }

  // Undo last command
  async undo(): Promise<boolean> {
    if (this.undoStack.length === 0 || this.isExecuting) return false;
    
    this.isExecuting = true;
    let optimisticUndoApplied = false;
    
    try {
      const command = this.undoStack.pop()!;
      
      // Apply undo optimistically if enabled
      if (globalConfig.enableOptimisticUpdates) {
        await command.undo();
        optimisticUndoApplied = true;
      }
      
      this.redoStack.push(command);
      
      // If not optimistic, undo now
      if (!optimisticUndoApplied) {
        await command.undo();
      }
      
      // Try to persist
      try {
        await this.saveHistory();
      } catch (persistError) {
        // If persistence fails and we applied optimistically, rollback
        if (optimisticUndoApplied) {
          try {
            await command.execute(); // Re-execute to rollback the undo
            // Restore state
            this.undoStack.push(this.redoStack.pop()!);
            this.notifyListeners();
          } catch (rollbackError) {
            console.error('Failed to rollback undo after persistence failure:', rollbackError);
          }
        }
        throw new PersistenceError('Failed to persist undo', persistError as Error);
      }
      
      this.notifyListeners();
      return true;
    } catch (error) {
      // Put command back if undo failed completely
      if (!optimisticUndoApplied) {
        this.undoStack.push(this.redoStack.pop()!);
      }
      throw new CommandExecutionError('Undo failed', error as Error);
    } finally {
      this.isExecuting = false;
    }
  }

  // Redo last undone command
  async redo(): Promise<boolean> {
    if (this.redoStack.length === 0 || this.isExecuting) return false;
    
    this.isExecuting = true;
    let optimisticRedoApplied = false;
    
    try {
      const command = this.redoStack.pop()!;
      
      // Apply redo optimistically if enabled
      if (globalConfig.enableOptimisticUpdates) {
        await command.execute();
        optimisticRedoApplied = true;
      }
      
      this.undoStack.push(command);
      
      // If not optimistic, execute now
      if (!optimisticRedoApplied) {
        await command.execute();
      }
      
      // Try to persist
      try {
        await this.saveHistory();
      } catch (persistError) {
        // If persistence fails and we applied optimistically, rollback
        if (optimisticRedoApplied) {
          try {
            await command.undo(); // Undo the redo to rollback
            // Restore state
            this.redoStack.push(this.undoStack.pop()!);
            this.notifyListeners();
          } catch (rollbackError) {
            console.error('Failed to rollback redo after persistence failure:', rollbackError);
          }
        }
        throw new PersistenceError('Failed to persist redo', persistError as Error);
      }
      
      this.notifyListeners();
      return true;
    } catch (error) {
      // Put command back if redo failed completely
      if (!optimisticRedoApplied) {
        this.redoStack.push(this.undoStack.pop()!);
      }
      throw new CommandExecutionError('Redo failed', error as Error);
    } finally {
      this.isExecuting = false;
    }
  }

  // Check if undo is available
  canUndo(): boolean {
    return this.undoStack.length > 0 && !this.isExecuting;
  }

  // Check if redo is available  
  canRedo(): boolean {
    return this.redoStack.length > 0 && !this.isExecuting;
  }

  // Get stack sizes for debugging
  getStackSizes(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length
    };
  }

  // Switch to a different date
  async switchDate(dateKey: string): Promise<void> {
    if (this.currentDateKey === dateKey) return;
    
    // Save current history before switching
    await this.saveHistory();
    
    // Reset stacks
    this.undoStack = [];
    this.redoStack = [];
    this.currentDateKey = dateKey;
    
    // Load history for new date
    await this.loadHistory();
    this.notifyListeners();
  }

  // Add listener for history changes
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  // Remove listener
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('History listener error:', error);
      }
    });
  }

  // Clear all history for current date
  async clearHistory(): Promise<void> {
    this.undoStack = [];
    this.redoStack = [];
    await this.saveHistory();
    this.notifyListeners();
  }

  // Get last command description for UI
  getLastUndoDescription(): string | null {
    const lastCommand = this.undoStack[this.undoStack.length - 1];
    return lastCommand ? this.getCommandDescription(lastCommand) : null;
  }

  // Get last redo command description for UI
  getLastRedoDescription(): string | null {
    const lastCommand = this.redoStack[this.redoStack.length - 1];
    return lastCommand ? this.getCommandDescription(lastCommand) : null;
  }

  // Get human-readable command description
  private getCommandDescription(command: Command): string {
    switch (command.type) {
      case 'add-note':
        return 'Add note';
      case 'edit-note':
        return 'Edit note';
      case 'delete-note':
        return 'Delete note';
      case 'add-checklist-item':
        return 'Add checklist item';
      case 'edit-checklist-item':
        return 'Edit checklist item';
      case 'toggle-checklist-item':
        return 'Toggle checklist item';
      case 'delete-checklist-item':
        return 'Delete checklist item';
      case 'reorder-checklist':
        return 'Reorder checklist';
      default:
        return 'Action';
    }
  }
}

// Global history manager instance
let globalHistoryManager: HistoryManager | null = null;

// Get or create history manager for date
export function getHistoryManager(dateKey: string, maxHistorySize?: number): HistoryManager {
  if (!globalHistoryManager || globalHistoryManager['currentDateKey'] !== dateKey) {
    globalHistoryManager = new HistoryManager(dateKey, maxHistorySize);
  }
  return globalHistoryManager;
}

// Export for cleanup
export function resetHistoryManager(): void {
  globalHistoryManager = null;
}