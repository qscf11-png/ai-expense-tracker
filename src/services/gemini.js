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
 * 使用 Gemini API 解析自然語言消費描述
 * @param {string} text - 使用者的消費描述
 * @param {string} apiKey - Gemini API Key
 * @returns {Object} 解析後的消費資料
 */
export async function parseExpenseWithAI(text, apiKey) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
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

        return parsed;
    } catch (error) {
        console.error('Gemini API 解析失敗:', error);
        throw new Error('AI 解析失敗，請嘗試手動輸入');
    }
}

/**
 * 驗證 API Key 是否有效
 */
export async function validateApiKey(apiKey) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        await model.countTokens('Hello');
        return true;
    } catch {
        return false;
    }
}
