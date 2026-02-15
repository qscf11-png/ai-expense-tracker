import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

/**
 * 自訂 Tooltip
 */
function CustomTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-800 border border-white/20 rounded-xl px-3 py-2 shadow-xl">
                <p className="text-white/60 text-xs">{label}</p>
                <p className="text-cyan-400 text-sm font-bold">{formatCurrency(payload[0].value)}</p>
            </div>
        );
    }
    return null;
}

/**
 * 趨勢折線圖（面積圖）
 */
export default function TrendLineChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                    dataKey="label"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#trendGradient)"
                    dot={{ r: 3, fill: '#06b6d4', stroke: '#0e1629', strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
