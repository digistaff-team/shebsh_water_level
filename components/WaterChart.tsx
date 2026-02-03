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
import { GAUGING_STATION_ZERO_BSV } from '../constants';
import { WaterRecord } from '../types';

interface WaterChartProps {
  data: WaterRecord[];
}

const WaterChart: React.FC<WaterChartProps> = ({ data }) => {
  // Filter data to get only the latest record for each day
  const latestDataPerDay = React.useMemo(() => {
    const latestByDay = new Map<string, WaterRecord>();

    data.forEach(record => {
      if (!record.created_at) return;
      const recordDate = new Date(record.created_at);
      const dayKey = recordDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'

      const existingRecord = latestByDay.get(dayKey);

      if (!existingRecord || recordDate.getTime() > new Date(existingRecord.created_at!).getTime()) {
        latestByDay.set(dayKey, record);
      }
    });
    
    // Sort the filtered data by date before returning
    return Array.from(latestByDay.values()).sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
  }, [data]);

  // Format data for chart, converting water level to BSV meters
  const formattedData = latestDataPerDay.map(item => ({
    ...item,
    date: item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A',
    fullDate: item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A',
    water_level_bsv: (item.water_level / 100) + GAUGING_STATION_ZERO_BSV,
  }));

  if (latestDataPerDay.length === 0) {
    return (
        <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <p className="text-slate-400">Нет данных для графика</p>
        </div>
    )
  }

  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">История изменений (последнее за день)</h3>
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
            domain={['dataMin - 0.1', 'dataMax + 0.1']}
            tickFormatter={(tick) => tick.toFixed(2)}
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
            tickMargin={10} 
          >
            <Label 
              value="Уровень (м, БСВ)" 
              position="insideLeft" 
              angle={-90} 
              style={{ textAnchor: 'middle', fill: '#64748b', fontSize: 14 }}
            />
          </YAxis>
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#64748b', marginBottom: '0.25rem' }}
            formatter={(value: number) => [`${value.toFixed(3)} м (БСВ)`, 'Уровень']}
          />
          <Area
            type="monotone"
            dataKey="water_level_bsv"
            stroke="#0ea5e9"
            fill="url(#colorWater)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WaterChart;