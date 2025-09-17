import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Plus, X, Save, AlertCircle, RefreshCw, Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDateKey } from '@/lib/date-utils';
import { getDayData, updateNote, type Note, isDBAvailable } from '@/lib/db';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { useUndoRedo, useUndoRedoKeyboard, useUndoRedoNotifications } from '@/hooks/useUndoRedo';
import { AddNoteCommand, EditNoteCommand, DeleteNoteCommand } from '@/lib/commands';
import { UndoRedoControls } from './UndoRedoControls';

type PeriodType = 'daily' | 'weekly' | 'monthly';
type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

interface NotesEditorProps {
  selectedDate: Date;
  onDataChange: () => void;
}

export interface NotesEditorRef {
  focusNote: (noteId?: string) => void;
}

interface DayNotesPreview {
  date: Date;
  dateKey: string;
  notes: Note[];
  hasContent: boolean;
}

export const NotesEditor = forwardRef<NotesEditorRef, NotesEditorProps>(({ selectedDate, onDataChange }, ref) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<DayNotesPreview[]>([]);
  const [focusedDay, setFocusedDay] = useState<Date>(selectedDate);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [originalEditContent, setOriginalEditContent] = useState('');

  // Undo/Redo functionality
  const undoRedoNotifications = useUndoRedoNotifications();
  const undoRedo = useUndoRedo(focusedDay, {
    onError: undoRedoNotifications.handleError,
    onSuccess: undoRedoNotifications.handleSuccess,
    maxHistorySize: 100, // Configurable history size
    enableOptimisticUpdates: true,
    mergeTimeWindow: 1000 // 1 second merge window for text edits
  });
  
  // Enable keyboard shortcuts
  useUndoRedoKeyboard(undoRedo);

  const dateKey = formatDateKey(focusedDay);

  useImperativeHandle(ref, () => ({
    focusNote: (noteId?: string) => {
      if (noteId) {
        const textarea = textareaRefs.current.get(noteId);
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (notes.length > 0) {
        // Focus first note if no specific note ID provided
        const firstNoteTextarea = textareaRefs.current.get(notes[0].id);
        if (firstNoteTextarea) {
          firstNoteTextarea.focus();
          firstNoteTextarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }), [notes]);

  // Debounced autosave function
  const debouncedSave = useDebouncedCallback(async (content: string, noteId: string) => {
    if (!noteId) return;
    
    setSaveStatus('saving');
    setError(null);

    try {
      await updateNote(dateKey, noteId, content);
      
      // Update local state
      setNotes(prev => prev.map(note => 
        note.id === noteId 
          ? { ...note, content: content, updatedAt: new Date() }
          : note
      ));
      
      setSaveStatus('saved');
      onDataChange();
      
      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveStatus('error');
      setError('Failed to save. Your changes may be lost.');
    }
  }, 1000);

  // Load notes for focused day
  useEffect(() => {
    loadNotes();
  }, [focusedDay]);

  // Update period days when selectedDate or periodType changes
  useEffect(() => {
    updatePeriodDays();
  }, [selectedDate, periodType]);

  // Set focused day when selectedDate changes
  useEffect(() => {
    setFocusedDay(selectedDate);
  }, [selectedDate]);

  const loadNotes = async () => {
    try {
      setError(null);
      const dayData = await getDayData(dateKey);
      setNotes(dayData?.notes || []);
    } catch (err) {
      console.error('Failed to load notes:', err);
      setError('Failed to load notes. Please try refreshing.');
    }
  };

  const updatePeriodDays = async () => {
    let startDate: Date;
    let endDate: Date;

    switch (periodType) {
      case 'weekly':
        startDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
        endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
        break;
      case 'monthly':
        startDate = startOfMonth(selectedDate);
        endDate = endOfMonth(selectedDate);
        break;
      default:
        startDate = selectedDate;
        endDate = selectedDate;
        break;
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Load preview data for each day
    const dayPreviews: DayNotesPreview[] = await Promise.all(
      days.map(async (date) => {
        const key = formatDateKey(date);
        const dayData = await getDayData(key);
        return {
          date,
          dateKey: key,
          notes: dayData?.notes || [],
          hasContent: (dayData?.notes?.length || 0) > 0
        };
      })
    );

    setPeriodDays(dayPreviews);
  };

  const handleAddNote = async () => {
    try {
      setError(null);
      setSaveStatus('saving');
      
      const command = new AddNoteCommand(dateKey, '', (newNote) => {
        setNotes(prev => [...prev, newNote]);
        setEditingId(newNote.id);
        setEditContent('');
        setOriginalEditContent('');
        onDataChange();
        updatePeriodDays();
      });
      
      await undoRedo.executeCommand(command);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to add note:', err);
      setSaveStatus('error');
      setError('Failed to create note. Please try again.');
    }
  };

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setOriginalEditContent(note.content);
    setSaveStatus('idle');
    setError(null);
  };

  const handleContentChange = (content: string) => {
    setEditContent(content);
    if (editingId) {
      debouncedSave(content, editingId);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      setError(null);
      setSaveStatus('saving');
      
      if (editContent.trim()) {
        // Only create command if content actually changed
        if (editContent.trim() !== originalEditContent) {
          const command = new EditNoteCommand(
            dateKey,
            editingId,
            originalEditContent,
            editContent.trim(),
            () => {
              setNotes(prev => prev.map(note => 
                note.id === editingId 
                  ? { ...note, content: editContent.trim(), updatedAt: new Date() }
                  : note
              ));
              onDataChange();
              updatePeriodDays();
            }
          );
          
          await undoRedo.executeCommand(command);
        }
      } else {
        await handleDeleteNote(editingId);
      }
      
      setEditingId(null);
      setEditContent('');
      setOriginalEditContent('');
      setSaveStatus('saved');
      
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save note:', err);
      setSaveStatus('error');
      setError('Failed to save note. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setOriginalEditContent('');
    setSaveStatus('idle');
    setError(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      setError(null);
      setSaveStatus('saving');
      
      const command = new DeleteNoteCommand(
        dateKey,
        noteId,
        () => {
          setNotes(prev => prev.filter(note => note.id !== noteId));
          if (editingId === noteId) {
            setEditingId(null);
            setEditContent('');
            setOriginalEditContent('');
          }
          onDataChange();
          updatePeriodDays();
        },
        (restoredNote) => {
          setNotes(prev => [...prev, restoredNote]);
          onDataChange();
          updatePeriodDays();
        }
      );
      
      await undoRedo.executeCommand(command);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to delete note:', err);
      setSaveStatus('error');
      setError('Failed to delete note. Please try again.');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  };

  const handleRetry = () => {
    setError(null);
    setSaveStatus('idle');
    loadNotes();
    updatePeriodDays();
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    let newDate: Date;
    
    switch (periodType) {
      case 'weekly':
        newDate = direction === 'prev' ? subDays(selectedDate, 7) : addDays(selectedDate, 7);
        break;
      case 'monthly':
        newDate = direction === 'prev' 
          ? new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, selectedDate.getDate())
          : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, selectedDate.getDate());
        break;
      default:
        newDate = direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
        break;
    }
    
    setFocusedDay(newDate);
  };

  const getPeriodTitle = () => {
    switch (periodType) {
      case 'weekly':
        const weekStart = startOfWeek(focusedDay, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(focusedDay, { weekStartsOn: 1 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'monthly':
        return format(focusedDay, 'MMMM yyyy');
      default:
        return format(focusedDay, 'EEEE, MMMM d, yyyy');
    }
  };

  const SaveStatusIndicator = () => {
    if (saveStatus === 'idle') return null;
    
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm",
        saveStatus === 'saving' && "text-blue-600",
        saveStatus === 'saved' && "text-green-600", 
        saveStatus === 'error' && "text-red-600"
      )}>
        {saveStatus === 'saving' && <Clock className="h-4 w-4 animate-pulse" />}
        {saveStatus === 'saved' && <CheckCircle className="h-4 w-4" />}
        {saveStatus === 'error' && <AlertCircle className="h-4 w-4" />}
        
        <span>
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      </div>
    );
  };

  const ErrorBanner = () => {
    if (!error) return null;
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRetry} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button onClick={() => setError(null)} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {!isDBAvailable() && (
          <p className="text-xs text-red-700 mt-2">
            Using temporary storage. Data may be lost on page reload.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <ErrorBanner />
      
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
      
      {/* Period Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Notes</h3>
          
          {/* Period Toggle */}
          <div className="flex bg-muted rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setPeriodType(type)}
                className={cn(
                  "px-3 py-1 text-sm rounded-md transition-colors capitalize",
                  periodType === type 
                    ? "bg-background shadow-sm" 
                    : "hover:bg-background/50"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SaveStatusIndicator />
          
          {/* Undo/Redo Controls */}
          <UndoRedoControls undoRedo={undoRedo} size="sm" />
          
          <div className="flex items-center gap-1">
            <Button onClick={() => navigatePeriod('prev')} size="sm" variant="outline">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <span className="text-sm font-medium px-3">
              {getPeriodTitle()}
            </span>
            
            <Button onClick={() => navigatePeriod('next')} size="sm" variant="outline">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Period View (Weekly/Monthly) */}
      {periodType !== 'daily' && periodDays.length > 1 && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="text-sm font-medium mb-3">Days in {periodType.slice(0, -2)}</h4>
          <div className="grid gap-2 max-h-40 overflow-y-auto">
            {periodDays.map((day) => (
              <button
                key={day.dateKey}
                onClick={() => setFocusedDay(day.date)}
                className={cn(
                  "text-left p-2 rounded-md border transition-colors",
                  day.dateKey === dateKey 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:bg-muted"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {format(day.date, 'EEE, MMM d')}
                  </span>
                  {day.hasContent && (
                    <div className="text-xs text-muted-foreground">
                      {day.notes.length} note{day.notes.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                {day.hasContent && day.notes[0] && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {day.notes[0].content.slice(0, 60)}...
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Note Button */}
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium">
          {periodType === 'daily' ? 'Today\'s Notes' : `Notes for ${format(focusedDay, 'MMM d')}`}
        </h4>
        <Button onClick={handleAddNote} size="sm" disabled={saveStatus === 'saving'}>
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="border rounded-lg p-3">
            {editingId === note.id ? (
              <div className="space-y-2">
                <Textarea
                  ref={(el) => {
                    if (el) {
                      textareaRefs.current.set(note.id, el);
                    } else {
                      textareaRefs.current.delete(note.id);
                    }
                  }}
                  value={editContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your note..."
                  className="min-h-[100px] resize-none"
                  autoFocus
                  disabled={saveStatus === 'saving'}
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveEdit} 
                    size="sm" 
                    disabled={saveStatus === 'saving'}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button 
                    onClick={handleCancelEdit} 
                    variant="outline" 
                    size="sm"
                    disabled={saveStatus === 'saving'}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Ctrl+Enter to save, Esc to cancel • Autosaves after 1s
                </p>
              </div>
            ) : (
              <div className="group">
                <div className="flex items-start justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleStartEdit(note)}
                  >
                    {note.content ? (
                      <div className="whitespace-pre-wrap text-sm">
                        {note.content}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm italic">
                        Click to add content...
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={saveStatus === 'saving'}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {note.updatedAt && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Last updated: {new Date(note.updatedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {notes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notes for this date.</p>
            <p className="text-sm">Click "Add Note" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
});