// 消費分類定義
export const CATEGORIES = [
    { id: 'food', name: '飲食', emoji: '🍽️', color: '#f97316' },
    { id: 'transport', name: '交通', emoji: '🚗', color: '#3b82f6' },
    { id: 'shopping', name: '購物', emoji: '🛒', color: '#a855f7' },
    { id: 'housing', name: '住居', emoji: '🏠', color: '#10b981' },
    { id: 'entertainment', name: '娛樂', emoji: '🎮', color: '#ec4899' },
    { id: 'medical', name: '醫療', emoji: '🏥', color: '#ef4444' },
    { id: 'education', name: '教育', emoji: '📚', color: '#06b6d4' },
    { id: 'other', name: '其他', emoji: '💼', color: '#6b7280' },
];

// 收入分類定義
export const INCOME_CATEGORIES = [
    { id: 'salary', name: '薪資', emoji: '💰', color: '#10b981' },
    { id: 'bonus', name: '獎金', emoji: '🎁', color: '#f59e0b' },
    { id: 'investment', name: '投資', emoji: '📈', color: '#06b6d4' },
    { id: 'side_job', name: '副業', emoji: '💻', color: '#a855f7' },
    { id: 'other_income', name: '其他收入', emoji: '💵', color: '#6b7280' },
];

/**
 * 根據分類 ID 取得分類資訊（支出與收入分類皆可查詢）
 */
export function getCategoryById(id) {
    return (
        CATEGORIES.find((c) => c.id === id) ||
        INCOME_CATEGORIES.find((c) => c.id === id) ||
        CATEGORIES[CATEGORIES.length - 1]
    );
}

/**
 * 取得分類名稱（含 emoji）
 */
export function getCategoryLabel(id) {
    const cat = getCategoryById(id);
    return `${cat.emoji} ${cat.name}`;
}

/**
 * 取得分類顏色
 */
export function getCategoryColor(id) {
    return getCategoryById(id).color;
}
