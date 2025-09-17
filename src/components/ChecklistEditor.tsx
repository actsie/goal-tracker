import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Plus, X, GripVertical, AlertCircle, Loader2, CheckCircle, CalendarDays } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { 
  getDayData, 
  trimEmptyChecklistItems,
  carryOverUncompletedItems,
  type ChecklistItem as DbChecklistItem 
} from '../lib/db';
import { settingsService } from '../lib/settingsService';
import { cn } from '../lib/utils';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useUndoRedo, useUndoRedoKeyboard, useUndoRedoNotifications } from '../hooks/useUndoRedo';
import { 
  AddChecklistItemCommand, 
  EditChecklistItemCommand, 
  ToggleChecklistItemCommand,
  DeleteChecklistItemCommand,
  ReorderChecklistCommand 
} from '../lib/commands';
import { UndoRedoControls } from './UndoRedoControls';
import { formatDateKey } from '../lib/date-utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';

interface ChecklistEditorProps {
  selectedDate: Date;
  onDataChange?: () => void;
}

export interface ChecklistEditorRef {
  focusItem: (itemId: string) => void;
}

interface SortableItemProps {
  item: DbChecklistItem;
  isEditing: boolean;
  editingText: string;
  onToggle: (id: string) => void;
  onStartEdit: (item: DbChecklistItem) => void;
  onSaveEdit: () => void;
  onEditTextChange: (text: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onDelete: (id: string) => void;
  onFocusNext: () => void;
  isSaving: boolean;
  error: string | null;
  editInputRef?: (el: HTMLInputElement | null) => void;
}

function SortableItem({
  item,
  isEditing,
  editingText,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onEditTextChange,
  onEditKeyDown,
  onDelete,
  onFocusNext,
  isSaving,
  error,
  editInputRef
}: SortableItemProps) {
  const localEditInputRef = useRef<HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && localEditInputRef.current) {
      localEditInputRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isEditing) {
      e.preventDefault();
      onFocusNext();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onToggle(item.id);
    } else if (e.key === 'ArrowUp' && (e.altKey || e.ctrlKey)) {
      e.preventDefault();
      // Will be handled by parent component
    } else if (e.key === 'ArrowDown' && (e.altKey || e.ctrlKey)) {
      e.preventDefault();
      // Will be handled by parent component
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
        item.completed && "bg-muted/50",
        isDragging && "opacity-50 z-50",
        error && "border-red-500 bg-red-50"
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-label={`Checklist item: ${item.text}${item.completed ? ', completed' : ', not completed'}`}
      data-item-id={item.id}
    >
      {/* Drag handle */}
      <div 
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Checkbox */}
      <Checkbox
        checked={item.completed}
        onCheckedChange={() => onToggle(item.id)}
        className="flex-shrink-0"
        aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
      />

      {/* Item text */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isEditing ? (
          <Input
            ref={(el) => {
              localEditInputRef.current = el;
              if (editInputRef) {
                editInputRef(el);
              }
            }}
            value={editingText}
            onChange={(e) => onEditTextChange(e.target.value)}
            onKeyDown={onEditKeyDown}
            onBlur={onSaveEdit}
            className="h-8 text-sm"
            aria-label="Edit checklist item text"
          />
        ) : (
          <>
            <span
              onClick={() => onStartEdit(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onStartEdit(item);
                }
              }}
              className={cn(
                "cursor-pointer hover:text-foreground transition-colors block",
                item.completed && "line-through text-muted-foreground"
              )}
              tabIndex={0}
              role="button"
              aria-label="Click to edit text"
            >
              {item.text}
            </span>
            {item.originalDate && item.originalDate !== formatDateKey(new Date()) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CalendarDays className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>From {new Date(item.originalDate).toLocaleDateString()}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex items-center space-x-2">
        {isSaving && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving..." />
        )}
        {error && (
          <AlertCircle className="h-4 w-4 text-red-500" aria-label={`Error: ${error}`} />
        )}
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(item.id)}
        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Delete item"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export const ChecklistEditor = forwardRef<ChecklistEditorRef, ChecklistEditorProps>(({ selectedDate, onDataChange }, ref) => {
  const [items, setItems] = useState<DbChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [originalEditingText, setOriginalEditingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingItems] = useState<Set<string>>(new Set());
  const [itemErrors, setItemErrors] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [carriedOverCount, setCarriedOverCount] = useState(0);
  const [showCarryOverNotification, setShowCarryOverNotification] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  
  const dateKey = formatDateKey(selectedDate);
  const isToday = dateKey === formatDateKey(new Date());
  
  // Undo/Redo functionality
  const undoRedoNotifications = useUndoRedoNotifications();
  const undoRedo = useUndoRedo(selectedDate, {
    onError: undoRedoNotifications.handleError,
    onSuccess: undoRedoNotifications.handleSuccess,
    maxHistorySize: 150, // Slightly larger for checklist operations
    enableOptimisticUpdates: true,
    mergeTimeWindow: 800 // Shorter merge window for checklist edits
  });
  
