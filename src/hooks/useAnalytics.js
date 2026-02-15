import { useMemo } from 'react';
import { CATEGORIES } from '../utils/categories';
import { calcPercentChange } from '../utils/formatters';

/**
 * 分析計算 Hook
 * 根據消費記錄計算各種統計數據
 */
export function useAnalytics(expenses, previousExpenses = []) {
    // 消費總額
    const totalAmount = useMemo(() => {
        return expenses.reduce((sum, e) => sum + e.amount, 0);
    }, [expenses]);

    // 前期總額
    const previousTotal = useMemo(() => {
        return previousExpenses.reduce((sum, e) => sum + e.amount, 0);
    }, [previousExpenses]);

    // 總額變化百分比
    const totalChange = useMemo(() => {
        return calcPercentChange(totalAmount, previousTotal);
    }, [totalAmount, previousTotal]);

    // 各分類統計
    const categoryStats = useMemo(() => {
        const stats = {};
        CATEGORIES.forEach((cat) => {
            stats[cat.id] = { ...cat, amount: 0, count: 0, percentage: 0 };
        });

        expenses.forEach((e) => {
            if (stats[e.category]) {
                stats[e.category].amount += e.amount;
                stats[e.category].count += 1;
            }
        });

        // 計算百分比
        if (totalAmount > 0) {
            Object.values(stats).forEach((s) => {
                s.percentage = Math.round((s.amount / totalAmount) * 100);
            });
        }

        return Object.values(stats).sort((a, b) => b.amount - a.amount);
    }, [expenses, totalAmount]);

    // 各分類前期比較
    const categoryChanges = useMemo(() => {
        const prevStats = {};
        previousExpenses.forEach((e) => {
            prevStats[e.category] = (prevStats[e.category] || 0) + e.amount;
        });

        return categoryStats.map((stat) => ({
            ...stat,
            change: calcPercentChange(stat.amount, prevStats[stat.id] || 0),
        }));
    }, [categoryStats, previousExpenses]);

    // 每日消費（用於趨勢圖）
    const dailyTotals = useMemo(() => {
        const totals = {};
        expenses.forEach((e) => {
            totals[e.date] = (totals[e.date] || 0) + e.amount;
        });
        return totals;
    }, [expenses]);

    // 每月消費（用於年度圖表）
    const monthlyTotals = useMemo(() => {
        const totals = {};
        expenses.forEach((e) => {
            const month = e.date.substring(0, 7);
            totals[month] = (totals[month] || 0) + e.amount;
        });
        return totals;
    }, [expenses]);

    // 每日各分類消費（用於堆疊圖）
    const dailyCategoryTotals = useMemo(() => {
        const totals = {};
        expenses.forEach((e) => {
            if (!totals[e.date]) totals[e.date] = {};
            totals[e.date][e.category] = (totals[e.date][e.category] || 0) + e.amount;
        });
        return totals;
    }, [expenses]);

    // 消費筆數
    const transactionCount = expenses.length;

    // 平均每筆消費
    const averageAmount = transactionCount > 0 ? Math.round(totalAmount / transactionCount) : 0;

    // 最高單筆消費
    const maxExpense = useMemo(() => {
        if (expenses.length === 0) return null;
        return expenses.reduce((max, e) => (e.amount > max.amount ? e : max), expenses[0]);
    }, [expenses]);

    return {
        totalAmount,
        previousTotal,
        totalChange,
        categoryStats,
        categoryChanges,
        dailyTotals,
        monthlyTotals,
        dailyCategoryTotals,
        transactionCount,
        averageAmount,
        maxExpense,
    };
}
