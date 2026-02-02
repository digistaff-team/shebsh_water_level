import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label // Add Label to imports
} from 'recharts';
import { WaterRecord } from '../types';

interface WaterChartProps {
  data: WaterRecord[];
}

const WaterChart: React.FC<WaterChartProps> = ({ data }) => {
  // Format data for chart
  const formattedData = data.map(item => ({
    ...item,
    date: item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A',
    fullDate: item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'
  }));

  if (data.length === 0) {
    return (
        <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <p className="text-slate-400">Нет данных для графика</p>
        </div>
    )
  }

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">История изменений</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formattedData}
          margin={{
            top: 5,
            right: 20,
            left: 20, // Increased left margin for Y-axis label/ticks
            bottom: 20, // Increased bottom margin for X-axis labels
          }}
        >
           <defs>
            <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
            tickMargin={10} // Added tickMargin to give more space between tick and label
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
            tickMargin={10} // Added tickMargin to give more space between tick and label
          >
            <Label 
              value="Уровень (см)" 
              position="insideLeft" 
              angle={-90} 
              style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 14 }}
            />
          </YAxis>
          <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', marginBottom: '0.25rem' }}
                      formatter={(value: number) => [`${value} см`, 'Уровень']}
                    />
                    <Area
                      type="monotone"
                      dataKey="water_level"
                      stroke="#0ea5e9"
                      fill="#e0f2fe"
                      strokeWidth={2}          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WaterChart;
