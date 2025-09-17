import { BarChart3, BookOpen } from 'lucide-react';
import { Button } from '../ui/button';

interface EmptyStateProps {
  onStartTracking: () => void;
}

export function EmptyState({ onStartTracking }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center max-w-md px-8">
        <div className="mb-6">
          <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
        </div>
        
        <h2 className="text-2xl font-semibold mb-3">Start Your Analytics Journey</h2>
        
        <p className="text-muted-foreground mb-6 leading-relaxed">
          Your analytics will appear here once you start tracking your daily progress. 
          Create your first entry to see completion rates, streaks, and trending data.
        </p>
        
        <div className="space-y-3">
          <Button onClick={onStartTracking} className="w-full">
            <BookOpen className="h-4 w-4 mr-2" />
            Start Tracking Today
          </Button>
          
          <div className="text-sm text-muted-foreground">
            <div className="font-medium mb-2">You'll get insights on:</div>
            <ul className="text-left space-y-1 inline-block">
              <li>• Daily completion rates</li>
              <li>• Achievement streaks</li>
              <li>• Progress trends over time</li>
              <li>• Monthly productivity patterns</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}