import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { formatCurrency, formatPercentChange } from '../../utils/formatters';

/**
 * 自訂 Tooltip
 */
function CustomTooltip({ active, payload }) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-white/20 rounded-xl px-3 py-2 shadow-xl">
                <p className="text-white text-sm font-medium">{data.emoji} {data.name}</p>
                <p className="text-cyan-400 text-sm font-bold">{formatCurrency(data.amount)}</p>
                {data.change !== undefined && (
                    <p className={`text-xs ${data.change > 0 ? 'text-red-400' : data.change < 0 ? 'text-emerald-400' : 'text-white/40'}`}>
                        較前期 {formatPercentChange(data.change)}
                    </p>
                )}
            </div>
        );
    }
    return null;
}

/**
 * 分類消費長條圖
 */
export default function CategoryBarChart({ data }) {
    return (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
            <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                    type="number"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={20}>
                    {data.map((entry, index) => (
                        <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
