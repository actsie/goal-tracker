import { openDB, type IDBPDatabase } from 'idb';
import { getDayData, type DayData, type Note, type ChecklistItem } from './db';

export interface SearchResult {
  id: string;
  type: 'note' | 'checklist';
  content: string;
  date: string;
  score: number;
  highlights: { start: number; end: number }[];
  noteId?: string;
  checklistId?: string;
}

export interface SearchIndex {
  id: string;
  type: 'note' | 'checklist';
  content: string;
  date: string;
  noteId?: string;
  checklistId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SEARCH_DB_NAME = 'goal-tracker-search';
const SEARCH_DB_VERSION = 1;
const MAX_RESULTS = 50;

let searchDbInstance: IDBPDatabase | null = null;
let isSearchIndexAvailable = true;
let fallbackSearchIndex: SearchIndex[] = [];

export async function initSearchDB(): Promise<IDBPDatabase | null> {
  try {
    searchDbInstance = await openDB(SEARCH_DB_NAME, SEARCH_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('searchIndex')) {
          const store = db.createObjectStore('searchIndex', {
            keyPath: 'id'
          });
          store.createIndex('type', 'type');
          store.createIndex('date', 'date');
          store.createIndex('content', 'content');
        }
      },
    });
    return searchDbInstance;
  } catch (error) {
    console.warn('Search IndexedDB not available, falling back to in-memory search:', error);
    isSearchIndexAvailable = false;
    return null;
  }
}

export function isSearchDBAvailable(): boolean {
  return isSearchIndexAvailable;
}

export async function addToSearchIndex(item: SearchIndex): Promise<void> {
  if (!isSearchIndexAvailable) {
    const existingIndex = fallbackSearchIndex.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      fallbackSearchIndex[existingIndex] = item;
    } else {
      fallbackSearchIndex.push(item);
    }
    return;
  }

  try {
    if (!searchDbInstance) {
      await initSearchDB();
    }
    
    if (!searchDbInstance) {
      const existingIndex = fallbackSearchIndex.findIndex(i => i.id === item.id);
      if (existingIndex >= 0) {
        fallbackSearchIndex[existingIndex] = item;
      } else {
        fallbackSearchIndex.push(item);
      }
      return;
    }
    
    await searchDbInstance.put('searchIndex', item);
  } catch (error) {
    console.error('Error adding to search index:', error);
    const existingIndex = fallbackSearchIndex.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      fallbackSearchIndex[existingIndex] = item;
    } else {
      fallbackSearchIndex.push(item);
    }
  }
}

export async function removeFromSearchIndex(id: string): Promise<void> {
  if (!isSearchIndexAvailable) {
    fallbackSearchIndex = fallbackSearchIndex.filter(i => i.id !== id);
    return;
  }

  try {
    if (!searchDbInstance) {
      await initSearchDB();
    }
    
    if (!searchDbInstance) {
      fallbackSearchIndex = fallbackSearchIndex.filter(i => i.id !== id);
      return;
    }
    
    await searchDbInstance.delete('searchIndex', id);
  } catch (error) {
    console.error('Error removing from search index:', error);
    fallbackSearchIndex = fallbackSearchIndex.filter(i => i.id !== id);
  }
}

export async function rebuildSearchIndex(): Promise<void> {
  try {
    if (!searchDbInstance && isSearchIndexAvailable) {
      await initSearchDB();
    }

    if (isSearchIndexAvailable && searchDbInstance) {
      await searchDbInstance.clear('searchIndex');
    } else {
      fallbackSearchIndex = [];
    }

    const dates = await getAllDatesWithData();
    for (const date of dates) {
      const dayData = await getDayData(date);
      if (dayData) {
        await indexDayData(dayData);
      }
    }
  } catch (error) {
    console.error('Error rebuilding search index:', error);
  }
}

export async function indexDayData(dayData: DayData): Promise<void> {
  for (const note of dayData.notes) {
    await indexNote(dayData.date, note);
  }
  
  for (const item of dayData.checklist) {
    await indexChecklistItem(dayData.date, item);
  }
}

export async function indexNote(date: string, note: Note): Promise<void> {
  const searchItem: SearchIndex = {
    id: `note-${note.id}`,
    type: 'note',
    content: note.content,
    date,
    noteId: note.id,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
  
  await addToSearchIndex(searchItem);
}

export async function indexChecklistItem(date: string, item: ChecklistItem): Promise<void> {
  const searchItem: SearchIndex = {
    id: `checklist-${item.id}`,
    type: 'checklist',
    content: item.text,
    date,
    checklistId: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
  
  await addToSearchIndex(searchItem);
}

function calculateFuzzyScore(query: string, content: string): number {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Exact match gets highest score
  if (contentLower.includes(queryLower)) {
    const position = contentLower.indexOf(queryLower);
    // Earlier matches score higher
    return 100 - (position / contentLower.length) * 20;
  }
  
  // Fuzzy matching based on character overlap
  let score = 0;
  let queryIndex = 0;
  
  for (let i = 0; i < contentLower.length && queryIndex < queryLower.length; i++) {
    if (contentLower[i] === queryLower[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }
  
  // Score based on how many query characters were found
  const matchRatio = queryIndex / queryLower.length;
  return matchRatio * 80; // Max 80 for fuzzy matches
}

function findHighlights(query: string, content: string): { start: number; end: number }[] {
  const highlights: { start: number; end: number }[] = [];
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  let startIndex = 0;
  while (true) {
    const index = contentLower.indexOf(queryLower, startIndex);
    if (index === -1) break;
    
    highlights.push({
      start: index,
      end: index + query.length
    });
    
    startIndex = index + 1;
  }
  
  return highlights;
}

export async function searchContent(query: string, limit: number = MAX_RESULTS): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const trimmedQuery = query.trim();
  let searchItems: SearchIndex[] = [];

  if (!isSearchIndexAvailable) {
    searchItems = fallbackSearchIndex;
  } else {
    try {
      if (!searchDbInstance) {
        await initSearchDB();
      }
      
      if (!searchDbInstance) {
        searchItems = fallbackSearchIndex;
      } else {
        searchItems = await searchDbInstance.getAll('searchIndex');
      }
    } catch (error) {
      console.error('Error searching content:', error);
      searchItems = fallbackSearchIndex;
    }
  }

  const results: SearchResult[] = [];
  
  for (const item of searchItems) {
    const score = calculateFuzzyScore(trimmedQuery, item.content);
    
    if (score > 0) {
      const highlights = findHighlights(trimmedQuery, item.content);
      
      results.push({
        id: item.id,
        type: item.type,
        content: item.content,
        date: item.date,
        score,
        highlights,
        noteId: item.noteId,
        checklistId: item.checklistId
      });
    }
  }

  // Sort by score (highest first) then by date (newest first)
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return results.slice(0, limit);
}

async function getAllDatesWithData(): Promise<string[]> {
  // This is a simple implementation - in a real app you might want to track this more efficiently
  const dates: string[] = [];
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const startDate = new Date(now.getFullYear() - 1, 0, 1);
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayData = await getDayData(dateStr);
    if (dayData && (dayData.notes.length > 0 || dayData.checklist.length > 0)) {
      dates.push(dateStr);
    }
  }
  
  return dates;
}