export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  order: number;
  entryId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Entry {
  id: string;
  date: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Goal {
  id: string;
  name: string;
  createdAt: Date;
}