  // Enable keyboard shortcuts
  useUndoRedoKeyboard(undoRedo);

  useImperativeHandle(ref, () => ({
    focusItem: (itemId: string) => {
      const input = itemInputRefs.current.get(itemId);
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }), []);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Debounced autosave function
  const debouncedAutosave = useDebouncedCallback(async () => {
    try {
      setIsSaving(true);
      await trimEmptyChecklistItems(dateKey);
      onDataChange?.();
    } catch (error) {
      console.error('Autosave failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  useEffect(() => {
    loadItems();
  }, [selectedDate]);

  // Trigger autosave when items change
  useEffect(() => {
    if (items.length > 0) {
      debouncedAutosave();
    }
  }, [items, debouncedAutosave]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const dayData = await getDayData(dateKey);
      setItems(dayData?.checklist || []);
      setItemErrors(new Map());
      
      // Check if we should carry over unchecked items
      if (isToday) {
        const settings = await settingsService.getSettings();
        if (settings.carryOverUncheckedItems) {
          const carriedItems = await carryOverUncompletedItems(dateKey, settings.carryOverMaxDays);
          
          if (carriedItems.length > 0) {
            // Reload items to show carried over items
            const updatedDayData = await getDayData(dateKey);
            setItems(updatedDayData?.checklist || []);
            setCarriedOverCount(carriedItems.length);
            setShowCarryOverNotification(true);
            
            // Hide notification after 5 seconds
            setTimeout(() => {
              setShowCarryOverNotification(false);
            }, 5000);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load checklist items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewItemKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newItemText.trim()) {
      e.preventDefault();
      await addItem(newItemText.trim());
    }
  };

  const addItem = async (text: string) => {
    if (!text.trim()) return;

    try {
      setNewItemText('');
      const command = new AddChecklistItemCommand(dateKey, text.trim(), (newItem) => {
        setItems(prev => [...prev, newItem]);
        onDataChange?.();
        
        // Focus back to input for quick adding
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      });
      
      await undoRedo.executeCommand(command);
    } catch (error) {
      console.error('Failed to add item:', error);
      setItemErrors(prev => new Map([...prev, [text, 'Failed to save item']]));
    }
  };

  const toggleItem = async (itemId: string) => {
    try {
      const command = new ToggleChecklistItemCommand(dateKey, itemId, () => {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, completed: !item.completed } : item
        ));
        onDataChange?.();
      });
      
      await undoRedo.executeCommand(command);
    } catch (error) {
      console.error('Failed to toggle item:', error);
      setItemErrors(prev => new Map([...prev, [itemId, 'Failed to toggle item']]));
    }
  };

  const startEditing = (item: DbChecklistItem) => {
    setEditingItemId(item.id);
    setEditingText(item.text);
    setOriginalEditingText(item.text);
  };

  const saveEdit = async () => {
    if (!editingItemId || !editingText.trim()) {
      cancelEdit();
      return;
    }

    try {
      // Only create command if text actually changed
      if (editingText.trim() !== originalEditingText) {
        const command = new EditChecklistItemCommand(
          dateKey,
          editingItemId,
          originalEditingText,
          editingText.trim(),
          () => {
            setItems(prev => prev.map(item => 
              item.id === editingItemId ? { ...item, text: editingText.trim() } : item
            ));
            onDataChange?.();
          }
        );
        
        await undoRedo.executeCommand(command);
      }
      
      setEditingItemId(null);
      setEditingText('');
      setOriginalEditingText('');
    } catch (error) {
      console.error('Failed to update item:', error);
      setItemErrors(prev => new Map([...prev, [editingItemId, 'Failed to save changes']]));
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditingText('');
    setOriginalEditingText('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const command = new DeleteChecklistItemCommand(
        dateKey,
        itemId,
        () => {
          setItems(prev => prev.filter(item => item.id !== itemId));
          if (editingItemId === itemId) {
            setEditingItemId(null);
            setEditingText('');
            setOriginalEditingText('');
          }
          onDataChange?.();
        },
        (restoredItem) => {
          setItems(prev => [...prev, restoredItem].sort((a, b) => a.order - b.order));
          onDataChange?.();
        }
      );
      
      await undoRedo.executeCommand(command);
    } catch (error) {
      console.error('Failed to delete item:', error);
      setItemErrors(prev => new Map([...prev, [itemId, 'Failed to delete item']]));
    }
  };

  // Drag and drop handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    try {
      const newItems = arrayMove(items, oldIndex, newIndex);
      const newOrder = newItems.map(item => item.id);
      
      const command = new ReorderChecklistCommand(
        dateKey,
        newOrder,
        () => {
          setItems(newItems);
          onDataChange?.();
        }
      );
      
      await undoRedo.executeCommand(command);
    } catch (error) {
      console.error('Failed to reorder items:', error);
      setItemErrors(prev => new Map([...prev, ['reorder', 'Failed to reorder items']]));
    }
  };

