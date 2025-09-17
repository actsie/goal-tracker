import Dexie, { type Table } from 'dexie';

export interface Goal {
  id: string;
  name: string;
  createdAt: Date;
}

const database = new Dexie('GoalTrackerDB') as Dexie & {
  goals: Table<Goal, 'id'>;
};

database.version(1).stores({
  goals: 'id, name, createdAt'
});

export const db = database;

// Initialize defaults
export async function initializeDefaults() {
  const goalCount = await db.goals.count();
  if (goalCount === 0) {
    await db.goals.add({
      id: crypto.randomUUID(),
      name: 'Default Goal',
      createdAt: new Date()
    });
  }
}