import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, Clock, Database } from 'lucide-react';
import { addMonths, subMonths, format } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { analyticsService, type DayAnalytics, type PeriodAnalytics, type RollingAverages } from '@/lib/analyticsService';
import { CompletionChart } from './charts/CompletionChart';
import { AnalyticsWidgets } from './analytics/AnalyticsWidgets';
import { EmptyState } from './analytics/EmptyState';
import { ErrorState } from './analytics/ErrorState';
import { Button } from './ui/button';

interface AnalyticsData {
  monthData: DayAnalytics[];
  periodAnalytics: PeriodAnalytics;
  rollingAverages: RollingAverages;
  sparklineData: {
    sevenDay: number[];
    thirtyDay: number[];
    ninetyDay: number[];
  };
  rollingAverageChartData?: {
    sevenDay: number[];
    thirtyDay: number[];
    ninetyDay: number[];
  };
}

export function Analytics() {
  const { setActiveTab } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DayAnalytics | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!analyticsService.isAvailable()) {
        throw new Error('Analytics service not available - IndexedDB may not be supported');
      }

      // Load month data for the chart
      const monthData = await analyticsService.getMonthAnalytics(currentMonth);
      
      // Load period analytics (current month)
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const periodAnalytics = await analyticsService.getPeriodAnalytics(startOfMonth, endOfMonth);
      
      // Load rolling averages for today
      const rollingAverages = await analyticsService.getRollingAverages(new Date());
      
      // Load sparkline data for trends
      const [sevenDay, thirtyDay, ninetyDay] = await Promise.all([
        analyticsService.getSparklineData(new Date(), 7),
        analyticsService.getSparklineData(new Date(), 30),
        analyticsService.getSparklineData(new Date(), 90)
      ]);

      // Create rolling average overlay data for the chart (aligned with month data)
      const rollingAverageChartData = {
        sevenDay: await Promise.all(
          monthData.map((_, index) => {
            const date = new Date(startOfMonth);
            date.setDate(date.getDate() + index);
            return analyticsService.getRollingAverages(date).then(r => r.sevenDay);
          })
        ),
        thirtyDay: await Promise.all(
          monthData.map((_, index) => {
            const date = new Date(startOfMonth);
            date.setDate(date.getDate() + index);
            return analyticsService.getRollingAverages(date).then(r => r.thirtyDay);
          })
        ),
        ninetyDay: await Promise.all(
          monthData.map((_, index) => {
            const date = new Date(startOfMonth);
            date.setDate(date.getDate() + index);
            return analyticsService.getRollingAverages(date).then(r => r.ninetyDay);
          })
        )
      };

      setAnalyticsData({
        monthData,
        periodAnalytics,
        rollingAverages,
        sparklineData: {
          sevenDay,
          thirtyDay,
          ninetyDay
        },
        rollingAverageChartData
      });
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Listen for data changes
  useEffect(() => {
    const handleDataChange = () => {
      // Clear cache and reload after a short delay
      analyticsService.clearCache();
      setTimeout(loadAnalytics, 100);
    };

    window.addEventListener('dayDataChanged', handleDataChange);
    return () => window.removeEventListener('dayDataChanged', handleDataChange);
  }, [loadAnalytics]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => 
      direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1)
    );
  };

  const handleStartTracking = () => {
    setActiveTab('notebook');
  };

  const handleRetry = () => {
    analyticsService.clearCache();
    loadAnalytics();
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      await analyticsService.seedTestData();
      await loadAnalytics();
    } catch (error) {
      console.error('Failed to seed data:', error);
    } finally {
      setIsSeeding(false);
    }
  };

  // Show error state
  if (error && !isLoading) {
    return <ErrorState error={error} onRetry={handleRetry} />;
  }

  // Show empty state if no data exists
  if (!isLoading && analyticsData?.periodAnalytics.activeDays === 0) {
    return (
      <div className="h-full flex flex-col">
        <EmptyState onStartTracking={handleStartTracking} />
        <div className="p-6 border-t bg-muted/30">
          <div className="max-w-md mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Want to see the analytics in action? Load some sample data:
            </p>
            <Button 
              onClick={handleSeedData} 
              disabled={isSeeding}
              variant="outline"
              size="sm"
            >
              <Database className="h-4 w-4 mr-2" />
              {isSeeding ? 'Loading...' : 'Load Demo Data'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Main Chart Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
              <p className="text-muted-foreground">
                Track your progress and productivity over time
              </p>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              {lastUpdated && (
                <>
                  <Clock className="h-4 w-4" />
                  <span>Updated {format(lastUpdated, 'h:mm a')}</span>
                </>
              )}
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateMonth('prev')}
                className="h-8 w-8 p-0"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateMonth('next')}
                className="h-8 w-8 p-0"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {hoveredDay && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">
                  {format(new Date(hoveredDay.date), 'MMM d, yyyy')}
                </span>
                <span className="hidden sm:inline"> • </span>
                <br className="sm:hidden" />
                <span>
                  {hoveredDay.completionRate}% completion
                </span>
                <span className="hidden sm:inline"> • </span>
                <br className="sm:hidden" />
                <span>
                  {hoveredDay.completedTasks}/{hoveredDay.totalTasks} tasks
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 p-6 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading analytics...</p>
              </div>
            </div>
          ) : analyticsData ? (
            <CompletionChart
              data={analyticsData.monthData}
              rollingAverages={analyticsData.rollingAverageChartData}
              onDataPointHover={setHoveredDay}
              className="w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Widgets */}
      <div className="w-full lg:w-80 border-t lg:border-l lg:border-t-0 bg-muted/30 p-6 overflow-auto">
        {analyticsData && (
          <AnalyticsWidgets
            periodAnalytics={analyticsData.periodAnalytics}
            rollingAverages={analyticsData.rollingAverages}
            sparklineData={analyticsData.sparklineData}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}