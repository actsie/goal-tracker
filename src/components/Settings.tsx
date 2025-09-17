import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Download, Upload, AlertCircle, CheckCircle2, FileText, Database, Globe, Calendar, RotateCcw, ListChecks } from 'lucide-react';
import { exportAllData, downloadExportFile } from '../lib/dataImportExport';
import { DataImportDialog } from './DataImportDialog';
import { settingsService, TIMEZONE_OPTIONS, WEEK_START_OPTIONS, type AppSettings } from '../lib/settingsService';

export function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isResetting, setIsResetting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    setExportStatus('idle');
    
    try {
      const exportData = await exportAllData();
      downloadExportFile(exportData);
      setExportStatus('success');
      
      // Reset status after 3 seconds
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
      
      // Reset status after 5 seconds
      setTimeout(() => setExportStatus('idle'), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = () => {
    setIsImportDialogOpen(true);
  };

  const handleImportDialogClose = () => {
    setIsImportDialogOpen(false);
  };

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoadingSettings(true);
      const currentSettings = await settingsService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleTimezoneChange = async (timezone: string) => {
    if (!settings) return;
    
    try {
      setIsSavingSettings(true);
      setSaveStatus('idle');
      
      const updatedSettings = await settingsService.saveSettings({ timezone });
      setSettings(updatedSettings);
      setSaveStatus('success');
      
      // Clear success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save timezone:', error);
      setSaveStatus('error');
      
      // Clear error status after 5 seconds
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleWeekStartChange = async (weekStartDay: string) => {
    if (!settings) return;
    
    try {
      setIsSavingSettings(true);
      setSaveStatus('idle');
      
      const weekStart = parseInt(weekStartDay) as 0 | 1;
      const updatedSettings = await settingsService.saveSettings({ weekStartDay: weekStart });
      setSettings(updatedSettings);
      setSaveStatus('success');
      
      // Clear success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save week start day:', error);
      setSaveStatus('error');
      
      // Clear error status after 5 seconds
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetSettings = async () => {
    try {
      setIsResetting(true);
      setSaveStatus('idle');
      
      const defaultSettings = await settingsService.resetToDefaults();
      setSettings(defaultSettings);
      setSaveStatus('success');
      
      // Clear success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setSaveStatus('error');
      
      // Clear error status after 5 seconds
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsResetting(false);
    }
  };

  const getCurrentTimezoneOption = () => {
    if (!settings) return null;
    return settingsService.getTimezoneOption(settings.timezone);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your Goal Tracker preferences and data
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="general" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>General</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Data Management</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Export Data</span>
              </CardTitle>
              <CardDescription>
                Download all your goals, notes, and checklist data as a JSON file for backup or transfer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  The export includes:
                </p>
                <ul className="text-sm space-y-1 ml-4">
                  <li className="flex items-center space-x-2">
                    <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                    <span>All goals with stable IDs and metadata</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                    <span>Daily notes and checklist items</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                    <span>Creation and modification timestamps</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                    <span>Schema version and export timestamp</span>
                  </li>
                </ul>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button 
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>{isExporting ? 'Exporting...' : 'Export Data'}</span>
                </Button>
                
                {exportStatus === 'success' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Export successful!</span>
                  </div>
                )}
                
                {exportStatus === 'error' && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Export failed. Please try again.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Import Data</span>
              </CardTitle>
              <CardDescription>
                Import data from a JSON export file. Preview changes before applying them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Import Behavior: Merge by ID (Overwrite)
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Items with matching IDs will be overwritten with imported data</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                      <span>New items with unique IDs will be added</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                      <span>Existing items not in the import will remain untouched</span>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Import process:
                  </p>
                  <ol className="text-sm space-y-1 ml-4">
                    <li className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs px-2">1</Badge>
                      <span>Upload or paste JSON data</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs px-2">2</Badge>
                      <span>Validate format and schema</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs px-2">3</Badge>
                      <span>Preview changes and review summary</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs px-2">4</Badge>
                      <span>Confirm and apply changes</span>
                    </li>
                  </ol>
                </div>
              </div>
              
              <Button 
                onClick={handleImportData}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Import Data</span>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          {/* Timezone Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Timezone Settings</span>
              </CardTitle>
              <CardDescription>
                Configure your timezone for accurate daily boundaries and streak calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading settings...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone-select">Timezone</Label>
                    <Select
                      value={settings?.timezone || ''}
                      onValueChange={handleTimezoneChange}
                      disabled={isSavingSettings}
                    >
                      <SelectTrigger id="timezone-select">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {TIMEZONE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.offset}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {settings && (
                      <p className="text-xs text-muted-foreground">
                        Current: {getCurrentTimezoneOption()?.label || settings.timezone}
                      </p>
                    )}
                  </div>
                  
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Timezone Impact
                    </h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Daily boundaries (midnight) will be calculated in your selected timezone</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Streak calculations and daily completion percentages will update accordingly</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-blue-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Historical data will be remapped to correct day buckets</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Week Start Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Calendar Settings</span>
              </CardTitle>
              <CardDescription>
                Configure how your calendar is displayed and weekly calculations are performed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading settings...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="week-start-select">Week Start Day</Label>
                    <Select
                      value={settings?.weekStartDay?.toString() || ''}
                      onValueChange={handleWeekStartChange}
                      disabled={isSavingSettings}
                    >
                      <SelectTrigger id="week-start-select">
                        <SelectValue placeholder="Select week start day" />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEK_START_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {settings && (
                      <p className="text-xs text-muted-foreground">
                        Current: {WEEK_START_OPTIONS.find(opt => opt.value === settings.weekStartDay)?.label}
                      </p>
                    )}
                  </div>
                  
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Week Start Impact
                    </h4>
                    <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-green-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Calendar view will start weeks on your preferred day</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-green-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Weekly analytics and trends will align to your week boundaries</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ListChecks className="h-5 w-5" />
                <span>Checklist Settings</span>
              </CardTitle>
              <CardDescription>
                Configure how unchecked items are handled across days
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading settings...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="carry-over-checkbox"
                      checked={settings?.carryOverUncheckedItems ?? true}
                      onCheckedChange={async (checked) => {
                        if (!settings) return;
                        try {
                          setIsSavingSettings(true);
                          setSaveStatus('idle');
                          const updatedSettings = await settingsService.saveSettings({ 
                            carryOverUncheckedItems: checked as boolean 
                          });
                          setSettings(updatedSettings);
                          setSaveStatus('success');
                          setTimeout(() => setSaveStatus('idle'), 3000);
                        } catch (error) {
                          console.error('Failed to save carryover setting:', error);
                          setSaveStatus('error');
                          setTimeout(() => setSaveStatus('idle'), 5000);
                        } finally {
                          setIsSavingSettings(false);
                        }
                      }}
                      disabled={isSavingSettings}
                    />
                    <Label 
                      htmlFor="carry-over-checkbox" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Carry over unchecked items to today
                    </Label>
                  </div>
                  
                  {settings?.carryOverUncheckedItems && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="max-days-input" className="text-sm">
                        Look back days (1-30)
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="max-days-input"
                          type="number"
                          min="1"
                          max="30"
                          value={settings?.carryOverMaxDays || 7}
                          onChange={async (e) => {
                            const value = parseInt(e.target.value);
                            if (!settings || isNaN(value) || value < 1 || value > 30) return;
                            
                            try {
                              setIsSavingSettings(true);
                              setSaveStatus('idle');
                              const updatedSettings = await settingsService.saveSettings({ 
                                carryOverMaxDays: value 
                              });
                              setSettings(updatedSettings);
                              setSaveStatus('success');
                              setTimeout(() => setSaveStatus('idle'), 3000);
                            } catch (error) {
                              console.error('Failed to save max days setting:', error);
                              setSaveStatus('error');
                              setTimeout(() => setSaveStatus('idle'), 5000);
                            } finally {
                              setIsSavingSettings(false);
                            }
                          }}
                          className="w-20"
                          disabled={isSavingSettings}
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Unchecked items from the past {settings?.carryOverMaxDays || 7} days will appear in today's checklist
                      </p>
                    </div>
                  )}
                  
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">
                      Carryover Behavior
                    </h4>
                    <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Unchecked items from previous days automatically appear in today's list</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Carried items show a calendar icon with the original date</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="w-1 h-1 bg-purple-600 rounded-full mt-2 flex-shrink-0"></span>
                        <span>Items are only carried once to avoid duplicates</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Settings Actions</CardTitle>
              <CardDescription>
                Manage your settings and see current status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Save Status */}
              <div className="flex items-center space-x-3">
                {saveStatus === 'success' && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Settings saved successfully!</span>
                  </div>
                )}
                
                {saveStatus === 'error' && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Failed to save settings. Please try again.</span>
                  </div>
                )}
              </div>
              
              {/* Reset to Defaults */}
              <div className="pt-4 border-t">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Reset to Defaults</h4>
                  <p className="text-sm text-muted-foreground">
                    Reset timezone to browser timezone, week start to Monday, and carryover settings to defaults
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetSettings}
                    disabled={isResetting || isSavingSettings}
                    className="flex items-center space-x-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>{isResetting ? 'Resetting...' : 'Reset to Defaults'}</span>
                  </Button>
                </div>
              </div>
              
              {/* Settings Info */}
              {settings && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Current Settings</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Timezone: {getCurrentTimezoneOption()?.label || settings.timezone}</p>
                    <p>Week Start: {WEEK_START_OPTIONS.find(opt => opt.value === settings.weekStartDay)?.label}</p>
                    <p>Carryover: {settings.carryOverUncheckedItems ? `Enabled (${settings.carryOverMaxDays} days)` : 'Disabled'}</p>
                    <p>Last Updated: {settings.updatedAt.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DataImportDialog
        isOpen={isImportDialogOpen}
        onClose={handleImportDialogClose}
      />
    </div>
  );
}