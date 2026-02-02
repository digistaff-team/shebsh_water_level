import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
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
            <p className="text-slate-400">No data available for chart</p>
        </div>
    )
  }

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Historical Water Levels</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={formattedData}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
            unit=" cm"
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#64748b', marginBottom: '0.25rem' }}
            formatter={(value: number) => [`${value} cm`, 'Level']}
          />
          <Area 
            type="monotone" 
            dataKey="water_level" 
            stroke="#0ea5e9" 
            fill="#e0f2fe" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WaterChart;
