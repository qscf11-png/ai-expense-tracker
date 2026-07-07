import { useState, useEffect, useMemo, memo } from 'react';
import { Trash2, ChevronDown, ChevronUp, Calendar, MessageSquareText, Clock } from 'lucide-react';
import { getCategoryById } from '../utils/categories';
import { formatCurrency } from '../utils/formatters';
import { formatDateChinese, getToday } from '../utils/dateUtils';
import { getExpensesByDateRange } from '../services/db';
import { deleteExpense } from '../services/db';

/**
 * 消費清單元件
 * 按日分組顯示消費記錄，每筆可點擊展開查看細節
 */
export default memo(function ExpenseList() {
    const [expenses, setExpenses] = useState([]);
    const [expandedDate, setExpandedDate] = useState(getToday());
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // 載入當月資料
    useEffect(() => {
        loadMonthData();
    }, [selectedMonth]);

    const loadMonthData = async () => {
        const [year, month] = selectedMonth.split('-');
        const start = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        const data = await getExpensesByDateRange(start, end);
        setExpenses(data);
    };

    // 按日分組（支出與收入分開加總）
    const groupedByDate = useMemo(() => {
        const groups = {};
        expenses.forEach((e) => {
            if (!groups[e.date]) groups[e.date] = [];
            groups[e.date].push(e);
        });

        return Object.entries(groups)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => ({
                date,
                items,
                total: items.filter((e) => e.type !== 'income').reduce((sum, e) => sum + e.amount, 0),
                incomeTotal: items.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0),
            }));
    }, [expenses]);

    // 月總額（支出 / 收入 / 結餘）
    const monthSummary = useMemo(() => {
        const expense = expenses.filter((e) => e.type !== 'income').reduce((sum, e) => sum + e.amount, 0);
        const income = expenses.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        return { expense, income, balance: income - expense };
    }, [expenses]);

    // 刪除記錄
    const handleDelete = async (id) => {
        await deleteExpense(id);
        setExpandedItemId(null);
        loadMonthData();
        window.dispatchEvent(new Event('expense-changed'));
    };

    // 切換月份
    const handleMonthChange = (direction) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        let newYear = year;
        let newMonth = month + direction;
        if (newMonth > 12) { newMonth = 1; newYear++; }
        if (newMonth < 1) { newMonth = 12; newYear--; }
        setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
    };

    // 點擊展開/收合某筆記錄
    const toggleItemDetail = (id) => {
        setExpandedItemId(expandedItemId === id ? null : id);
    };

    return (
        <div className="space-y-4">
            {/* 月份選擇器 */}
            <div className="flex items-center justify-between bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <button
                    onClick={() => handleMonthChange(-1)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                >
                    ←
                </button>
                <div className="text-center">
                    <div className="text-white font-bold text-lg">
                        {selectedMonth.replace('-', ' 年 ')} 月
                    </div>
                    <div className="text-cyan-400 text-sm font-medium">
                        支出 {formatCurrency(monthSummary.expense)}
                    </div>
                    {monthSummary.income > 0 && (
                        <div className="flex items-center justify-center gap-2 text-xs mt-0.5">
                            <span className="text-emerald-400">收入 +{formatCurrency(monthSummary.income)}</span>
                            <span className={monthSummary.balance >= 0 ? 'text-white/50' : 'text-red-400'}>
                                結餘 {formatCurrency(monthSummary.balance)}
                            </span>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => handleMonthChange(1)}
                    className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                >
                    →
                </button>
            </div>

            {/* 消費清單 */}
            {groupedByDate.length === 0 ? (
                <div className="text-center text-white/30 py-16">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>本月無消費記錄</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {groupedByDate.map(({ date, items, total, incomeTotal }) => (
                        <div
                            key={date}
                            className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm"
                        >
                            {/* 日期標頭 */}
                            <button
                                onClick={() =>
                                    setExpandedDate(expandedDate === date ? null : date)
                                }
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-white font-medium">
                                        {formatDateChinese(date)}
                                    </div>
                                    <span className="text-white/30 text-xs">
                                        {items.length} 筆
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {incomeTotal > 0 && (
                                        <span className="text-emerald-400 text-xs font-medium">
                                            +{formatCurrency(incomeTotal)}
                                        </span>
                                    )}
                                    <span className="text-cyan-400 font-bold">
                                        {formatCurrency(total)}
                                    </span>
                                    {expandedDate === date ? (
                                        <ChevronUp className="w-4 h-4 text-white/40" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-white/40" />
                                    )}
                                </div>
                            </button>

                            {/* 展開的明細 */}
                            {expandedDate === date && (
                                <div className="border-t border-white/5">
                                    {items.map((expense) => {
                                        const cat = getCategoryById(expense.category);
                                        const isExpanded = expandedItemId === expense.id;
                                        const isIncome = expense.type === 'income';
                                        return (
                                            <div key={expense.id}>
                                                {/* 主要行 — 點擊展開細節 */}
                                                <button
                                                    onClick={() => toggleItemDetail(expense.id)}
                                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl">{cat.emoji}</span>
                                                        <div>
                                                            <div className="text-white text-sm font-medium">
                                                                {expense.item}
                                                            </div>
                                                            <div className="text-white/30 text-xs">
                                                                {cat.name}
                                                                {expense.note && ` · ${expense.note}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-medium ${isIncome ? 'text-emerald-400' : 'text-white'}`}>
                                                            {isIncome ? '+' : ''}{formatCurrency(expense.amount)}
                                                        </span>
                                                        <ChevronDown
                                                            className={`w-3.5 h-3.5 text-white/20 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </div>
                                                </button>

                                                {/* 展開的細節面板 */}
                                                {isExpanded && (
                                                    <div className="px-4 pb-3 ml-9 space-y-2 animate-in">
                                                        <div className="bg-white/5 rounded-xl p-3 space-y-2 text-xs">
                                                            {/* 原始語音文字 */}
                                                            {expense.rawText && (
                                                                <div className="flex items-start gap-2">
                                                                    <MessageSquareText className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                                                                    <div>
                                                                        <span className="text-white/40">原始輸入：</span>
                                                                        <span className="text-white/70">{'\u300C'}{expense.rawText}{'\u300D'}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* 建立時間 */}
                                                            {expense.createdAt && (
                                                                <div className="flex items-center gap-2">
                                                                    <Clock className="w-3.5 h-3.5 text-white/30 shrink-0" />
                                                                    <span className="text-white/30">
                                                                        {new Date(expense.createdAt).toLocaleString('zh-TW')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* 刪除按鈕 */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
                                                            className="flex items-center gap-1.5 text-red-400/70 hover:text-red-400 text-xs transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            刪除此筆
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
})
