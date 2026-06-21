/**
 * 匯率轉換工具
 * 使用 Open Exchange Rates API (免 Key 版本)
 */

const BASE_URL = 'https://open.er-api.com/v6/latest/TWD';
const CACHE_KEY = 'exchange_rates_twd';
const CACHE_DURATION = 1000 * 60 * 60; // 1 小時快取

/**
 * 取得最新匯率資料
 */
async function fetchRates() {
    // 檢查快取
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
        const { rates, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return rates;
        }
    }

    try {
        const response = await fetch(BASE_URL);
        const data = await response.json();
        
        if (data.result === 'success') {
            const ratesData = {
                rates: data.rates,
                timestamp: Date.now()
            };
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(ratesData));
            return data.rates;
        }
        throw new Error('無法取得匯率資料');
    } catch (error) {
        console.error('匯率 API 錯誤:', error);
        // 如果 API 失敗但有舊快取，先湊合著用
        if (cached) {
            return JSON.parse(cached).rates;
        }
        throw error;
    }
}

/**
 * 將外幣金額轉換為台幣
 * @param {number} amount - 外幣金額
 * @param {string} fromCurrency - 來源幣種 (如 'JPY', 'USD')
 * @returns {number} 轉換後的台幣金額 (四捨五入到整數)
 */
// 內建離線備援匯率（1 TWD = X 外幣）。匯率 API 連不到時改用這組近似值，確保換算永不失敗。
const FALLBACK_RATES = {
    JPY: 4.7,    // 1 TWD ≈ 4.7 日圓
    USD: 0.031,  // 1 TWD ≈ 0.031 美金
    CNY: 0.22,
    THB: 1.05,
    VND: 800,
    EUR: 0.029,
    HKD: 0.24,
};

export async function convertToTWD(amount, fromCurrency) {
    if (!fromCurrency || fromCurrency === 'TWD') return amount;

    // 先試線上匯率；連不到（旅途網路常見）就用內建備援，絕不丟錯、絕不卡住
    let rateToTWD;
    try {
        const rates = await fetchRates();
        rateToTWD = rates?.[fromCurrency];
    } catch (e) {
        console.warn('匯率 API 連不到，改用內建備援匯率', e);
    }
    if (!rateToTWD) rateToTWD = FALLBACK_RATES[fromCurrency];

    if (!rateToTWD) {
        console.warn(`不支援的幣種: ${fromCurrency}`);
        return amount;
    }

    // 台幣 = 外幣 / (1 台幣對該外幣的匯率)。例：1200 JPY / 4.7 ≈ 255 TWD
    return Math.round(amount / rateToTWD);
}

/**
 * 取得幣種符號或名稱
 */
export function getCurrencyLabel(currency) {
    const labels = {
        'TWD': 'NT$',
        'JPY': '日幣 (JPY)',
        'USD': '美金 (USD)',
        'CNY': '人民幣 (CNY)',
        'THB': '泰銖 (THB)',
        'VND': '越南盾 (VND)'
    };
    return labels[currency] || currency;
}
