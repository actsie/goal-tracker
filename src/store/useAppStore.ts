import { create } from 'zustand';

interface Goal {
  id: string;
  name: string;
  createdAt: Date;
}

interface AppState {
  selectedDate: Date;
  selectedGoalId: string | null;
  activeTab: 'notebook' | 'analytics' | 'settings';
  goals: Goal[];
  setSelectedDate: (date: Date) => void;
  setSelectedGoalId: (goalId: string | null) => void;
  setActiveTab: (tab: 'notebook' | 'analytics' | 'settings') => void;
  setGoals: (goals: Goal[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedDate: new Date(),
  selectedGoalId: null,
  activeTab: 'notebook',
  goals: [],
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedGoalId: (goalId) => set({ selectedGoalId: goalId }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setGoals: (goals) => set({ goals }),
}));