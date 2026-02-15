/**
 * 格式化金額（加千分位、NT$ 前綴）
 */
export function formatCurrency(amount) {
    return `NT$ ${Number(amount).toLocaleString('zh-TW')}`;
}

/**
 * 計算百分比變化
 */
export function calcPercentChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

/**
 * 格式化百分比變化為帶符號字串
 */
export function formatPercentChange(change) {
    if (change > 0) return `+${change}%`;
    if (change < 0) return `${change}%`;
    return '0%';
}
