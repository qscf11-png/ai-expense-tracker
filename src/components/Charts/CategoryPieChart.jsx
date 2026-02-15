import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

/**
 * 自訂 Tooltip
 */
function CustomTooltip({ active, payload }) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-800 border border-white/20 rounded-xl px-3 py-2 shadow-xl">
                <p className="text-white text-sm font-medium">{data.name}</p>
                <p className="text-cyan-400 text-sm">{formatCurrency(data.value)}</p>
                <p className="text-white/50 text-xs">{data.percentage}%</p>
            </div>
        );
    }
    return null;
}

/**
 * 自訂標籤
 */
function renderLabel({ name, percentage, cx, cy, midAngle, innerRadius, outerRadius }) {
    if (percentage < 5) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight="bold"
        >
            {percentage}%
        </text>
    );
}

/**
 * 分類圓餅圖元件
 */
export default function CategoryPieChart({ data }) {
    return (
        <div>
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={renderLabel}
                    >
                        {data.map((entry, index) => (
                            <Cell key={index} fill={entry.color} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>

            {/* 圖例 */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {data.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-white/60">{entry.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
