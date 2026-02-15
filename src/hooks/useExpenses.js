import { useState, useCallback, useEffect } from 'react';
import {
    addExpense,
    getExpensesByDateRange,
    getExpensesByDate,
    getAllExpenses,
    updateExpense,
    deleteExpense,
} from '../services/db';
import { getToday } from '../utils/dateUtils';

/**
 * 消費資料管理 Hook
 */
export function useExpenses() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);

    // 載入今天的消費記錄
    const loadToday = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getExpensesByDate(getToday());
            setExpenses(data);
        } finally {
            setLoading(false);
        }
    }, []);

    // 載入指定日期範圍
    const loadByRange = useCallback(async (start, end) => {
        setLoading(true);
        try {
            const data = await getExpensesByDateRange(start, end);
            setExpenses(data);
        } finally {
            setLoading(false);
        }
    }, []);

    // 載入所有記錄
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAllExpenses();
            setExpenses(data);
        } finally {
            setLoading(false);
        }
    }, []);

    // 新增
    const add = useCallback(async (expense) => {
        await addExpense(expense);
    }, []);

    // 更新
    const update = useCallback(async (id, updates) => {
        await updateExpense(id, updates);
    }, []);

    // 刪除
    const remove = useCallback(async (id) => {
        await deleteExpense(id);
    }, []);

    return {
        expenses,
        loading,
        loadToday,
        loadByRange,
        loadAll,
        add,
        update,
        remove,
    };
}
