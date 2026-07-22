import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getTodayChartData } from '../data/liveCheckInFeedback';
import { C } from '../data/colors';

interface Props {
  profileId: string;
  height?: number;
}

export function MomentumMiniChart({ profileId, height = 96 }: Props) {
  const [chartData, setChartData] = useState(() => getTodayChartData(profileId));

  const refresh = useCallback(() => {
    setChartData(getTodayChartData(profileId));
  }, [profileId]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('arbol-live-feedback-updated', handler);
    window.addEventListener('arbol-tasks-updated', handler);
    return () => {
      window.removeEventListener('arbol-live-feedback-updated', handler);
      window.removeEventListener('arbol-tasks-updated', handler);
    };
  }, [refresh]);

  const hasData = chartData.length > 0;
  const display = hasData ? chartData : [{ label: '-', progress: 0, momentum: 0 }];
  const chartKey = `${profileId}:${display.map(p => `${p.label}-${p.progress}-${p.momentum}`).join('|')}`;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart key={chartKey} data={display} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.secondary }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.secondary }} width={26} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}` }}
            formatter={(value: number, name: string) => [
              value,
              name === 'progress' ? 'Progress %' : 'Momentum',
            ]}
          />
          {hasData && (
            <>
              <Line type="monotone" dataKey="progress" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} isAnimationActive name="progress" />
              <Line type="monotone" dataKey="momentum" stroke={C.headline} strokeWidth={2} dot={{ r: 2 }} name="momentum" strokeDasharray="4 2" isAnimationActive />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
