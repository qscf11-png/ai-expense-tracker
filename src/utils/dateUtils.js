/**
 * 取得今天的日期字串 YYYY-MM-DD
 */
export function getToday() {
    return formatDate(new Date());
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
export function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 格式化日期為中文顯示
 */
export function formatDateChinese(dateStr) {
    const d = new Date(dateStr);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 (${weekdays[d.getDay()]})`;
}

/**
 * 取得過去 N 天的日期範圍
 */
export function getDateRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    return {
        start: formatDate(start),
        end: formatDate(end),
    };
}

/**
 * 取得本週的日期範圍（週一到週日）
 */
export function getThisWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: formatDate(monday), end: formatDate(sunday) };
}

/**
 * 取得本月的日期範圍
 */
export function getThisMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatDate(start), end: formatDate(end) };
}

/**
 * 取得本年的日期範圍
 */
export function getThisYearRange() {
    const now = new Date();
    return {
        start: `${now.getFullYear()}-01-01`,
        end: `${now.getFullYear()}-12-31`,
    };
}

/**
 * 取得前一個同樣長度的日期範圍（用於趨勢比較）
 */
export function getPreviousPeriodRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end - start;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd.getTime() - diff);
    return { start: formatDate(prevStart), end: formatDate(prevEnd) };
}

/**
 * 產生日期序列（用於圖表 x 軸）
 */
export function generateDateSeries(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
        dates.push(formatDate(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * 產生月份序列（用於年度圖表）
 */
export function generateMonthSeries(year) {
    return Array.from({ length: 12 }, (_, i) => {
        const month = String(i + 1).padStart(2, '0');
        return `${year}-${month}`;
    });
}
