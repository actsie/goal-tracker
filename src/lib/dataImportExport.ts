import { openDB } from 'idb';
import { db as goalsDB } from './database';
import type { ExportData, ExportDayData, ExportGoal, ValidationError } from './exportSchema';
import { CURRENT_SCHEMA_VERSION, validateExportSchema } from './exportSchema';
import type { DayData } from './db';
import type { Goal } from './database';

export interface ImportSummary {
  dayData: {
    new: number;
    overwritten: number;
    unchanged: number;
    examples: {
      new: ExportDayData[];
      overwritten: ExportDayData[];
      unchanged: ExportDayData[];
    };
  };
  goals: {
    new: number;
    overwritten: number;
    unchanged: number;
    examples: {
      new: ExportGoal[];
      overwritten: ExportGoal[];
      unchanged: ExportGoal[];
    };
  };
  totalRecords: number;
  validationErrors: ValidationError[];
  incompatibleRecords: any[];
}

export interface ImportProgress {
  phase: 'validating' | 'analyzing' | 'importing';
  completed: number;
  total: number;
  message: string;
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

const DB_NAME = 'goal-tracker';

export async function exportAllData(): Promise<ExportData> {
  const exportTimestamp = new Date().toISOString();
  
  // Export day data
  const dayDataExport = await exportDayData();
  
  // Export goals
  const goalsExport = await exportGoals();
  
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportTimestamp,
    dayData: dayDataExport,
    goals: goalsExport
  };
}

async function exportDayData(): Promise<ExportDayData[]> {
  const db = await openDB(DB_NAME, 1);
  
  try {
    const allDayData = await db.getAll('dayData');
    
    return allDayData.map(dayData => ({
      date: dayData.date,
      notes: dayData.notes.map((note: any) => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString()
      })),
      checklist: dayData.checklist.map((item: any) => ({
        id: item.id,
        text: item.text,
        completed: item.completed,
        order: item.order,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      })),
      createdAt: dayData.createdAt.toISOString(),
      updatedAt: dayData.updatedAt.toISOString()
    }));
  } finally {
    db.close();
  }
}

async function exportGoals(): Promise<ExportGoal[]> {
  const goals = await goalsDB.goals.toArray();
  
  return goals.map(goal => ({
    id: goal.id,
    name: goal.name,
    createdAt: goal.createdAt.toISOString()
  }));
}

