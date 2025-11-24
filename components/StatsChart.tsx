import React from 'react';
import { ScoreRecord } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatsChartProps {
  history: ScoreRecord[];
}

const StatsChart: React.FC<StatsChartProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
        No games played yet. Start learning!
      </div>
    );
  }

  // Take last 20 games
  const data = history.slice(-20).map((record, index) => ({
    name: index + 1,
    score: record.score,
    maxFret: record.maxFret,
  }));

  return (
    <div className="h-64 w-full bg-gray-800 p-4 rounded-lg shadow-inner">
      <h3 className="text-gray-400 text-sm mb-2 font-bold uppercase tracking-wide">Recent Performance</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} />
          <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563', color: '#f3f4f6' }}
            itemStyle={{ color: '#60a5fa' }}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#60a5fa" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#60a5fa' }}
            activeDot={{ r: 6 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatsChart;
