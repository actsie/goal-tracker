import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center max-w-md px-8">
        <div className="mb-6">
          <AlertCircle className="h-16 w-16 mx-auto text-red-500 opacity-75" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-3">Unable to Load Analytics</h2>
        
        <p className="text-muted-foreground mb-6 leading-relaxed">
          There was a problem loading your analytics data. This might be due to a temporary
          issue with local storage access.
        </p>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-700 font-mono">
            {error}
          </p>
        </div>
        
        <div className="space-y-3">
          <Button onClick={onRetry} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          <div className="text-sm text-muted-foreground">
            <p>If the issue persists, try:</p>
            <ul className="text-left space-y-1 inline-block mt-2">
              <li>• Refreshing the page</li>
              <li>• Checking browser storage permissions</li>
              <li>• Clearing browser cache</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}