export function downloadExportFile(data: ExportData, filename?: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `goal-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export async function analyzeImport(importData: ExportData): Promise<ImportSummary> {
  const validationErrors = validateExportSchema(importData);
  const incompatibleRecords: any[] = [];
  
  // Analyze day data changes
  const dayDataAnalysis = await analyzeDayDataChanges(importData.dayData);
  
  // Analyze goals changes
  const goalsAnalysis = await analyzeGoalsChanges(importData.goals);
  
  const totalRecords = importData.dayData.length + importData.goals.length;
  
  return {
    dayData: dayDataAnalysis,
    goals: goalsAnalysis,
    totalRecords,
    validationErrors,
    incompatibleRecords
  };
}

async function analyzeDayDataChanges(importDayData: ExportDayData[]) {
  const db = await openDB(DB_NAME, 1);
  
  try {
    const analysis = {
      new: 0,
      overwritten: 0,
      unchanged: 0,
      examples: {
        new: [] as ExportDayData[],
        overwritten: [] as ExportDayData[],
        unchanged: [] as ExportDayData[]
      }
    };
    
    for (const dayData of importDayData) {
      const existing = await db.get('dayData', dayData.date);
      
      if (!existing) {
        analysis.new++;
        if (analysis.examples.new.length < 3) {
          analysis.examples.new.push(dayData);
        }
      } else {
        const isChanged = hasDataChanged(existing, dayData);
        if (isChanged) {
          analysis.overwritten++;
          if (analysis.examples.overwritten.length < 3) {
            analysis.examples.overwritten.push(dayData);
          }
        } else {
          analysis.unchanged++;
          if (analysis.examples.unchanged.length < 3) {
            analysis.examples.unchanged.push(dayData);
          }
        }
      }
    }
    
    return analysis;
  } finally {
    db.close();
  }
}

async function analyzeGoalsChanges(importGoals: ExportGoal[]) {
  const existingGoals = await goalsDB.goals.toArray();
  const existingGoalsMap = new Map(existingGoals.map(g => [g.id, g]));
  
  const analysis = {
    new: 0,
    overwritten: 0,
    unchanged: 0,
    examples: {
      new: [] as ExportGoal[],
      overwritten: [] as ExportGoal[],
      unchanged: [] as ExportGoal[]
    }
  };
  
  for (const goal of importGoals) {
    const existing = existingGoalsMap.get(goal.id);
    
    if (!existing) {
      analysis.new++;
      if (analysis.examples.new.length < 3) {
        analysis.examples.new.push(goal);
      }
    } else {
      const isChanged = existing.name !== goal.name || 
                      existing.createdAt.toISOString() !== goal.createdAt;
      if (isChanged) {
        analysis.overwritten++;
        if (analysis.examples.overwritten.length < 3) {
          analysis.examples.overwritten.push(goal);
        }
      } else {
        analysis.unchanged++;
        if (analysis.examples.unchanged.length < 3) {
          analysis.examples.unchanged.push(goal);
        }
      }
    }
  }
  
  return analysis;
}

function hasDataChanged(existing: DayData, importData: ExportDayData): boolean {
  // Compare notes
  if (existing.notes.length !== importData.notes.length) return true;
  
  const existingNotesMap = new Map(existing.notes.map(n => [n.id, n]));
  for (const importNote of importData.notes) {
    const existingNote = existingNotesMap.get(importNote.id);
    if (!existingNote || 
        existingNote.content !== importNote.content ||
        existingNote.updatedAt.toISOString() !== importNote.updatedAt) {
      return true;
    }
  }
  
  // Compare checklist
  if (existing.checklist.length !== importData.checklist.length) return true;
  
  const existingChecklistMap = new Map(existing.checklist.map(c => [c.id, c]));
  for (const importItem of importData.checklist) {
    const existingItem = existingChecklistMap.get(importItem.id);
    if (!existingItem ||
        existingItem.text !== importItem.text ||
        existingItem.completed !== importItem.completed ||
        existingItem.order !== importItem.order ||
        existingItem.updatedAt.toISOString() !== importItem.updatedAt) {
      return true;
    }
  }
  
  return false;
}

export async function performImport(
  importData: ExportData, 
  onProgress?: ImportProgressCallback
): Promise<void> {
  // Validate first
  onProgress?.({
    phase: 'validating',
    completed: 0,
    total: 100,
    message: 'Validating import data...'
  });
  
  const validationErrors = validateExportSchema(importData);
  const criticalErrors = validationErrors.filter(e => e.type === 'error');
  
  if (criticalErrors.length > 0) {
    throw new Error(`Validation failed: ${criticalErrors.map(e => e.message).join(', ')}`);
  }
  
  onProgress?.({
    phase: 'validating',
    completed: 100,
    total: 100,
    message: 'Validation complete'
  });
  
  // Perform import in single atomic transaction
  const totalItems = importData.dayData.length + importData.goals.length;
  
  try {
    onProgress?.({
      phase: 'importing',
      completed: 0,
      total: totalItems,
      message: 'Starting atomic import...'
    });
    
    await performAtomicImport(importData, onProgress);
    
    // Clear analytics cache after successful import
    const { analyticsService } = await import('./analyticsService');
    analyticsService.clearCache();
    
    // Trigger data change events for UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dayDataChanged'));
      window.dispatchEvent(new CustomEvent('goalsChanged'));
    }
    
    onProgress?.({
      phase: 'importing',
      completed: totalItems,
      total: totalItems,
      message: 'Import complete! Analytics recalculated.'
    });
    
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function performAtomicImport(
  importData: ExportData,
  onProgress?: ImportProgressCallback
): Promise<void> {
  const totalItems = importData.dayData.length + importData.goals.length;
  let completed = 0;
  
  // Open IndexedDB connections for atomic transaction
  const dayDataDB = await openDB(DB_NAME, 1);
  
  try {
    // Start coordinated transaction for day data
    const dayDataTx = dayDataDB.transaction('dayData', 'readwrite');
    const dayDataStore = dayDataTx.objectStore('dayData');
    
    // Import day data
    onProgress?.({
      phase: 'importing',
      completed,
      total: totalItems,
      message: 'Importing day data...'
    });
    
    for (let i = 0; i < importData.dayData.length; i++) {
      const dayData = importData.dayData[i];
      
      // Convert to internal format
      const internalDayData: DayData = {
        date: dayData.date,
        notes: dayData.notes.map(note => ({
          id: note.id,
          content: note.content,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt)
        })),
        checklist: dayData.checklist.map(item => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
          order: item.order,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt)
        })),
        createdAt: new Date(dayData.createdAt),
        updatedAt: new Date(dayData.updatedAt)
      };
      
      await dayDataStore.put(internalDayData);
      completed++;
      
      onProgress?.({
        phase: 'importing',
        completed,
        total: totalItems,
        message: `Importing day data... (${completed}/${totalItems})`
      });
    }
    
    // Wait for day data transaction to complete
    await dayDataTx.done;
    
    // Import goals using Dexie transaction
    onProgress?.({
      phase: 'importing',
      completed,
      total: totalItems,
      message: 'Importing goals...'
    });
    
    await goalsDB.transaction('rw', goalsDB.goals, async () => {
      for (let i = 0; i < importData.goals.length; i++) {
        const goal = importData.goals[i];
        
        // Convert to internal format
        const internalGoal: Goal = {
          id: goal.id,
          name: goal.name,
          createdAt: new Date(goal.createdAt)
        };
        
        await goalsDB.goals.put(internalGoal);
        completed++;
        
        onProgress?.({
          phase: 'importing',
          completed,
          total: totalItems,
          message: `Importing goals... (${completed}/${totalItems})`
        });
      }
    });
    
  } finally {
    dayDataDB.close();
  }
}

