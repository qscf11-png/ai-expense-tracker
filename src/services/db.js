// 資料庫服務 — Firestore 雲端 + IndexedDB 本機
//
// 策略：
// - 登入後：使用 Firestore（自動離線快取）
// - 未登入：使用 IndexedDB（本機儲存）
//
import Dexie from 'dexie';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';

// ============================================================
// IndexedDB (本機離線用，未登入時使用)
// ============================================================
const localDb = new Dexie('ExpenseTrackerDB');
localDb.version(1).stores({
    expenses: '++id, date, category, createdAt',
});
// v2：records 加入 type 欄位（expense/income），新增 recurring 固定收支表
localDb.version(2).stores({
    expenses: '++id, date, category, createdAt, type',
    recurring: '++id, type, enabled',
});

// ============================================================
// 使用者狀態管理
// ============================================================
let currentUserId = null;

/**
 * 設定目前登入的使用者 ID
 * @param {string|null} userId - Firebase Auth 的 user.uid
 */
export function setCurrentUser(userId) {
    currentUserId = userId;
}

/**
 * 取得使用者的 Firestore 消費記錄集合路徑
 */
function getExpensesCollection() {
    if (!currentUserId) throw new Error('未登入');
    return collection(firestore, 'users', currentUserId, 'expenses');
}

/**
 * 取得使用者的 Firestore 固定收支集合路徑
 */
function getRecurringCollection() {
    if (!currentUserId) throw new Error('未登入');
    return collection(firestore, 'users', currentUserId, 'recurring');
}

// ============================================================
// CRUD 操作（自動判斷使用 Firestore 或 IndexedDB）
// ============================================================

/**
 * 新增一筆消費記錄
 */
export async function addExpense(expense) {
    const data = {
        ...expense,
        createdAt: new Date().toISOString(),
    };

    if (currentUserId) {
        // Firestore
        const docRef = await addDoc(getExpensesCollection(), data);
        return docRef.id;
    } else {
        // IndexedDB
        return await localDb.expenses.add(data);
    }
}

/**
 * 取得指定日期範圍的消費記錄
 */
