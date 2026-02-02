import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, trend, color = "text-slate-900" }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className={`text-4xl font-bold ${color} mb-2 flex items-center gap-2`}>
        {value}
        {trend === 'up' && <span className="text-red-500 text-2xl">▲</span>}
        {trend === 'down' && <span className="text-emerald-500 text-2xl">▼</span>}
        {trend === 'neutral' && <span className="text-slate-400 text-2xl">−</span>}
      </div>
      {subtext && <p className="text-sm text-slate-400">{subtext}</p>}
    </div>
  );
};

export default StatCard;
