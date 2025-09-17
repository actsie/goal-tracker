import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
  showDots?: boolean;
}

export function Sparkline({ 
  data, 
  width = 100, 
  height = 30, 
  className = '',
  color = '#3b82f6',
  showDots = false 
}: SparklineProps) {
  const { path, dots } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', dots: [] };
    }

    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const range = maxValue - minValue || 1; // Avoid division by zero

    const pathPoints = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      return { x, y, value };
    });

    const path = pathPoints
      .map((point, index) => 
        index === 0 ? `M${point.x},${point.y}` : `L${point.x},${point.y}`
      )
      .join(' ');

    return { path, dots: pathPoints };
  }, [data, width, height]);

  if (!data || data.length === 0) {
    return (
      <div className={`${className}`} style={{ width, height }}>
        <svg width={width} height={height}>
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className}`} style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showDots && dots.map((dot, index) => (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={1.5}
            fill={color}
          />
        ))}
      </svg>
    </div>
  );
}