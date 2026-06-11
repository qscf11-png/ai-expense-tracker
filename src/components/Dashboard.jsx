import { useState, useEffect, useMemo, memo } from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, ShoppingBag, ArrowUpDown, Award } from 'lucide-react';
import { getExpensesByDateRange } from '../services/db';
import { useAnalytics } from '../hooks/useAnalytics';
import {
    getToday, getDateRange, getThisWeekRange,
    getThisMonthRange, getThisYearRange,
    getPreviousPeriodRange, generateDateSeries, generateMonthSeries,
} from '../utils/dateUtils';
import { formatCurrency, formatPercentChange } from '../utils/formatters';
import { CATEGORIES } from '../utils/categories';
import CategoryPieChart from './Charts/CategoryPieChart';
import TrendLineChart from './Charts/TrendLineChart';
import CategoryBarChart from './Charts/CategoryBarChart';

const PERIODS = [
    { id: 'day', label: '日' },
    { id: 'week', label: '週' },
    { id: 'month', label: '月' },
    { id: 'year', label: '年' },
];

/**
 * 分析儀表板
 */
export default memo(function Dashboard() {
    const [period, setPeriod] = useState('week');
    const [expenses, setExpenses] = useState([]);
    const [prevExpenses, setPrevExpenses] = useState([]);

    // 根據選擇的週期取得日期範圍
    const dateRange = useMemo(() => {
        switch (period) {
            case 'day': return getDateRange(1);
            case 'week': return getThisWeekRange();
            case 'month': return getThisMonthRange();
            case 'year': return getThisYearRange();
            default: return getThisWeekRange();
        }
    }, [period]);

    // 前一期日期範圍
    const prevRange = useMemo(() => {
        return getPreviousPeriodRange(dateRange.start, dateRange.end);
    }, [dateRange]);

    // 載入資料
    useEffect(() => {
        const load = async () => {
            const data = await getExpensesByDateRange(dateRange.start, dateRange.end);
            setExpenses(data);
            const prevData = await getExpensesByDateRange(prevRange.start, prevRange.end);
            setPrevExpenses(prevData);
        };
        load();
    }, [dateRange, prevRange]);

    // 分析數據
    const analytics = useAnalytics(expenses, prevExpenses);

    // 趨勢圖資料
    const trendData = useMemo(() => {
        if (period === 'year') {
            const months = generateMonthSeries(new Date().getFullYear());
            return months.map((m) => ({
                label: m.substring(5) + '月',
                amount: analytics.monthlyTotals[m] || 0,
            }));
        }
        const dates = generateDateSeries(dateRange.start, dateRange.end);
        return dates.map((d) => ({
            label: d.substring(5),
            amount: analytics.dailyTotals[d] || 0,
        }));
    }, [period, dateRange, analytics.dailyTotals, analytics.monthlyTotals]);

    // 分類圓餅圖資料
    const pieData = useMemo(() => {
        return analytics.categoryStats
            .filter((s) => s.amount > 0)
            .map((s) => ({
                name: `${s.emoji} ${s.name}`,
                value: s.amount,
                color: s.color,
                percentage: s.percentage,
            }));
    }, [analytics.categoryStats]);

    // 分類長條圖資料
    const barData = useMemo(() => {
        return analytics.categoryChanges
            .filter((s) => s.amount > 0 || s.change !== 0)
            .map((s) => ({
                name: s.name,
                emoji: s.emoji,
                amount: s.amount,
                change: s.change,
                color: s.color,
            }));
    }, [analytics.categoryChanges]);

    const TrendIcon = analytics.totalChange > 0 ? TrendingUp : analytics.totalChange < 0 ? TrendingDown : Minus;
    const trendColor = analytics.totalChange > 0
        ? 'text-red-400'
        : analytics.totalChange < 0
            ? 'text-emerald-400'
            : 'text-white/40';

    return (
        <div className="space-y-5">
            {/* 週期切換 */}
            <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                {PERIODS.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => setPeriod(p.id)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${period === p.id
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                                : 'text-white/50 hover:text-white/70'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* 統計摘要卡片 */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                        <DollarSign className="w-3.5 h-3.5" />
                        總支出
                    </div>
                    <div className="text-white font-bold text-xl">{formatCurrency(analytics.totalAmount)}</div>
                    <div className={`text-xs mt-1 flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon className="w-3 h-3" />
                        {formatPercentChange(analytics.totalChange)} 較前期
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        消費筆數
                    </div>
                    <div className="text-white font-bold text-xl">{analytics.transactionCount}</div>
                    <div className="text-white/30 text-xs mt-1">
                        平均 {formatCurrency(analytics.averageAmount)}/筆
                    </div>
                </div>

                {analytics.maxExpense && (
                    <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                            <Award className="w-3.5 h-3.5" />
                            最高單筆消費
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{analytics.maxExpense.item}</span>
                            <span className="text-amber-400 font-bold">{formatCurrency(analytics.maxExpense.amount)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 趨勢折線圖 */}
            {trendData.some((d) => d.amount > 0) && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <h3 className="text-white/60 text-xs font-medium mb-3 flex items-center gap-2">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        消費趨勢
                    </h3>
                    <TrendLineChart data={trendData} />
                </div>
            )}

            {/* 分類圓餅圖 */}
            {pieData.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <h3 className="text-white/60 text-xs font-medium mb-3">分類佔比</h3>
                    <CategoryPieChart data={pieData} />
                </div>
            )}

            {/* 分類比較長條圖 */}
            {barData.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <h3 className="text-white/60 text-xs font-medium mb-3">分類消費 vs 前期</h3>
                    <CategoryBarChart data={barData} />
                </div>
            )}

            {/* 空狀態 */}
            {expenses.length === 0 && (
                <div className="text-center text-white/30 py-12">
                    <p className="text-4xl mb-3">📊</p>
                    <p>此期間尚無消費記錄</p>
                    <p className="text-xs mt-1">去記帳頁面新增記錄吧！</p>
                </div>
            )}
        </div>
    );
})
