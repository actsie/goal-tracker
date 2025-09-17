import { subDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { getDayData, isDBAvailable } from './db';
import { formatDateKey, formatDateKeyWithTimezone } from './date-utils';
import { settingsService } from './settingsService';

export interface DayAnalytics {
  date: string;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  hasData: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  streakStart: string | null;
  streakEnd: string | null;
}

export interface PeriodAnalytics {
  completionRate: number;
  totalDays: number;
  activeDays: number;
  totalTasks: number;
  completedTasks: number;
  streakInfo: StreakInfo;
}

export interface RollingAverages {
  sevenDay: number;
  thirtyDay: number;
  ninetyDay: number;
}

class AnalyticsService {
  private cache = new Map<string, DayAnalytics>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private settingsListenerSetup = false;

  constructor() {
    this.setupSettingsListener();
  }

  private setupSettingsListener(): void {
    if (this.settingsListenerSetup || typeof window === 'undefined') return;
    
    window.addEventListener('settingsChanged', () => {
      this.clearCacheOnSettingsChange();
    });
    
    this.settingsListenerSetup = true;
  }

  async getDayAnalytics(date: Date): Promise<DayAnalytics> {
    let dateKey: string;
    
    try {
      // Use timezone-aware date key
      dateKey = await formatDateKeyWithTimezone(date);
    } catch (error) {
      console.warn('Failed to get timezone-aware date key, falling back:', error);
      dateKey = formatDateKey(date);
    }
    
    // Check cache first
    const cached = this.getCachedAnalytics(dateKey);
    if (cached) {
      return cached;
    }

    try {
      const dayData = await getDayData(dateKey);
      const analytics: DayAnalytics = {
        date: dateKey,
        completionRate: 0,
        totalTasks: 0,
        completedTasks: 0,
        hasData: false
      };

      if (dayData?.checklist && dayData.checklist.length > 0) {
        analytics.totalTasks = dayData.checklist.length;
        analytics.completedTasks = dayData.checklist.filter(item => item.completed).length;
        analytics.completionRate = Math.round((analytics.completedTasks / analytics.totalTasks) * 100);
        analytics.hasData = true;
      }

      if (dayData?.notes && dayData.notes.length > 0) {
        analytics.hasData = true;
      }

      // Cache the result
      this.setCachedAnalytics(dateKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error getting day analytics:', error);
      return {
        date: dateKey,
        completionRate: 0,
        totalTasks: 0,
        completedTasks: 0,
        hasData: false
      };
    }
  }

  async getMonthAnalytics(month: Date): Promise<DayAnalytics[]> {
    try {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Get days in timezone-aware manner
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      const analytics = await Promise.all(
        days.map(day => this.getDayAnalytics(day))
      );

      return analytics;
    } catch (error) {
      console.error('Error getting month analytics:', error);
      // Fallback to basic month calculation
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      const analytics = await Promise.all(
        days.map(day => this.getDayAnalytics(day))
      );

      return analytics;
    }
  }

  async getPeriodAnalytics(startDate: Date, endDate: Date): Promise<PeriodAnalytics> {
    try {
      const settings = await settingsService.getSettings();
      
      // Convert dates to user timezone boundaries
      const tzStartDate = settingsService.getStartOfDayInTimezone(startDate, settings.timezone);
      const tzEndDate = settingsService.getEndOfDayInTimezone(endDate, settings.timezone);
      
      const days = eachDayOfInterval({ start: tzStartDate, end: tzEndDate });
      const dayAnalytics = await Promise.all(
        days.map(day => this.getDayAnalytics(day))
      );

      const activeDays = dayAnalytics.filter(day => day.hasData);
      const totalTasks = activeDays.reduce((sum, day) => sum + day.totalTasks, 0);
      const completedTasks = activeDays.reduce((sum, day) => sum + day.completedTasks, 0);

      let completionRate = 0;
      if (totalTasks > 0) {
        completionRate = Math.round((completedTasks / totalTasks) * 100);
      }

      const streakInfo = this.calculateStreak(dayAnalytics);

      return {
        completionRate,
        totalDays: days.length,
        activeDays: activeDays.length,
        totalTasks,
        completedTasks,
        streakInfo
      };
    } catch (error) {
      console.error('Error getting period analytics:', error);
      // Fallback to non-timezone-aware calculation
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const dayAnalytics = await Promise.all(
        days.map(day => this.getDayAnalytics(day))
      );

      const activeDays = dayAnalytics.filter(day => day.hasData);
      const totalTasks = activeDays.reduce((sum, day) => sum + day.totalTasks, 0);
      const completedTasks = activeDays.reduce((sum, day) => sum + day.completedTasks, 0);

      let completionRate = 0;
      if (totalTasks > 0) {
        completionRate = Math.round((completedTasks / totalTasks) * 100);
      }

      const streakInfo = this.calculateStreak(dayAnalytics);

      return {
        completionRate,
        totalDays: days.length,
        activeDays: activeDays.length,
        totalTasks,
        completedTasks,
        streakInfo
      };
    }
  }

  async getRollingAverages(date: Date): Promise<RollingAverages> {
    try {
      const settings = await settingsService.getSettings();
      
      // Convert to timezone-aware date
      const today = settingsService.getEndOfDayInTimezone(date, settings.timezone);
      
      // Get data for the last 90 days (to calculate all averages)
      const startDate = subDays(today, 89);
      const days = eachDayOfInterval({ start: startDate, end: today });
      
      const dayAnalytics = await Promise.all(
        days.map(day => this.getDayAnalytics(day))
      );

      const sevenDayData = dayAnalytics.slice(-7);
      const thirtyDayData = dayAnalytics.slice(-30);
      const ninetyDayData = dayAnalytics;

      return {
        sevenDay: this.calculateAverageCompletionRate(sevenDayData),
        thirtyDay: this.calculateAverageCompletionRate(thirtyDayData),
        ninetyDay: this.calculateAverageCompletionRate(ninetyDayData)
      };
    } catch (error) {
      console.error('Error getting rolling averages:', error);
      // Fallback to non-timezone-aware calculation
      const today = new Date(date);
      const startDate = subDays(today, 89);
      const days = eachDayOfInterval({ start: startDate, end: today });
      
      const dayAnalytics = await Promise.all(
        days.map(day => this.getDayAnalytics(day))
      );

      const sevenDayData = dayAnalytics.slice(-7);
      const thirtyDayData = dayAnalytics.slice(-30);
      const ninetyDayData = dayAnalytics;

      return {
        sevenDay: this.calculateAverageCompletionRate(sevenDayData),
        thirtyDay: this.calculateAverageCompletionRate(thirtyDayData),
        ninetyDay: this.calculateAverageCompletionRate(ninetyDayData)
      };
    }
  }

  async getSparklineData(date: Date, days: number): Promise<number[]> {
    try {
      const settings = await settingsService.getSettings();
      
      // Convert to timezone-aware dates
      const endDate = settingsService.getEndOfDayInTimezone(date, settings.timezone);
      const startDate = subDays(endDate, days - 1);
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      const dayAnalytics = await Promise.all(
        dateRange.map(day => this.getDayAnalytics(day))
      );

      return dayAnalytics.map(day => day.completionRate);
    } catch (error) {
      console.error('Error getting sparkline data:', error);
      // Fallback to non-timezone-aware calculation
      const endDate = new Date(date);
      const startDate = subDays(endDate, days - 1);
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      const dayAnalytics = await Promise.all(
        dateRange.map(day => this.getDayAnalytics(day))
      );

      return dayAnalytics.map(day => day.completionRate);
    }
  }

  private calculateAverageCompletionRate(dayAnalytics: DayAnalytics[]): number {
    const activeDays = dayAnalytics.filter(day => day.hasData);
    if (activeDays.length === 0) return 0;

    const totalRate = activeDays.reduce((sum, day) => sum + day.completionRate, 0);
    return Math.round(totalRate / activeDays.length);
  }

  private calculateStreak(dayAnalytics: DayAnalytics[]): StreakInfo {
    let currentStreak = 0;
    let longestStreak = 0;
    let streakStart: string | null = null;
    let streakEnd: string | null = null;
    // let tempStreakStart: string | null = null;
    let tempStreak = 0;

    // Calculate streaks based on days with 100% completion or any activity
    for (let i = dayAnalytics.length - 1; i >= 0; i--) {
      const day = dayAnalytics[i];
      const isStreakDay = day.hasData && (day.completionRate === 100 || day.totalTasks === 0);
      
      if (isStreakDay) {
        // if (tempStreak === 0) {
        //   tempStreakStart = day.date;
        // }
        tempStreak++;
        
        // Update current streak (from the end)
        if (i === dayAnalytics.length - 1 || currentStreak > 0) {
          if (currentStreak === 0) {
            streakEnd = day.date;
          }
          currentStreak++;
          if (!streakStart) {
            streakStart = day.date;
          }
        }
      } else {
        // Streak broken
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 0;
        // tempStreakStart = null;
        
        // If we were counting current streak, stop
        if (currentStreak > 0 && i === dayAnalytics.length - 1) {
          currentStreak = 0;
          streakStart = null;
          streakEnd = null;
        }
      }
    }

    // Check if the last streak is the longest
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    return {
      currentStreak,
      longestStreak,
      streakStart,
      streakEnd
    };
  }

  private getCachedAnalytics(dateKey: string): DayAnalytics | null {
    const now = Date.now();
    const expiry = this.cacheExpiry.get(dateKey);
    
    if (expiry && now < expiry) {
      return this.cache.get(dateKey) || null;
    }
    
    // Clean up expired cache
    this.cache.delete(dateKey);
    this.cacheExpiry.delete(dateKey);
    return null;
  }

  private setCachedAnalytics(dateKey: string, analytics: DayAnalytics): void {
    this.cache.set(dateKey, analytics);
    this.cacheExpiry.set(dateKey, Date.now() + this.CACHE_DURATION);
  }

  // Clear cache when data changes
  clearCache(dateKey?: string): void {
    if (dateKey) {
      this.cache.delete(dateKey);
      this.cacheExpiry.delete(dateKey);
    } else {
      this.cache.clear();
      this.cacheExpiry.clear();
    }
  }

  // Clear cache when settings change (timezone affects date keys)
  clearCacheOnSettingsChange(): void {
    this.clearCache();
  }

  // Get week analytics with timezone-aware boundaries
  async getWeekAnalytics(date: Date): Promise<PeriodAnalytics> {
    try {
      const settings = await settingsService.getSettings();
      
      // Get week boundaries based on user preference
      const weekStart = startOfWeek(date, { weekStartsOn: settings.weekStartDay });
      const weekEnd = endOfWeek(date, { weekStartsOn: settings.weekStartDay });
      
      return await this.getPeriodAnalytics(weekStart, weekEnd);
    } catch (error) {
      console.error('Error getting week analytics:', error);
      // Fallback to default week boundaries
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday default
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      
      return await this.getPeriodAnalytics(weekStart, weekEnd);
    }
  }

  // Check if analytics are available
  isAvailable(): boolean {
    return isDBAvailable();
  }

  // Seed test data for demonstration
  async seedTestData(): Promise<void> {
    try {
      const { saveDayData, createEmptyDayData } = await import('./db');
      const { subDays, format } = await import('date-fns');
      
      console.log('Seeding test data for analytics...');
      
      // Create test data for the last 90 days
      const settings = await settingsService.getSettings();
      const today = new Date();
      const testData = [];
      
      for (let i = 89; i >= 0; i--) {
        const date = subDays(today, i);
        let dateKey: string;
        
        try {
          dateKey = settingsService.formatDateInTimezone(date, settings.timezone);
        } catch (error) {
          dateKey = format(date, 'yyyy-MM-dd');
        }
        
        // Skip some days to simulate realistic usage
        if (Math.random() < 0.2) continue; // 20% chance to skip a day
        
        const dayData = await createEmptyDayData(dateKey);
        
        // Add random tasks with varying completion rates
        const taskCount = Math.floor(Math.random() * 8) + 2; // 2-10 tasks
        const completionRate = Math.random();
        
        for (let j = 0; j < taskCount; j++) {
          const taskCompleted = Math.random() < completionRate;
          dayData.checklist.push({
            id: crypto.randomUUID(),
            text: `Task ${j + 1} for ${dateKey}`,
            completed: taskCompleted,
            order: j,
            createdAt: new Date(date),
            updatedAt: new Date(date)
          });
        }
        
        // Add a note occasionally
        if (Math.random() < 0.3) {
          dayData.notes.push({
            id: crypto.randomUUID(),
            content: `Notes for ${dateKey} - reflecting on progress and planning ahead.`,
            createdAt: new Date(date),
            updatedAt: new Date(date)
          });
        }
        
        await saveDayData(dayData);
        testData.push(dayData);
      }
      
      console.log(`Seeded ${testData.length} days of test data`);
      
      // Clear analytics cache to force refresh
      this.clearCache();
      
      // Trigger a data change event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dayDataChanged'));
      }
    } catch (error) {
      console.error('Error seeding test data:', error);
    }
  }
}

export const analyticsService = new AnalyticsService();

// Initialize analytics service settings listener
if (typeof window !== 'undefined') {
  // Ensure the listener is set up when the module loads
  analyticsService;
}