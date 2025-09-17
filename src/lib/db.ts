import { openDB, type IDBPDatabase } from 'idb';
import { indexNote, indexChecklistItem, removeFromSearchIndex } from './searchService';
import { formatDateKeyWithTimezone } from './date-utils';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  originalDate?: string; // YYYY-MM-DD format - the date when item was originally created
}

export interface Note {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DayData {
  date: string; // YYYY-MM-DD format
  notes: Note[];
  checklist: ChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const DB_NAME = 'goal-tracker';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;
let isIndexedDBAvailable = true;
let fallbackStorage: Map<string, DayData> = new Map();

export async function initDB(): Promise<IDBPDatabase | null> {
  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create dayData store
        if (!db.objectStoreNames.contains('dayData')) {
          const dayDataStore = db.createObjectStore('dayData', {
            keyPath: 'date'
          });
          dayDataStore.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
    return dbInstance;
  } catch (error) {
    console.warn('IndexedDB not available, falling back to in-memory storage:', error);
    isIndexedDBAvailable = false;
    return null;
  }
}

export function isDBAvailable(): boolean {
  return isIndexedDBAvailable;
}

export async function getDayData(date: string): Promise<DayData | null> {
  if (!isIndexedDBAvailable) {
    const data = fallbackStorage.get(date) || null;
    if (data) {
      // Ensure checklist is sorted by order and has order field
      data.checklist = data.checklist.map((item: any, index: number) => ({
        ...item,
        order: item.order ?? index
      })).sort((a: ChecklistItem, b: ChecklistItem) => a.order - b.order);
    }
    return data;
  }

  try {
    if (!dbInstance) {
      await initDB();
    }
    
    if (!dbInstance) return null;
    
    const data = await dbInstance.get('dayData', date);
    if (data) {
      // Ensure checklist is sorted by order and has order field
      data.checklist = data.checklist.map((item: any, index: number) => ({
        ...item,
        order: item.order ?? index
      })).sort((a: ChecklistItem, b: ChecklistItem) => a.order - b.order);
    }
    return data || null;
  } catch (error) {
    console.error('Error getting day data:', error);
    const data = fallbackStorage.get(date) || null;
    if (data) {
      // Ensure checklist is sorted by order and has order field
      data.checklist = data.checklist.map((item: any, index: number) => ({
        ...item,
        order: item.order ?? index
      })).sort((a: ChecklistItem, b: ChecklistItem) => a.order - b.order);
    }
    return data;
  }
}

export async function saveDayData(dayData: DayData): Promise<void> {
  dayData.updatedAt = new Date();
  
  if (!isIndexedDBAvailable) {
    fallbackStorage.set(dayData.date, { ...dayData });
    return;
  }

  try {
    if (!dbInstance) {
      await initDB();
    }
    
    if (!dbInstance) {
      fallbackStorage.set(dayData.date, { ...dayData });
      return;
    }
    
    await dbInstance.put('dayData', dayData);
  } catch (error) {
    console.error('Error saving day data:', error);
    fallbackStorage.set(dayData.date, { ...dayData });
  }
}

export async function createEmptyDayData(date: string): Promise<DayData> {
  const dayData: DayData = {
    date,
    notes: [],
    checklist: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await saveDayData(dayData);
  return dayData;
}

export async function addNote(date: string, content: string): Promise<Note> {
  const dayData = await getDayData(date) || await createEmptyDayData(date);
  
  const note: Note = {
    id: crypto.randomUUID(),
    content,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  dayData.notes.push(note);
  await saveDayData(dayData);
  
  // Update search index
  try {
    await indexNote(date, note);
  } catch (error) {
    console.warn('Failed to update search index for note:', error);
  }
  
  // Dispatch data change event for analytics cache invalidation
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
  }
  
  return note;
}

export async function updateNote(date: string, noteId: string, content: string): Promise<void> {
  const dayData = await getDayData(date);
  if (!dayData) return;
  
  const note = dayData.notes.find(n => n.id === noteId);
  if (note) {
    note.content = content;
    note.updatedAt = new Date();
    await saveDayData(dayData);
    
    // Update search index
    try {
      await indexNote(date, note);
    } catch (error) {
      console.warn('Failed to update search index for note:', error);
    }
    
    // Dispatch data change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
    }
  }
}

export async function deleteNote(date: string, noteId: string): Promise<void> {
  const dayData = await getDayData(date);
  if (!dayData) return;
  
  dayData.notes = dayData.notes.filter(n => n.id !== noteId);
  await saveDayData(dayData);
  
  // Remove from search index
  try {
    await removeFromSearchIndex(`note-${noteId}`);
  } catch (error) {
    console.warn('Failed to remove note from search index:', error);
  }
  
  // Dispatch data change event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
  }
}

export async function addChecklistItem(date: string, text: string): Promise<ChecklistItem> {
  const dayData = await getDayData(date) || await createEmptyDayData(date);
  
  // Calculate next order value
  const maxOrder = dayData.checklist.length > 0 
    ? Math.max(...dayData.checklist.map(item => item.order)) 
    : -1;
  
  const item: ChecklistItem = {
    id: crypto.randomUUID(),
    text,
    completed: false,
    order: maxOrder + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    originalDate: date // Set the original date when item is created
  };
  
  dayData.checklist.push(item);
  // Sort checklist by order
  dayData.checklist.sort((a, b) => a.order - b.order);
  await saveDayData(dayData);
  
  // Update search index
  try {
    await indexChecklistItem(date, item);
  } catch (error) {
    console.warn('Failed to update search index for checklist item:', error);
  }
  
  // Dispatch data change event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
  }
  