export async function getExpensesByDateRange(startDate, endDate) {
    if (currentUserId) {
        const q = query(
            getExpensesCollection(),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
        return await localDb.expenses
            .where('date')
            .between(startDate, endDate, true, true)
            .toArray();
    }
}

/**
 * 取得指定日期的消費記錄
 */
export async function getExpensesByDate(date) {
    if (currentUserId) {
        const q = query(
            getExpensesCollection(),
            where('date', '==', date)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
        return await localDb.expenses.where('date').equals(date).toArray();
    }
}

/**
 * 取得所有消費記錄
 */
export async function getAllExpenses() {
    if (currentUserId) {
        const q = query(getExpensesCollection(), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
        return await localDb.expenses.orderBy('date').reverse().toArray();
    }
}

/**
 * 更新消費記錄
 */
export async function updateExpense(id, updates) {
    if (currentUserId) {
        const docRef = doc(firestore, 'users', currentUserId, 'expenses', id);
        await updateDoc(docRef, updates);
    } else {
        await localDb.expenses.update(id, updates);
    }
}

/**
 * 刪除消費記錄
 */
export async function deleteExpense(id) {
    if (currentUserId) {
        const docRef = doc(firestore, 'users', currentUserId, 'expenses', id);
        await deleteDoc(docRef);
    } else {
        await localDb.expenses.delete(id);
    }
}

// ============================================================
// 固定收支（Recurring）CRUD 與自動入帳
// ============================================================

/**
 * 新增固定收支項目
 * @param {Object} item - { name, type: 'expense'|'income', amount, category, dayOfMonth }
 */
export async function addRecurringItem(item) {
    const data = {
        ...item,
        enabled: true,
        lastApplied: null,
        createdAt: new Date().toISOString(),
    };
    if (currentUserId) {
        const docRef = await addDoc(getRecurringCollection(), data);
        return docRef.id;
    } else {
        return await localDb.recurring.add(data);
    }
}

/**
 * 取得所有固定收支項目
 */
export async function getRecurringItems() {
    if (currentUserId) {
        const snapshot = await getDocs(getRecurringCollection());
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
        return await localDb.recurring.toArray();
    }
}

/**
 * 更新固定收支項目
 */
export async function updateRecurringItem(id, updates) {
    if (currentUserId) {
        const docRef = doc(firestore, 'users', currentUserId, 'recurring', id);
        await updateDoc(docRef, updates);
    } else {
        await localDb.recurring.update(id, updates);
    }
}

/**
 * 刪除固定收支項目
 */
export async function deleteRecurringItem(id) {
    if (currentUserId) {
        const docRef = doc(firestore, 'users', currentUserId, 'recurring', id);
        await deleteDoc(docRef);
    } else {
        await localDb.recurring.delete(id);
    }
}

/** 取得 YYYY-MM 的下一個月 */
function nextMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** 取得某月排程日期（超過月底則取月底，如 2 月 31 號 → 2/28） */
function scheduledDateFor(ym, dayOfMonth) {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const day = Math.min(dayOfMonth, lastDay);
    return `${ym}-${String(day).padStart(2, '0')}`;
}

/**
 * 自動入帳：檢查所有啟用的固定收支項目，補記到期未記錄的月份
 * 應在 App 啟動時呼叫
 * @returns {number} 本次自動記錄的筆數
 */
export async function applyRecurringItems() {
    const items = await getRecurringItems();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const currentMonth = todayStr.slice(0, 7);
    let appliedCount = 0;

    for (const item of items) {
        if (!item.enabled) continue;

        // 從上次入帳的下一個月開始補記；
        // 從未入帳則從回溯起始月（startMonth）開始，未設定則從建立當月開始
        let cursor = item.lastApplied
            ? nextMonth(item.lastApplied)
            : (item.startMonth || (item.createdAt || todayStr).slice(0, 7));
        let last = item.lastApplied;

        while (cursor <= currentMonth) {
            const scheduled = scheduledDateFor(cursor, item.dayOfMonth);
            if (scheduled > todayStr) break; // 本月排程日尚未到

            await addExpense({
                amount: item.amount,
                category: item.category,
                item: item.name,
                note: item.type === 'income' ? '🔁 固定收入' : '🔁 固定支出',
                date: scheduled,
                type: item.type,
                recurringId: item.id,
            });
            last = cursor;
            appliedCount++;
            cursor = nextMonth(cursor);
        }

        if (last !== item.lastApplied) {
            await updateRecurringItem(item.id, { lastApplied: last });
        }
    }
    return appliedCount;
}

// ============================================================
// 匯出 / 匯入
// ============================================================

/**
 * 匯出所有資料為 JSON（v2 格式：含收支記錄與固定項目定義）
 */
export async function exportData() {
    const records = await getAllExpenses();
    const recurring = await getRecurringItems();
    return JSON.stringify({
        version: 2,
        exportedAt: new Date().toISOString(),
        records,
        recurring,
    }, null, 2);
}

/**
 * 匯入 JSON 資料（相容舊版純陣列格式與 v2 物件格式）
 */
export async function importData(jsonString) {
    const parsed = JSON.parse(jsonString);
    // 舊格式為純陣列；v2 格式為 { records, recurring }
    const records = Array.isArray(parsed) ? parsed : (parsed.records || []);
    const recurring = Array.isArray(parsed) ? [] : (parsed.recurring || []);

    if (currentUserId) {
        // Firestore 批次寫入（每批最多 500 筆）
        const batchSize = 500;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = writeBatch(firestore);
            const chunk = records.slice(i, i + batchSize);
            chunk.forEach((item) => {
                const { id: _id, ...rest } = item;
                const docRef = doc(getExpensesCollection());
                batch.set(docRef, rest);
            });
            await batch.commit();
        }
        for (const item of recurring) {
            const { id: _id, ...rest } = item;
            await addDoc(getRecurringCollection(), rest);
        }
    } else {
        await localDb.expenses.bulkAdd(records.map(({ id: _id, ...rest }) => rest));
        if (recurring.length > 0) {
            await localDb.recurring.bulkAdd(recurring.map(({ id: _id, ...rest }) => rest));
        }
    }
}

/**
 * 匯出所有收支記錄為 CSV（含 BOM，Excel 可直接開啟）
 */
export async function exportCSV() {
    const records = await getAllExpenses();
    const header = ['日期', '類型', '分類', '品項', '金額(TWD)', '備註', '原始輸入', '建立時間'];
    const rows = records.map((r) => [
        r.date,
        r.type === 'income' ? '收入' : '支出',
        r.category || '',
        r.item || '',
        r.amount,
        r.note || '',
        r.rawText || '',
        r.createdAt || '',
    ]);
    const escape = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
    return '﻿' + csv; // BOM 讓 Excel 正確辨識 UTF-8
}

/**
 * 清除所有資料
 */
export async function clearAllData() {
    if (currentUserId) {
        const snapshot = await getDocs(getExpensesCollection());
        const batchSize = 500;
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = writeBatch(firestore);
            docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
        // 固定收支項目一併清除
        const recurringSnapshot = await getDocs(getRecurringCollection());
        for (let i = 0; i < recurringSnapshot.docs.length; i += batchSize) {
            const batch = writeBatch(firestore);
            recurringSnapshot.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    } else {
        await localDb.expenses.clear();
        await localDb.recurring.clear();
    }
}

/**
 * 將本機 IndexedDB 資料遷移到 Firestore（登入後首次同步）
 */
export async function migrateLocalToCloud() {
    if (!currentUserId) return 0;

    const localExpenses = await localDb.expenses.toArray();

    // 固定收支項目也一併遷移
    const localRecurring = await localDb.recurring.toArray();
    for (const item of localRecurring) {
        const { id: _id, ...rest } = item;
        await addDoc(getRecurringCollection(), rest);
    }
    if (localRecurring.length > 0) await localDb.recurring.clear();

    if (localExpenses.length === 0) return 0;

    // 批次上傳到 Firestore
    const batchSize = 500;
    for (let i = 0; i < localExpenses.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const chunk = localExpenses.slice(i, i + batchSize);
        chunk.forEach((item) => {
            const { id: _id, ...rest } = item;
            const docRef = doc(getExpensesCollection());
            batch.set(docRef, rest);
        });
        await batch.commit();
    }

    // 清除本機資料（避免重複）
    await localDb.expenses.clear();

    return localExpenses.length;
}

export default localDb;