  // Enhanced keyboard shortcuts
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Don't handle shortcuts when editing
    if (editingItemId) return;
    
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      // Toggle the focused item if any
      const activeElement = document.activeElement;
      if (activeElement?.hasAttribute('data-item-id')) {
        const itemId = activeElement.getAttribute('data-item-id');
        if (itemId) {
          toggleItem(itemId);
        }
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingItemId]);

  // Enhanced "- " conversion with immediate conversion
  const handleNewItemInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // If user types "- " at the beginning, immediately convert to checklist item
    if (value === '- ') {
      setNewItemText('');
      // Focus stays in input for immediate typing
      return;
    }
    
    // If user has typed "- " followed by content, convert it
    if (value.startsWith('- ') && value.length > 2) {
      const text = value.substring(2);
      setNewItemText('');
      if (text.trim()) {
        addItem(text.trim());
      }
    } else {
      setNewItemText(value);
    }
  };

  // Focus next new item input when Enter is pressed on item
  const handleFocusNext = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Retry failed operations
  const retryOperation = async (itemId: string) => {
    const error = itemErrors.get(itemId);
    if (!error) return;
    
    setItemErrors(prev => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
    
    // Retry based on the error type - for now just reload
    await loadItems();
  };

  return (
    <div className="space-y-4">
      {/* Carryover Notification */}
      {showCarryOverNotification && carriedOverCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                {carriedOverCount} unchecked {carriedOverCount === 1 ? 'item' : 'items'} carried over from previous days
              </span>
            </div>
            <Button 
              onClick={() => setShowCarryOverNotification(false)} 
              size="sm" 
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Undo/Redo Notifications */}
      {undoRedoNotifications.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{undoRedoNotifications.error}</span>
            </div>
            <Button onClick={undoRedoNotifications.clearError} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {undoRedoNotifications.warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">{undoRedoNotifications.warning}</span>
            </div>
            <Button onClick={undoRedoNotifications.clearWarning} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {undoRedoNotifications.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-800">{undoRedoNotifications.success}</span>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Checklist</h3>
        <div className="flex items-center gap-3">
          {(isSaving || savingItems.size > 0) && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          <UndoRedoControls undoRedo={undoRedo} size="sm" />
        </div>
      </div>
      
      {/* New item input */}
      <div className="flex items-center space-x-2">
        <Input
          ref={inputRef}
          value={newItemText}
          onChange={handleNewItemInput}
          onKeyDown={handleNewItemKeyDown}
          placeholder="Type '- ' to start a checklist item or just type to add..."
          className="flex-1"
          aria-label="Add new checklist item"
        />
        <Button
          onClick={() => addItem(newItemText)}
          disabled={!newItemText.trim()}
          size="sm"
          aria-label="Add new item"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-4 text-muted-foreground">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Loading items...</p>
          </div>
        </div>
      )}

      {/* Error notification for general errors */}
      {itemErrors.has('reorder') && (
        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">{itemErrors.get('reorder')}</span>
          </div>
          <Button
            variant="ghost" 
            size="sm"
            onClick={() => retryOperation('reorder')}
            className="text-red-700 hover:text-red-800"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Sortable Items list */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={items.map(item => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2" role="list" aria-label="Checklist items">
            {items.map(item => (
              <SortableItem
                key={item.id}
                item={item}
                isEditing={editingItemId === item.id}
                editingText={editingText}
                onToggle={toggleItem}
                onStartEdit={startEditing}
                onSaveEdit={saveEdit}
                onEditTextChange={setEditingText}
                onEditKeyDown={handleEditKeyDown}
                onDelete={removeItem}
                onFocusNext={handleFocusNext}
                isSaving={savingItems.has(item.id)}
                error={itemErrors.get(item.id) || null}
                editInputRef={(el) => {
                  if (el) {
                    itemInputRefs.current.set(item.id, el);
                  } else {
                    itemInputRefs.current.delete(item.id);
                  }
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          <p>No checklist items yet</p>
          <p className="text-sm mt-1">Type above to add your first item</p>
          <p className="text-xs mt-2">💡 Tip: Type "- " to quickly create checklist items</p>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      <div className="text-xs text-muted-foreground space-y-1 mt-4 p-3 bg-muted/50 rounded" role="region" aria-label="Keyboard shortcuts">
        <p><strong>Keyboard shortcuts:</strong></p>
        <p>• Type "- " → Quick checklist item creation</p>
        <p>• Enter → Add new item / Create new item below</p>
        <p>• Click text → Edit item inline</p>
        <p>• Cmd/Ctrl + Enter → Toggle completion</p>
        <p>• Drag handle → Reorder items</p>
        <p>• Escape → Cancel editing</p>
        <p>• Cmd/Ctrl + Z → Undo last action</p>
        <p>• Cmd/Ctrl + Shift + Z → Redo last undone action</p>
        <p>• Cmd/Ctrl + Y → Redo (alternative)</p>
      </div>
    </div>
  );
});