  return item;
}

export async function updateChecklistItem(date: string, itemId: string, updates: Partial<Pick<ChecklistItem, 'text' | 'completed'>>): Promise<void> {
  const dayData = await getDayData(date);
  if (!dayData) return;
  
  const item = dayData.checklist.find(i => i.id === itemId);
  if (item) {
    Object.assign(item, updates);
    item.updatedAt = new Date();
    await saveDayData(dayData);
    
    // Update search index
    try {
      await indexChecklistItem(date, item);
    } catch (error) {
      console.warn('Failed to update search index for checklist item:', error);
    }
    
    // Dispatch data change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
    }
  }
}

export async function reorderChecklistItems(date: string, itemIds: string[]): Promise<void> {
  const dayData = await getDayData(date);
  if (!dayData) return;
  
  // Create a map of current items
  const itemMap = new Map(dayData.checklist.map(item => [item.id, item]));
  
  // Reorder items based on the provided order
  const reorderedItems: ChecklistItem[] = [];
  itemIds.forEach((id, index) => {
    const item = itemMap.get(id);
    if (item) {
      item.order = index;
      item.updatedAt = new Date();
      reorderedItems.push(item);
    }
  });
  
  dayData.checklist = reorderedItems;
  await saveDayData(dayData);
  
  // Dispatch data change event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
  }
}

export async function deleteChecklistItem(date: string, itemId: string): Promise<void> {
  const dayData = await getDayData(date);
  if (!dayData) return;
  
  dayData.checklist = dayData.checklist.filter(i => i.id !== itemId);
  await saveDayData(dayData);
  
  // Remove from search index
  try {
    await removeFromSearchIndex(`checklist-${itemId}`);
  } catch (error) {
    console.warn('Failed to remove checklist item from search index:', error);
  }
  
  // Dispatch data change event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
  }
}

export async function trimEmptyChecklistItems(date: string): Promise<void> {
  const dayData = await getDayData(date);
  if (!dayData) return;
  
  const originalLength = dayData.checklist.length;
  dayData.checklist = dayData.checklist.filter(item => item.text.trim() !== '');
  
  if (dayData.checklist.length !== originalLength) {
    await saveDayData(dayData);
    
    // Dispatch data change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date } }));
    }
  }
}

export async function getCompletionPercentage(date: string): Promise<number> {
  const dayData = await getDayData(date);
  if (!dayData || dayData.checklist.length === 0) return 0;
  
  const completed = dayData.checklist.filter(item => item.completed).length;
  return Math.round((completed / dayData.checklist.length) * 100);
}

export async function hasDataForDate(date: string): Promise<boolean> {
  const dayData = await getDayData(date);
  return !!(dayData && (dayData.notes.length > 0 || dayData.checklist.length > 0));
}

// Timezone-aware data operations
export async function getCurrentDateData(): Promise<DayData | null> {
  try {
    const dateKey = await formatDateKeyWithTimezone(new Date());
    return await getDayData(dateKey);
  } catch (error) {
    console.error('Error getting current date data:', error);
    // Fallback to local date
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0];
    return await getDayData(dateKey);
  }
}

