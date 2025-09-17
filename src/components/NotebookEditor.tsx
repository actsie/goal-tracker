import { useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { formatDateKey } from '@/lib/date-utils';
import { NotesEditor } from './NotesEditor';
import { ChecklistEditor } from './ChecklistEditor';

interface NotebookEditorProps {
  selectedDate: Date;
  goalId?: string;
}

export interface NotebookEditorRef {
  openNote: (noteId?: string) => void;
  openChecklistItem: (checklistId: string) => void;
}

export const NotebookEditor = forwardRef<NotebookEditorRef, NotebookEditorProps>(({ selectedDate, goalId }, ref) => {
  const dateKey = formatDateKey(selectedDate);
  const notesEditorRef = useRef<{ focusNote: (noteId?: string) => void } | null>(null);
  const checklistEditorRef = useRef<{ focusItem: (itemId: string) => void } | null>(null);

  const handleDataChange = useCallback(() => {
    // Force update of calendar indicators
    // This could trigger a custom event or state update
    window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date: dateKey } }));
  }, [dateKey]);

  useImperativeHandle(ref, () => ({
    openNote: (noteId?: string) => {
      if (notesEditorRef.current) {
        notesEditorRef.current.focusNote(noteId);
      }
    },
    openChecklistItem: (checklistId: string) => {
      if (checklistEditorRef.current) {
        checklistEditorRef.current.focusItem(checklistId);
      }
    }
  }), []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">
          {selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </h2>
        {goalId && (
          <p className="text-sm text-muted-foreground mt-1">
            Goal ID: {goalId}
          </p>
        )}
      </div>
      
      <div className="flex-1 overflow-auto p-6 space-y-8">
        <NotesEditor 
          ref={notesEditorRef}
          selectedDate={selectedDate} 
          onDataChange={handleDataChange}
        />
        
        <div className="border-t pt-8">
          <ChecklistEditor 
            ref={checklistEditorRef}
            selectedDate={selectedDate}
            onDataChange={handleDataChange} 
          />
        </div>
      </div>
    </div>
  );
});