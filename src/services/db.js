import Dexie from 'dexie';

// 初始化 IndexedDB 資料庫
const db = new Dexie('ExpenseTrackerDB');

db.version(1).stores({
    // 消費記錄表：自動遞增 id，索引 date 和 category 方便查詢
    expenses: '++id, date, category, createdAt',
});

/**
 * 新增一筆消費記錄
 * @param {Object} expense - 消費資料
 * @param {number} expense.amount - 金額
 * @param {string} expense.category - 分類
 * @param {string} expense.item - 品項名稱
 * @param {string} [expense.note] - 備註
 * @param {string} expense.date - 日期 YYYY-MM-DD
 */
export async function addExpense(expense) {
    return await db.expenses.add({
        ...expense,
        createdAt: new Date().toISOString(),
    });
}

/**
 * 取得指定日期範圍的消費記錄
 * @param {string} startDate - 起始日期 YYYY-MM-DD
 * @param {string} endDate - 結束日期 YYYY-MM-DD
 */
export async function getExpensesByDateRange(startDate, endDate) {
    return await db.expenses
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();
}

/**
 * 取得指定日期的消費記錄
 */
export async function getExpensesByDate(date) {
    return await db.expenses.where('date').equals(date).toArray();
}

/**
 * 取得所有消費記錄
 */
export async function getAllExpenses() {
    return await db.expenses.orderBy('date').reverse().toArray();
}

/**
 * 更新消費記錄
 */
export async function updateExpense(id, updates) {
    return await db.expenses.update(id, updates);
}

/**
 * 刪除消費記錄
 */
export async function deleteExpense(id) {
    return await db.expenses.delete(id);
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
    await db.expenses.bulkAdd(data.map(({ id, ...rest }) => rest));
}

/**
 * 清除所有資料
 */
export async function clearAllData() {
    await db.expenses.clear();
}

export default db;