export async function createTodayData(): Promise<DayData> {
  try {
    const dateKey = await formatDateKeyWithTimezone(new Date());
    return await createEmptyDayData(dateKey);
  } catch (error) {
    console.error('Error creating today data:', error);
    // Fallback to local date
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0];
    return await createEmptyDayData(dateKey);
  }
}

// Get data for a specific date in user's timezone
export async function getDateDataInTimezone(date: Date): Promise<DayData | null> {
  try {
    const dateKey = await formatDateKeyWithTimezone(date);
    return await getDayData(dateKey);
  } catch (error) {
    console.error('Error getting date data in timezone:', error);
    // Fallback to local date key
    const dateKey = date.toISOString().split('T')[0];
    return await getDayData(dateKey);
  }
}

// Get all unchecked items from previous days
export async function getUncompletedItemsBeforeDate(beforeDate: string): Promise<{ date: string; items: ChecklistItem[] }[]> {
  if (!isIndexedDBAvailable) {
    // For in-memory storage, get all dates before the given date
    const result: { date: string; items: ChecklistItem[] }[] = [];
    for (const [date, dayData] of fallbackStorage.entries()) {
      if (date < beforeDate && dayData.checklist.length > 0) {
        const uncheckedItems = dayData.checklist.filter(item => !item.completed);
        if (uncheckedItems.length > 0) {
          result.push({ date, items: uncheckedItems });
        }
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
  }

  try {
    if (!dbInstance) {
      await initDB();
    }
    
    if (!dbInstance) return [];
    
    const result: { date: string; items: ChecklistItem[] }[] = [];
    const tx = dbInstance.transaction('dayData', 'readonly');
    const store = tx.objectStore('dayData');
    
    // Get all day data
    const allData = await store.getAll();
    
    for (const dayData of allData) {
      if (dayData.date < beforeDate && dayData.checklist && dayData.checklist.length > 0) {
        const uncheckedItems = dayData.checklist.filter((item: ChecklistItem) => !item.completed);
        if (uncheckedItems.length > 0) {
          result.push({ date: dayData.date, items: uncheckedItems });
        }
      }
    }
    
    return result.sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
  } catch (error) {
    console.error('Error getting uncompleted items:', error);
    return [];
  }
}

// Carry over unchecked items to a specific date
export async function carryOverUncompletedItems(targetDate: string, maxDaysBack: number = 30): Promise<ChecklistItem[]> {
  const cutoffDate = new Date(targetDate);
  cutoffDate.setDate(cutoffDate.getDate() - maxDaysBack);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  const uncheckedData = await getUncompletedItemsBeforeDate(targetDate);
  const carriedOverItems: ChecklistItem[] = [];
  
  // Get or create target day data
  const targetDayData = await getDayData(targetDate) || await createEmptyDayData(targetDate);
  
  // Track which items are already carried over to avoid duplicates
  const existingOriginalDates = new Set(
    targetDayData.checklist
      .filter(item => item.originalDate)
      .map(item => `${item.originalDate}-${item.text}`)
  );
  
  for (const { date, items } of uncheckedData) {
    // Skip items older than cutoff
    if (date < cutoffDateStr) continue;
    
    for (const item of items) {
      // Skip if already carried over
      const itemKey = `${item.originalDate || date}-${item.text}`;
      if (existingOriginalDates.has(itemKey)) continue;
      
      // Create carried over item
      const maxOrder = targetDayData.checklist.length > 0 
        ? Math.max(...targetDayData.checklist.map(i => i.order)) 
        : -1;
      
      const carriedItem: ChecklistItem = {
        id: crypto.randomUUID(),
        text: item.text,
        completed: false,
        order: maxOrder + 1 + carriedOverItems.length,
        createdAt: new Date(),
        updatedAt: new Date(),
        originalDate: item.originalDate || date // Preserve original date or use the date it was found
      };
      
      carriedOverItems.push(carriedItem);
    }
  }
  
  if (carriedOverItems.length > 0) {
    targetDayData.checklist.push(...carriedOverItems);
    targetDayData.checklist.sort((a, b) => a.order - b.order);
    await saveDayData(targetDayData);
    
    // Update search index for new items
    for (const item of carriedOverItems) {
      try {
        await indexChecklistItem(targetDate, item);
      } catch (error) {
        console.warn('Failed to index carried over item:', error);
      }
    }
    
    // Dispatch data change event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dayDataChanged', { detail: { date: targetDate } }));
    }
  }
  
  return carriedOverItems;
}