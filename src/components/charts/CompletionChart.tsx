import { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { type DayAnalytics } from '@/lib/analyticsService';

interface CompletionChartProps {
  data: DayAnalytics[];
  rollingAverages?: {
    sevenDay: number[];
    thirtyDay: number[];
    ninetyDay: number[];
  };
  onDataPointHover?: (day: DayAnalytics | null) => void;
  className?: string;
}

export function CompletionChart({ 
  data, 
  rollingAverages, 
  onDataPointHover,
  className = ''
}: CompletionChartProps) {
  const [hoveredDay, setHoveredDay] = useState<DayAnalytics | null>(null);
  const [visibleOverlays, setVisibleOverlays] = useState({
    sevenDay: false,
    thirtyDay: false,
    ninetyDay: false
  });
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const chartDimensions = {
    width: Math.max(300, containerWidth - 40), // Responsive width with minimum
    height: 300,
    margin: { top: 20, right: 60, bottom: 40, left: 40 }
  };

  const innerWidth = chartDimensions.width - chartDimensions.margin.left - chartDimensions.margin.right;
  const innerHeight = chartDimensions.height - chartDimensions.margin.top - chartDimensions.margin.bottom;

  const { xScale, yScale, barWidth } = useMemo(() => {
    const xScale = (index: number) => (index * innerWidth) / Math.max(data.length - 1, 1);
    const yScale = (value: number) => innerHeight - (value * innerHeight) / 100;
    const barWidth = Math.max(2, innerWidth / data.length - 1);

    return { xScale, yScale, barWidth };
  }, [data.length, innerWidth, innerHeight]);

  const createPath = (values: number[]) => {
    return values
      .map((value, index) => {
        const x = xScale(index);
        const y = yScale(value);
        return index === 0 ? `M${x},${y}` : `L${x},${y}`;
      })
      .join(' ');
  };

  const handleMouseEnter = (day: DayAnalytics) => {
    setHoveredDay(day);
    onDataPointHover?.(day);
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
    onDataPointHover?.(null);
  };

  const toggleOverlay = (overlay: keyof typeof visibleOverlays) => {
    setVisibleOverlays(prev => ({
      ...prev,
      [overlay]: !prev[overlay]
    }));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Chart overlay toggles">
        {rollingAverages && (
          <>
            <button
              onClick={() => toggleOverlay('sevenDay')}
              aria-pressed={visibleOverlays.sevenDay}
              aria-label={`Toggle 7-day rolling average overlay ${visibleOverlays.sevenDay ? '(currently visible)' : '(currently hidden)'}`}
              className={`px-3 py-1 text-sm rounded-full border transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                visibleOverlays.sevenDay
                  ? 'bg-blue-100 border-blue-500 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
              }`}
            >
              7-day avg
            </button>
            <button
              onClick={() => toggleOverlay('thirtyDay')}
              aria-pressed={visibleOverlays.thirtyDay}
              aria-label={`Toggle 30-day rolling average overlay ${visibleOverlays.thirtyDay ? '(currently visible)' : '(currently hidden)'}`}
              className={`px-3 py-1 text-sm rounded-full border transition-colors focus:ring-2 focus:ring-green-500 focus:outline-none ${
                visibleOverlays.thirtyDay
                  ? 'bg-green-100 border-green-500 text-green-700'
                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
              }`}
            >
              30-day avg
            </button>
            <button
              onClick={() => toggleOverlay('ninetyDay')}
              aria-pressed={visibleOverlays.ninetyDay}
              aria-label={`Toggle 90-day rolling average overlay ${visibleOverlays.ninetyDay ? '(currently visible)' : '(currently hidden)'}`}
              className={`px-3 py-1 text-sm rounded-full border transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none ${
                visibleOverlays.ninetyDay
                  ? 'bg-purple-100 border-purple-500 text-purple-700'
                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
              }`}
            >
              90-day avg
            </button>
          </>
        )}
      </div>

      <div className="relative bg-white border rounded-lg p-4 overflow-x-auto">
        <svg
          width={chartDimensions.width}
          height={chartDimensions.height}
          className="overflow-visible"
          role="img"
          aria-label={`Completion rate chart showing ${data.length} days of data`}
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="1" />
            </pattern>
          </defs>
          
          <g transform={`translate(${chartDimensions.margin.left},${chartDimensions.margin.top})`}>
            <rect width={innerWidth} height={innerHeight} fill="url(#grid)" />
            
            {/* Y-axis labels */}
            {[0, 25, 50, 75, 100].map(value => (
              <g key={value}>
                <line
                  x1={0}
                  y1={yScale(value)}
                  x2={innerWidth}
                  y2={yScale(value)}
                  stroke="#e0e0e0"
                  strokeWidth={1}
                />
                <text
                  x={-10}
                  y={yScale(value)}
                  textAnchor="end"
                  alignmentBaseline="central"
                  className="text-xs fill-gray-500"
                >
                  {value}%
                </text>
              </g>
            ))}

            {/* Data bars */}
            {data.map((day, index) => {
              const x = xScale(index);
              const y = yScale(day.completionRate);
              const height = innerHeight - y;
              const isHovered = hoveredDay?.date === day.date;

              return (
                <g key={day.date}>
                  <rect
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={height}
                    fill={day.hasData ? (day.completionRate === 100 ? '#22c55e' : '#3b82f6') : '#e5e7eb'}
                    className={`transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isHovered ? 'opacity-80' : 'opacity-100'
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${format(new Date(day.date), 'MMMM d, yyyy')}: ${day.completionRate}% completion, ${day.completedTasks} of ${day.totalTasks} tasks completed`}
                    onMouseEnter={() => handleMouseEnter(day)}
                    onMouseLeave={handleMouseLeave}
                    onFocus={() => handleMouseEnter(day)}
                    onBlur={handleMouseLeave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMouseEnter(day);
                      }
                    }}
                  />
                  {/* Day label (show every few days to avoid crowding) */}
                  {(index % Math.ceil(data.length / 10) === 0 || isHovered) && (
                    <text
                      x={x}
                      y={innerHeight + 15}
                      textAnchor="middle"
                      className="text-xs fill-gray-500"
                    >
                      {format(new Date(day.date), 'd')}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Rolling average overlays */}
            {rollingAverages && visibleOverlays.sevenDay && (
              <path
                d={createPath(rollingAverages.sevenDay)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                className="opacity-70"
              />
            )}
            
            {rollingAverages && visibleOverlays.thirtyDay && (
              <path
                d={createPath(rollingAverages.thirtyDay)}
                fill="none"
                stroke="#22c55e"
                strokeWidth={2}
                className="opacity-70"
              />
            )}
            
            {rollingAverages && visibleOverlays.ninetyDay && (
              <path
                d={createPath(rollingAverages.ninetyDay)}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth={2}
                className="opacity-70"
              />
            )}

            {/* Hover tooltip */}
            {hoveredDay && (
              <g>
                <rect
                  x={xScale(data.findIndex(d => d.date === hoveredDay.date)) - 60}
                  y={yScale(hoveredDay.completionRate) - 40}
                  width={120}
                  height={30}
                  fill="black"
                  fillOpacity={0.8}
                  rx={4}
                />
                <text
                  x={xScale(data.findIndex(d => d.date === hoveredDay.date))}
                  y={yScale(hoveredDay.completionRate) - 25}
                  textAnchor="middle"
                  className="text-xs fill-white"
                >
                  {format(new Date(hoveredDay.date), 'MMM d')}
                </text>
                <text
                  x={xScale(data.findIndex(d => d.date === hoveredDay.date))}
                  y={yScale(hoveredDay.completionRate) - 15}
                  textAnchor="middle"
                  className="text-xs fill-white"
                >
                  {hoveredDay.completionRate}% ({hoveredDay.completedTasks}/{hoveredDay.totalTasks})
                </text>
              </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}