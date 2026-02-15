import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIES } from '../utils/categories';

// System prompt 引導 Gemini 從自然語言中擷取記帳資訊
const SYSTEM_PROMPT = `你是一個記帳助手。使用者會用自然語言描述一筆消費，你需要從中擷取以下資訊並以 JSON 格式回傳：

1. amount（數字）：消費金額
2. category（字串）：消費分類，必須是以下其中之一：${CATEGORIES.map((c) => c.id).join(', ')}
3. item（字串）：消費品項的簡短描述
4. note（字串）：額外備註（可為空字串）

分類對照：
- food：飲食相關（餐廳、便當、飲料、零食、超市食品等）
- transport：交通相關（計程車、公車、捷運、加油、停車等）
- shopping：購物相關（衣服、鞋子、日用品、電子產品等）
- housing：住居相關（房租、水電、瓦斯、網路、維修等）
- entertainment：娛樂相關（電影、遊戲、KTV、旅遊、訂閱服務等）
- medical：醫療相關（看診、藥品、保健食品等）
- education：教育相關（書籍、課程、學費等）
- other：其他無法歸類的消費

規則：
- 只回傳 JSON，不要加任何其他文字或 markdown 格式
- 金額若有「元」「塊」「NT」「$」等字樣，去掉只保留數字
- 如果無法判斷金額，amount 設為 0
- 如果無法判斷分類，category 設為 "other"
- item 請用簡短的中文描述（2-6 個字）

回傳格式範例：
{"amount": 80, "category": "food", "item": "午餐便當", "note": ""}`;

/**
 * 模型優先順序清單（由快/便宜 → 強大排列）
 * 當前面的模型 quota 耗盡時，自動嘗試下一個
 *
 * 排序策略：
 * 1. Flash 系列優先（速度快、quota 多）
 * 2. Lite 系列次之（更輕量）
 * 3. Pro 系列最後（最強但 quota 較珍貴）
 */
const MODEL_FALLBACK_CHAIN = [
    // --- Flash 系列 (速度快) ---
    { id: 'gemini-2.0-flash', name: 'Gemini 2 Flash', rpm: 15, rpd: 1500 },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2 Flash Lite', rpm: 15, rpd: 1500 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', rpm: 5, rpd: 20 },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', rpm: 10, rpd: 20 },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', rpm: 5, rpd: 20 },
    // --- Exp 系列 ---
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2 Flash Exp', rpm: 15, rpd: 1500 },
    // --- Pro 系列 (最強) ---
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', rpm: 15, rpd: 1500 },
    { id: 'gemini-2.0-pro-exp', name: 'Gemini 2 Pro Exp', rpm: 15, rpd: 1500 },
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', rpm: 15, rpd: 1500 },
];

// 記錄目前正在使用的模型索引（在 session 中持久化）
let currentModelIndex = 0;

// 記錄每個模型的錯誤時間戳（避免短時間內重複嘗試已知失敗的模型）
const modelCooldowns = {};
const COOLDOWN_MS = 60 * 1000; // 冷卻時間 60 秒

/**
 * 檢查模型是否在冷卻期間
 */
function isModelOnCooldown(modelId) {
    const cooldownUntil = modelCooldowns[modelId];
    if (!cooldownUntil) return false;
    if (Date.now() > cooldownUntil) {
        delete modelCooldowns[modelId];
        return false;
    }
    return true;
}

/**
 * 將模型加入冷卻期
 */
function setModelCooldown(modelId) {
    modelCooldowns[modelId] = Date.now() + COOLDOWN_MS;
}

/**
 * 判斷錯誤是否為 quota/rate limit 相關
 */
function isQuotaError(error) {
    const msg = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.httpStatus;
    return (
        status === 429 ||
        msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('resource exhausted') ||
        msg.includes('too many requests') ||
        msg.includes('429')
    );
}

/**
 * 取得目前使用的模型資訊
 */
export function getCurrentModel() {
    return MODEL_FALLBACK_CHAIN[currentModelIndex];
}

/**
 * 取得所有可用模型清單
 */
export function getModelList() {
    return MODEL_FALLBACK_CHAIN.map((m, i) => ({
        ...m,
        isActive: i === currentModelIndex,
        onCooldown: isModelOnCooldown(m.id),
    }));
}

/**
 * 手動設定使用的模型
 */
export function setModel(modelId) {
    const index = MODEL_FALLBACK_CHAIN.findIndex((m) => m.id === modelId);
    if (index !== -1) {
        currentModelIndex = index;
        return true;
    }
    return false;
}

/**
 * 使用 Gemini API 解析自然語言消費描述（含自動降級）
 * @param {string} text - 使用者的消費描述
 * @param {string} apiKey - Gemini API Key
 * @returns {Object} 解析後的消費資料 + 使用的模型資訊
 */
export async function parseExpenseWithAI(text, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError = null;

    // 從目前模型開始嘗試，遍歷所有可用模型
    for (let attempt = 0; attempt < MODEL_FALLBACK_CHAIN.length; attempt++) {
        const idx = (currentModelIndex + attempt) % MODEL_FALLBACK_CHAIN.length;
        const modelConfig = MODEL_FALLBACK_CHAIN[idx];

        // 跳過冷卻中的模型
        if (isModelOnCooldown(modelConfig.id)) {
            console.log(`⏳ ${modelConfig.name} 冷卻中，跳過`);
            continue;
        }

        try {
            console.log(`🤖 嘗試使用 ${modelConfig.name} (${modelConfig.id})`);

            const model = genAI.getGenerativeModel({
                model: modelConfig.id,
                systemInstruction: SYSTEM_PROMPT,
            });

            const result = await model.generateContent(text);
            const response = await result.response;
            const responseText = response.text().trim();

            // 嘗試解析 JSON（移除可能的 markdown 格式包裹）
            let jsonStr = responseText;
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }

            const parsed = JSON.parse(jsonStr);

            // 驗證分類是否有效
            const validCategories = CATEGORIES.map((c) => c.id);
            if (!validCategories.includes(parsed.category)) {
                parsed.category = 'other';
            }

            // 確保金額為正數
            parsed.amount = Math.abs(Number(parsed.amount) || 0);

            // 成功！更新目前使用的模型索引
            currentModelIndex = idx;

            // 附加模型資訊
            parsed._model = modelConfig.name;

            console.log(`✅ ${modelConfig.name} 解析成功`);
            return parsed;
        } catch (error) {
            lastError = error;

            if (isQuotaError(error)) {
                console.warn(`⚠️ ${modelConfig.name} quota 已用盡，切換到下一個模型...`);
                setModelCooldown(modelConfig.id);
                // 繼續嘗試下一個模型
            } else {
                // 非 quota 錯誤（如網路錯誤、JSON 解析失敗等），也嘗試下一個
                console.error(`❌ ${modelConfig.name} 發生錯誤:`, error.message);
                // 非 quota 錯誤不加冷卻，可能是暫時性的
            }
        }
    }

    // 所有模型都失敗
    console.error('所有模型都無法使用:', lastError);
    throw new Error('所有 AI 模型的額度都已用盡，請稍後再試或使用手動輸入');
}

/**
 * 驗證 API Key 是否有效
 */
export async function validateApiKey(apiKey) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // 用最輕量的模型驗證
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
        await model.countTokens('Hello');
        return true;
    } catch {
        // 如果 lite 失敗，嘗試標準版
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            await model.countTokens('Hello');
            return true;
        } catch {
            return false;
        }
    }
}
