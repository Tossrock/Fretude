
import React from 'react';
import { ScoreRecord } from '../types';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  // Take last 30 games or all if fewer
  const data = history.map((record, index) => ({
    name: index + 1,
    date: new Date(record.date).toLocaleDateString(),
    score: record.score,
    avgTime: record.avgTimeSeconds ? parseFloat(record.avgTimeSeconds.toFixed(2)) : 0,
  }));

  const recentData = data.slice(-30);

  return (
    <div className="h-72 w-full bg-gray-800 p-4 rounded-lg shadow-inner flex flex-col">
      <h3 className="text-gray-400 text-sm mb-4 font-bold uppercase tracking-wide">Performance Over Time</h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={recentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="name" 
              stroke="#9ca3af" 
              fontSize={10} 
              tickLine={false} 
              tick={{ fill: '#9ca3af' }}
            />
            
            {/* Left Axis: Score */}
            <YAxis 
              yAxisId="left"
              stroke="#60a5fa" 
              fontSize={10} 
              tickLine={false}
              label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: '#60a5fa', fontSize: 10 }} 
            />
            
            {/* Right Axis: Time */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#f59e0b" 
              fontSize={10} 
              tickLine={false}
              label={{ value: 'Avg Time (s)', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10 }}
            />
            
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', borderColor: '#4b5563', color: '#f3f4f6' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '12px' }}/>
            
            <Bar 
              yAxisId="left" 
              dataKey="score" 
              name="Score" 
              fill="#60a5fa" 
              barSize={8} 
              radius={[4, 4, 0, 0]} 
            />
            
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="avgTime" 
              name="Avg Time (s)" 
              stroke="#f59e0b" 
              strokeWidth={2} 
              dot={{ r: 3, fill: '#f59e0b' }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;
