import { useState, useEffect, useMemo, memo } from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, ShoppingBag, ArrowUpDown, Award, CalendarRange, Filter } from 'lucide-react';
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
    { id: 'custom', label: '自訂' },
];

/**
 * 分析儀表板
 */
export default memo(function Dashboard() {
    const [period, setPeriod] = useState('week');
    const [expenses, setExpenses] = useState([]);
    const [prevExpenses, setPrevExpenses] = useState([]);
    // 自訂日期區間（預設近 30 天）
    const [customStart, setCustomStart] = useState(() => getDateRange(30).start);
    const [customEnd, setCustomEnd] = useState(getToday());
    // 分類篩選（空陣列 = 全部）
    const [selectedCats, setSelectedCats] = useState([]);

    // 根據選擇的週期取得日期範圍
    const dateRange = useMemo(() => {
        switch (period) {
            case 'day': return getDateRange(1);
            case 'week': return getThisWeekRange();
            case 'month': return getThisMonthRange();
            case 'year': return getThisYearRange();
            case 'custom': return { start: customStart, end: customEnd };
            default: return getThisWeekRange();
        }
    }, [period, customStart, customEnd]);

    // 前一期日期範圍
    const prevRange = useMemo(() => {
        return getPreviousPeriodRange(dateRange.start, dateRange.end);
    }, [dateRange]);

    // 載入資料
    useEffect(() => {
        // 自訂區間不完整或顛倒時不載入
        if (!dateRange.start || !dateRange.end || dateRange.start > dateRange.end) return;
        const load = async () => {
            const data = await getExpensesByDateRange(dateRange.start, dateRange.end);
            setExpenses(data);
            const prevData = await getExpensesByDateRange(prevRange.start, prevRange.end);
            setPrevExpenses(prevData);
        };
        load();
    }, [dateRange, prevRange]);

    // 切換分類篩選
    const toggleCategory = (catId) => {
        setSelectedCats((prev) =>
            prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
        );
    };

    // 收支總覽（收入不受分類篩選影響）
    const incomeSummary = useMemo(() => {
        const income = expenses.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
        const expense = expenses.filter((e) => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
        return { income, expense, balance: income - expense };
    }, [expenses]);

    // 依分類篩選（空 = 全部），分析僅計支出
    const filteredExpenses = useMemo(() => {
        const onlyExpenses = expenses.filter((e) => e.type !== 'income');
        if (selectedCats.length === 0) return onlyExpenses;
        return onlyExpenses.filter((e) => selectedCats.includes(e.category));
    }, [expenses, selectedCats]);

    const filteredPrevExpenses = useMemo(() => {
        const onlyExpenses = prevExpenses.filter((e) => e.type !== 'income');
        if (selectedCats.length === 0) return onlyExpenses;
        return onlyExpenses.filter((e) => selectedCats.includes(e.category));
    }, [prevExpenses, selectedCats]);

    // 分析數據
    const analytics = useAnalytics(filteredExpenses, filteredPrevExpenses);

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

            {/* 自訂日期區間 */}
            {period === 'custom' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm space-y-2">
                    <div className="flex items-center gap-2 text-white/60 text-xs font-medium">
                        <CalendarRange className="w-3.5 h-3.5 text-cyan-400" />
                        自訂日期區間
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={customStart}
                            max={customEnd}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                        />
                        <span className="text-white/30 text-sm shrink-0">～</span>
                        <input
                            type="date"
                            value={customEnd}
                            min={customStart}
                            max={getToday()}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                        />
                    </div>
                    {customStart > customEnd && (
                        <p className="text-red-400 text-xs">⚠️ 起始日期不可晚於結束日期</p>
                    )}
                </div>
            )}

            {/* 分類篩選 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/60 text-xs font-medium">
                        <Filter className="w-3.5 h-3.5 text-purple-400" />
                        分類篩選
                    </div>
                    {selectedCats.length > 0 && (
                        <span className="text-purple-400 text-xs">已選 {selectedCats.length} 類</span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCats([])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCats.length === 0
                                ? 'bg-purple-500/25 border border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                                : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
                            }`}
                    >
                        ✨ 全部
                    </button>
                    {CATEGORIES.map((cat) => {
                        const isSelected = selectedCats.includes(cat.id);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => toggleCategory(cat.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
                                        ? 'bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                                        : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
                                    }`}
                            >
                                {cat.emoji} {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 收支總覽（期間內有收入時顯示） */}
            {incomeSummary.income > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="text-white/40 text-xs mb-3">💰 收支總覽</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-white/30 text-[10px] mb-1">收入</div>
                            <div className="text-emerald-400 font-bold text-sm">+{formatCurrency(incomeSummary.income)}</div>
                        </div>
                        <div>
                            <div className="text-white/30 text-[10px] mb-1">支出</div>
                            <div className="text-red-400 font-bold text-sm">-{formatCurrency(incomeSummary.expense)}</div>
                        </div>
                        <div>
                            <div className="text-white/30 text-[10px] mb-1">結餘</div>
                            <div className={`font-bold text-sm ${incomeSummary.balance >= 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
                                {formatCurrency(incomeSummary.balance)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
            {filteredExpenses.length === 0 && (
                <div className="text-center text-white/30 py-12">
                    <p className="text-4xl mb-3">📊</p>
                    <p>{selectedCats.length > 0 ? '所選分類在此期間無消費記錄' : '此期間尚無消費記錄'}</p>
                    <p className="text-xs mt-1">{selectedCats.length > 0 ? '試試調整分類或日期區間' : '去記帳頁面新增記錄吧！'}</p>
                </div>
            )}
        </div>
    );
})
