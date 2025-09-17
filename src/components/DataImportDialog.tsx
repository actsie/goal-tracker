import { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Download, 
  RefreshCw,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { analyzeImport, performImport, exportAllData, downloadExportFile } from '../lib/dataImportExport';
import type { ImportSummary, ImportProgress } from '../lib/dataImportExport';
import type { ExportData } from '../lib/exportSchema';
import { useAppStore } from '../store/useAppStore';

interface DataImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportStep = 'input' | 'validating' | 'preview' | 'importing' | 'complete' | 'error';

export function DataImportDialog({ isOpen, onClose }: DataImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('input');
  const [inputMethod, setInputMethod] = useState<'file' | 'paste'>('file');
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setGoals } = useAppStore();

  const resetState = useCallback(() => {
    setStep('input');
    setInputMethod('file');
    setImportData(null);
    setImportSummary(null);
    setImportProgress(null);
    setPastedJson('');
    setError(null);
    setExpandedSections({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setError('Please select a valid JSON file');
      return;
    }

    try {
      const text = await file.text();
      await processImportData(text);
    } catch (err) {
      setError(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedJson.trim()) {
      setError('Please paste JSON data');
      return;
    }

    await processImportData(pastedJson);
  };

  const processImportData = async (jsonText: string) => {
    setStep('validating');
    setError(null);

    try {
      const data = JSON.parse(jsonText);
      setImportData(data);

      const summary = await analyzeImport(data);
      setImportSummary(summary);

      if (summary.validationErrors.some(e => e.type === 'error')) {
        setStep('error');
        setError(`Validation failed: ${summary.validationErrors.filter(e => e.type === 'error').map(e => e.message).join(', ')}`);
      } else {
        setStep('preview');
      }
    } catch (err) {
      setStep('error');
      setError(`Invalid JSON: ${err instanceof Error ? err.message : 'Unknown parsing error'}`);
    }
  };

  const handleConfirmImport = async () => {
    if (!importData) return;

    setStep('importing');
    setImportProgress({ phase: 'validating', completed: 0, total: 100, message: 'Starting import...' });

    try {
      await performImport(importData, setImportProgress);
      
      // Refresh goals in the app store
      const { db } = await import('../lib/database');
      const updatedGoals = await db.goals.orderBy('createdAt').toArray();
      setGoals(updatedGoals);
      
      setStep('complete');
    } catch (err) {
      setStep('error');
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const currentData = await exportAllData();
      downloadExportFile(currentData, `goal-tracker-backup-${new Date().toISOString().split('T')[0]}.json`);
    } catch (err) {
      console.error('Failed to create backup:', err);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderValidationErrors = () => {
    if (!importSummary?.validationErrors.length) return null;

    const errors = importSummary.validationErrors.filter(e => e.type === 'error');
    const warnings = importSummary.validationErrors.filter(e => e.type === 'warning');

    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Validation Issues</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.length > 0 && (
            <div>
              <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Errors (must be fixed):</h4>
              <ul className="space-y-1 text-sm">
                {errors.map((error, index) => (
                  <li key={index} className="text-red-600 dark:text-red-400">
                    <strong>{error.field}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {warnings.length > 0 && (
            <div>
              <h4 className="font-medium text-yellow-600 dark:text-yellow-400 mb-2">Warnings:</h4>
              <ul className="space-y-1 text-sm">
                {warnings.map((warning, index) => (
                  <li key={index} className="text-yellow-600 dark:text-yellow-400">
                    <strong>{warning.field}:</strong> {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSummarySection = (
    title: string,
    data: { new: number; overwritten: number; unchanged: number; examples: any },
    sectionKey: string
  ) => {
    const isExpanded = expandedSections[sectionKey];
    const total = data.new + data.overwritten + data.unchanged;
    
    if (total === 0) return null;

    return (
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => toggleSection(sectionKey)}
        >
          <CardTitle className="flex items-center justify-between">
            <span>{title}</span>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{total} items</Badge>
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CardTitle>
        </CardHeader>
        {isExpanded && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{data.new}</div>
                <div className="text-sm text-muted-foreground">New</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{data.overwritten}</div>
                <div className="text-sm text-muted-foreground">Overwritten</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{data.unchanged}</div>
                <div className="text-sm text-muted-foreground">Unchanged</div>
              </div>
            </div>
            
            {/* Show examples */}
            {data.examples.new.length > 0 && (
              <div>
                <h4 className="font-medium text-green-600 mb-2">Examples of new items:</h4>
                <ul className="text-sm space-y-1">
                  {data.examples.new.slice(0, 3).map((item: any, index: number) => (
                    <li key={index} className="text-muted-foreground">
                      {item.name || item.date || `${item.notes?.length || 0} notes, ${item.checklist?.length || 0} checklist items`}
                    </li>
                  ))}
                  {data.examples.new.length > 3 && (
                    <li className="text-xs text-muted-foreground">...and {data.examples.new.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
            
            {data.examples.overwritten.length > 0 && (
              <div>
                <h4 className="font-medium text-orange-600 mb-2">Examples of items to be overwritten:</h4>
                <ul className="text-sm space-y-1">
                  {data.examples.overwritten.slice(0, 3).map((item: any, index: number) => (
                    <li key={index} className="text-muted-foreground">
                      {item.name || item.date || `${item.notes?.length || 0} notes, ${item.checklist?.length || 0} checklist items`}
                    </li>
                  ))}
                  {data.examples.overwritten.length > 3 && (
                    <li className="text-xs text-muted-foreground">...and {data.examples.overwritten.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Import Data</span>
          </DialogTitle>
          <DialogDescription>
            Import your Goal Tracker data from a JSON export file
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-6">
            <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as 'file' | 'paste')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="file" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>Upload File</span>
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Paste JSON</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Select JSON export file</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose a Goal Tracker export file to import
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Paste JSON data
                  </label>
                  <Textarea
                    value={pastedJson}
                    onChange={(e) => setPastedJson(e.target.value)}
                    placeholder="Paste your Goal Tracker export JSON data here..."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </div>
                <Button 
                  onClick={handlePasteSubmit}
                  disabled={!pastedJson.trim()}
                  className="w-full"
                >
                  Validate & Preview
                </Button>
              </TabsContent>
            </Tabs>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            )}
          </div>
        )}

        {step === 'validating' && (
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
            <p className="text-lg font-medium">Validating import data...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Checking format and analyzing changes
            </p>
          </div>
        )}

        {step === 'preview' && importSummary && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Import Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Review the changes before importing
                </p>
              </div>
              <Badge variant="outline" className="text-sm">
                {importSummary.totalRecords} total records
              </Badge>
            </div>

            {importSummary.validationErrors.length > 0 && renderValidationErrors()}

            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                {renderSummarySection('Goals', importSummary.goals, 'goals')}
                {renderSummarySection('Daily Data', importSummary.dayData, 'dayData')}
              </div>
            </ScrollArea>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium mb-1">Before proceeding:</p>
                  <ul className="space-y-1">
                    <li>• Items with matching IDs will be overwritten</li>
                    <li>• New items will be added to your data</li>
                    <li>• Existing items not in the import will remain unchanged</li>
                    <li>• We recommend creating a backup before importing</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setStep('input')}>
                  Back
                </Button>
                <Button variant="outline" onClick={handleDownloadBackup}>
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup First
                </Button>
              </div>
              <Button 
                onClick={handleConfirmImport}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={importSummary.validationErrors.some(e => e.type === 'error')}
              >
                Confirm Import
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && importProgress && (
          <div className="text-center py-8 space-y-4">
            <RefreshCw className="h-12 w-12 mx-auto text-blue-600 animate-spin" />
            <div>
              <p className="text-lg font-medium">Importing data...</p>
              <p className="text-sm text-muted-foreground mt-1">{importProgress.message}</p>
            </div>
            <div className="max-w-md mx-auto">
              <Progress 
                value={(importProgress.completed / importProgress.total) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {importProgress.completed} of {importProgress.total} items
              </p>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
            <div>
              <p className="text-xl font-semibold text-green-600">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your data has been successfully imported. All UI components will be updated automatically.
              </p>
            </div>
            <Button onClick={handleClose} className="mt-4">
              Close
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8 space-y-4">
            <AlertCircle className="h-16 w-16 mx-auto text-red-600" />
            <div>
              <p className="text-xl font-semibold text-red-600">Import Failed</p>
              {error && (
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  {error}
                </p>
              )}
            </div>
            <div className="space-x-2">
              <Button variant="outline" onClick={handleDownloadBackup}>
                <Download className="h-4 w-4 mr-2" />
                Download Current Backup
              </Button>
              <Button onClick={() => setStep('input')}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}