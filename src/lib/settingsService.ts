import { openDB, type IDBPDatabase } from 'idb';

export interface AppSettings {
  timezone: string;
  weekStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
  carryOverUncheckedItems: boolean; // Whether to carry over unchecked items to today
  carryOverMaxDays: number; // Maximum days back to look for unchecked items
  createdAt: Date;
  updatedAt: Date;
}

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

const SETTINGS_DB_NAME = 'goal-tracker-settings';
const SETTINGS_DB_VERSION = 1;
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'app-settings';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  weekStartDay: 1, // Monday
  carryOverUncheckedItems: true, // Default to enabled
  carryOverMaxDays: 7, // Look back 7 days by default
  createdAt: new Date(),
  updatedAt: new Date()
};

let dbInstance: IDBPDatabase | null = null;
let isIndexedDBAvailable = true;
let fallbackSettings: AppSettings = { ...DEFAULT_SETTINGS };

// Common timezone options
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time (New York)', offset: '-05:00/-04:00' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)', offset: '-06:00/-05:00' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)', offset: '-07:00/-06:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)', offset: '-08:00/-07:00' },
  { value: 'America/Toronto', label: 'Eastern Time (Toronto)', offset: '-05:00/-04:00' },
  { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)', offset: '-08:00/-07:00' },
  { value: 'Europe/London', label: 'British Time (London)', offset: '+00:00/+01:00' },
  { value: 'Europe/Paris', label: 'Central European Time (Paris)', offset: '+01:00/+02:00' },
  { value: 'Europe/Berlin', label: 'Central European Time (Berlin)', offset: '+01:00/+02:00' },
  { value: 'Europe/Rome', label: 'Central European Time (Rome)', offset: '+01:00/+02:00' },
  { value: 'Europe/Madrid', label: 'Central European Time (Madrid)', offset: '+01:00/+02:00' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (Tokyo)', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (Shanghai)', offset: '+08:00' },
  { value: 'Asia/Seoul', label: 'Korea Standard Time (Seoul)', offset: '+09:00' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time', offset: '+08:00' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Standard Time', offset: '+08:00' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (Kolkata)', offset: '+05:30' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (Dubai)', offset: '+04:00' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (Sydney)', offset: '+10:00/+11:00' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (Melbourne)', offset: '+10:00/+11:00' },
  { value: 'Australia/Perth', label: 'Australian Western Time (Perth)', offset: '+08:00' },
  { value: 'Pacific/Auckland', label: 'New Zealand Standard Time (Auckland)', offset: '+12:00/+13:00' }
];

export const WEEK_START_OPTIONS = [
  { value: 0 as const, label: 'Sunday' },
  { value: 1 as const, label: 'Monday' }
];

class SettingsService {
  private settingsCache: AppSettings | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async initializeDB(): Promise<IDBPDatabase | null> {
    try {
      dbInstance = await openDB(SETTINGS_DB_NAME, SETTINGS_DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
            db.createObjectStore(SETTINGS_STORE);
          }
        },
      });
      return dbInstance;
    } catch (error) {
      console.warn('Settings IndexedDB not available, falling back to memory storage:', error);
      isIndexedDBAvailable = false;
      return null;
    }
  }

  async getSettings(): Promise<AppSettings> {
    // Check cache first
    if (this.settingsCache && Date.now() < this.cacheExpiry) {
      return this.settingsCache;
    }

    if (!isIndexedDBAvailable) {
      this.cacheSettings(fallbackSettings);
      return fallbackSettings;
    }

    try {
      if (!dbInstance) {
        await this.initializeDB();
      }

      if (!dbInstance) {
        this.cacheSettings(fallbackSettings);
        return fallbackSettings;
      }

      const settings = await dbInstance.get(SETTINGS_STORE, SETTINGS_KEY);
      // Merge with defaults to handle missing fields
      const result = settings ? {
        ...DEFAULT_SETTINGS,
        ...settings,
        // Ensure new fields have defaults if missing
        carryOverUncheckedItems: settings.carryOverUncheckedItems ?? DEFAULT_SETTINGS.carryOverUncheckedItems,
        carryOverMaxDays: settings.carryOverMaxDays ?? DEFAULT_SETTINGS.carryOverMaxDays
      } : DEFAULT_SETTINGS;
      
      this.cacheSettings(result);
      return result;
    } catch (error) {
      console.error('Error getting settings:', error);
      this.cacheSettings(fallbackSettings);
      return fallbackSettings;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const currentSettings = await this.getSettings();
    const updatedSettings: AppSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date()
    };

    if (!isIndexedDBAvailable) {
      fallbackSettings = updatedSettings;
      this.cacheSettings(updatedSettings);
      this.notifySettingsChanged(updatedSettings);
      return updatedSettings;
    }

    try {
      if (!dbInstance) {
        await this.initializeDB();
      }

      if (!dbInstance) {
        fallbackSettings = updatedSettings;
        this.cacheSettings(updatedSettings);
        this.notifySettingsChanged(updatedSettings);
        return updatedSettings;
      }

      await dbInstance.put(SETTINGS_STORE, updatedSettings, SETTINGS_KEY);
      this.cacheSettings(updatedSettings);
      this.notifySettingsChanged(updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error('Failed to save settings. Please check your browser storage permissions and try again.');
    }
  }

  async resetToDefaults(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.saveSettings(defaultSettings);
  }

  private cacheSettings(settings: AppSettings): void {
    this.settingsCache = settings;
    this.cacheExpiry = Date.now() + this.CACHE_DURATION;
  }

  clearCache(): void {
    this.settingsCache = null;
    this.cacheExpiry = 0;
  }

  private notifySettingsChanged(settings: AppSettings): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settingsChanged', {
        detail: settings
      }));
    }
  }

  isAvailable(): boolean {
    return isIndexedDBAvailable;
  }

  // Utility functions for timezone handling
  getTimezoneOption(timezone: string): TimezoneOption | null {
    return TIMEZONE_OPTIONS.find(option => option.value === timezone) || null;
  }

  // Get current timezone offset in minutes
  getTimezoneOffset(timezone: string, date: Date = new Date()): number {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
    } catch (error) {
      console.warn('Error calculating timezone offset:', error);
      return 0;
    }
  }

  // Convert date to timezone-aware date string (YYYY-MM-DD)
  formatDateInTimezone(date: Date, timezone: string): string {
    try {
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return tzDate.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Error formatting date in timezone:', error);
      return date.toISOString().split('T')[0];
    }
  }

  // Get start of day in a specific timezone
  getStartOfDayInTimezone(date: Date, timezone: string): Date {
    try {
      const dateStr = this.formatDateInTimezone(date, timezone);
      return new Date(`${dateStr}T00:00:00.000`);
    } catch (error) {
      console.warn('Error getting start of day in timezone:', error);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
  }

  // Get end of day in a specific timezone
  getEndOfDayInTimezone(date: Date, timezone: string): Date {
    try {
      const dateStr = this.formatDateInTimezone(date, timezone);
      return new Date(`${dateStr}T23:59:59.999`);
    } catch (error) {
      console.warn('Error getting end of day in timezone:', error);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      endOfDay.setHours(23, 59, 59, 999);
      return endOfDay;
    }
  }

  // Validate timezone string
  isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}

export const settingsService = new SettingsService();