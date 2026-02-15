import { useState, useEffect, useMemo } from 'react';
import { Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { getCategoryById } from '../utils/categories';
import { formatCurrency } from '../utils/formatters';
import { formatDateChinese, getToday, formatDate } from '../utils/dateUtils';
import { getExpensesByDateRange } from '../services/db';
import { deleteExpense } from '../services/db';

/**
 * 消費清單元件
 * 按日分組顯示消費記錄
 */
export default function ExpenseList() {
    const [expenses, setExpenses] = useState([]);
    const [expandedDate, setExpandedDate] = useState(getToday());
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

    // 按日分組
    const groupedByDate = useMemo(() => {
        const groups = {};
        expenses.forEach((e) => {
            if (!groups[e.date]) groups[e.date] = [];
            groups[e.date].push(e);
        });

        // 按日期降序排列
        return Object.entries(groups)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => ({
                date,
                items,
                total: items.reduce((sum, e) => sum + e.amount, 0),
            }));
    }, [expenses]);

    // 月總額
    const monthTotal = useMemo(() => {
        return expenses.reduce((sum, e) => sum + e.amount, 0);
    }, [expenses]);

    // 刪除記錄
    const handleDelete = async (id) => {
        await deleteExpense(id);
        loadMonthData();
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
                        {formatCurrency(monthTotal)}
                    </div>
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
                    {groupedByDate.map(({ date, items, total }) => (
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
                                        return (
                                            <div
                                                key={expense.id}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group"
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
                                                <div className="flex items-center gap-3">
                                                    <span className="text-white font-medium">
                                                        {formatCurrency(expense.amount)}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDelete(expense.id)}
                                                        className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
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
}
