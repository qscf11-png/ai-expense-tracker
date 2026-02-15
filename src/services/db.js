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

/**
 * 匯出所有資料為 JSON
 */
export async function exportData() {
    const expenses = await getAllExpenses();
    return JSON.stringify(expenses, null, 2);
}

/**
 * 匯入 JSON 資料
 */
export async function importData(jsonString) {
    const data = JSON.parse(jsonString);

    if (currentUserId) {
        // Firestore 批次寫入（每批最多 500 筆）
        const batchSize = 500;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = writeBatch(firestore);
            const chunk = data.slice(i, i + batchSize);
            chunk.forEach((item) => {
                const { id: _id, ...rest } = item;
                const docRef = doc(getExpensesCollection());
                batch.set(docRef, rest);
            });
            await batch.commit();
        }
    } else {
        await localDb.expenses.bulkAdd(data.map(({ id: _id, ...rest }) => rest));
    }
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
    } else {
        await localDb.expenses.clear();
    }
}

/**
 * 將本機 IndexedDB 資料遷移到 Firestore（登入後首次同步）
 */
export async function migrateLocalToCloud() {
    if (!currentUserId) return 0;

    const localExpenses = await localDb.expenses.toArray();
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
