import { TrendingUp, Calendar, Flame, CheckSquare } from 'lucide-react';
import { Sparkline } from '../charts/Sparkline';
import { type PeriodAnalytics, type RollingAverages } from '@/lib/analyticsService';

interface AnalyticsWidgetsProps {
  periodAnalytics: PeriodAnalytics;
  rollingAverages: RollingAverages;
  sparklineData: {
    sevenDay: number[];
    thirtyDay: number[];
    ninetyDay: number[];
  };
  isLoading?: boolean;
}

export function AnalyticsWidgets({ 
  periodAnalytics, 
  rollingAverages, 
  sparklineData, 
  isLoading = false 
}: AnalyticsWidgetsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-4 border rounded-lg bg-card animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Completion Rate */}
      <div className="p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm">Completion Rate</h3>
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">
          {periodAnalytics.completionRate}%
        </div>
        <div className="text-xs text-muted-foreground">
          {periodAnalytics.completedTasks} of {periodAnalytics.totalTasks} tasks
        </div>
      </div>

      {/* Current Streak */}
      <div className="p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Flame className="h-4 w-4 text-orange-600" />
            <h3 className="font-semibold text-sm">Current Streak</h3>
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">
          {periodAnalytics.streakInfo.currentStreak}
        </div>
        <div className="text-xs text-muted-foreground">
          {periodAnalytics.streakInfo.currentStreak === 1 ? 'day' : 'days'}
          {periodAnalytics.streakInfo.longestStreak > 0 && 
            ` • Best: ${periodAnalytics.streakInfo.longestStreak}`
          }
        </div>
      </div>

      {/* Active Days */}
      <div className="p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm">Active Days</h3>
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">
          {periodAnalytics.activeDays}
        </div>
        <div className="text-xs text-muted-foreground">
          of {periodAnalytics.totalDays} days
        </div>
      </div>

      {/* Rolling Averages with Sparklines */}
      <div className="p-4 border rounded-lg bg-card">
        <div className="flex items-center space-x-2 mb-3">
          <TrendingUp className="h-4 w-4 text-purple-600" />
          <h3 className="font-semibold text-sm">Trends</h3>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">7-day</div>
              <div className="text-xs text-muted-foreground">{rollingAverages.sevenDay}% avg</div>
            </div>
            <Sparkline
              data={sparklineData.sevenDay}
              width={60}
              height={20}
              color="#3b82f6"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">30-day</div>
              <div className="text-xs text-muted-foreground">{rollingAverages.thirtyDay}% avg</div>
            </div>
            <Sparkline
              data={sparklineData.thirtyDay}
              width={60}
              height={20}
              color="#22c55e"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">90-day</div>
              <div className="text-xs text-muted-foreground">{rollingAverages.ninetyDay}% avg</div>
            </div>
            <Sparkline
              data={sparklineData.ninetyDay}
              width={60}
              height={20}
              color="#8b5cf6"
            />
          </div>
        </div>
      </div>
    </div>
  );
}