import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIES } from '../utils/categories';
import { convertToTWD } from '../utils/exchangeRate';

// ====== System Prompt ======

const SYSTEM_PROMPT = `你是一個記帳助手。使用者會用自然語言描述一筆消費，你需要從中擷取以下資訊並以 JSON 格式回傳：

1. amount（數字）：消費金額
2. currency（字串）：消費幣種，預設為 "TWD"，支援：TWD, JPY, USD, CNY, THB, VND
3. category（字串）：消費分類，必須是以下其中之一：${CATEGORIES.map((c) => c.id).join(', ')}
4. item（字串）：消費品項的簡短描述
5. note（字串）：額外備註（可為空字串）
6. currencyMentioned（布林）：使用者是否在文字中「明確說出幣別」（例：日幣、日圓、美金、台幣、人民幣、泰銖、越南盾）。有明確說出→true；只給數字、沒提到任何幣別→false

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
- 幣種偵測：根據使用者提到的「日幣、日圓、JPY」、「美金、USD、dollars」、「人民幣、RMB、CNY」、「泰銖、THB」、「越南盾、VND」來判斷。若未提及則預設為 "TWD"。
- 如果無法判斷金額，amount 設為 0
- 如果無法判斷分類，category 設為 "other"
- item 請用簡短的中文描述（2-6 個字）

回傳格式範例：
{"amount": 1000, "currency": "JPY", "currencyMentioned": true, "category": "food", "item": "拉麵", "note": ""}
（若使用者只說「拉麵 1000」沒提幣別，則 currencyMentioned 為 false、currency 預設 "TWD"）`;

// ====== GAISF 模型清單與 API 版本 ======

export const GAISF_MODELS = [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', apiVersion: '2024-10-21' },
    { id: 'gpt-4o', name: 'GPT-4o', apiVersion: '2025-03-01-preview' },
    { id: 'gpt-o3-mini', name: 'GPT o3-mini', apiVersion: '2024-12-01-preview' },
    { id: 'deepseek-r1-0528', name: 'DeepSeek R1', apiVersion: '2024-10-21' },
    { id: 'deepseek-v3-2', name: 'DeepSeek V3', apiVersion: '2024-05-01-preview' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', apiVersion: '2024-10-21' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok 4 Fast', apiVersion: '2024-05-01-preview' },
    { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking', apiVersion: '2024-10-21' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', apiVersion: '2025-04-01-preview' },
];

// ====== Provider 常數 ======

export const PROVIDERS = { GEMINI: 'gemini', GAISF: 'gaisf' };

// ====== GAISF URL 建構（自動偵測環境） ======

const GAISF_VERCEL_PROXY = 'https://twse-proxy.vercel.app/api/gaisf';
const GAISF_LOCAL_PROXY = '/api/gaisf';
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');

function buildGaisfUrl(modelId, apiVersion) {
    if (isProduction) {
        // 生產環境：透過 Vercel Serverless Function 反向代理
        const deployPath = `/openai/deployments/${modelId}/chat/completions`;
        return `${GAISF_VERCEL_PROXY}?path=${encodeURIComponent(deployPath)}&api-version=${apiVersion}`;
    }
    // 本機開發：Vite dev server proxy
    return `${GAISF_LOCAL_PROXY}/openai/deployments/${modelId}/chat/completions?api-version=${apiVersion}`;
}

// ====== GAISF 呼叫核心 ======

async function callGaisf(messages, modelId, apiKey) {
    const modelConfig = GAISF_MODELS.find((m) => m.id === modelId);
    const apiVersion = modelConfig?.apiVersion || '2024-10-21';
    const url = buildGaisfUrl(modelId, apiVersion);

    console.log(`🤖 GAISF 呼叫 ${modelId} (api-version: ${apiVersion})`);

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({ messages, temperature: 0.3, max_tokens: 512 }),
    });

    if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        if (resp.status === 401 || resp.status === 403) throw new Error('GAISF API Key 無效或權限不足');
        if (resp.status === 429) throw Object.assign(new Error('GAISF 配額超限'), { status: 429 });
        if (resp.status === 404) throw new Error(`模型 ${modelId} 不可用`);
        throw new Error(`GAISF HTTP ${resp.status}: ${errBody.substring(0, 100)}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
}

// ====== 動態模型管理（Gemini 用） ======

let selectedModelId = localStorage.getItem('gemini_selected_model') || '';
let cachedAvailableModels = [];
const modelCooldowns = {};
const COOLDOWN_MS = 60 * 1000;

function isModelOnCooldown(modelId) {
    const cooldownUntil = modelCooldowns[modelId];
    if (!cooldownUntil) return false;
    if (Date.now() > cooldownUntil) {
        delete modelCooldowns[modelId];
        return false;
    }
    return true;
}

function setModelCooldown(modelId) {
    modelCooldowns[modelId] = Date.now() + COOLDOWN_MS;
}

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

// ====== 對外匯出 API ======

/**
 * 取得目前的 Provider
 */
export function getProvider() {
    const source = localStorage.getItem('gemini_key_source') || 'custom';
    return source === 'dage' ? PROVIDERS.GAISF : PROVIDERS.GEMINI;
}

/**
 * 取得 / 設定選定的模型 ID
 */
export function getSelectedModel() {
    const provider = getProvider();
    if (provider === PROVIDERS.GAISF) {
        return localStorage.getItem('gaisf_selected_model') || 'gpt-4o-mini';
    }
    return localStorage.getItem('gemini_selected_model') || '';
}

export function setSelectedModel(modelId) {
    const provider = getProvider();
    if (provider === PROVIDERS.GAISF) {
        localStorage.setItem('gaisf_selected_model', modelId);
    } else {
        selectedModelId = modelId;
        localStorage.setItem('gemini_selected_model', modelId);
    }
}

export function getCachedModels() {
    return cachedAvailableModels;
}

/**
 * 用 REST API 取得 Gemini 可用模型列表
 */
export async function fetchAvailableModels(apiKey) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const models = data.models
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => ({
                id: m.name.replace('models/', ''),
                name: m.displayName || m.name.replace('models/', ''),
                description: m.description || '',
            }))
            .sort((a, b) => {
                const priority = (id) => {
                    if (id.includes('flash-lite')) return 1;
                    if (id.includes('flash')) return 0;
                    if (id.includes('pro')) return 2;
                    return 4;
                };
                return priority(a.id) - priority(b.id);
            });

        cachedAvailableModels = models;
        return models;
    } catch (error) {
        console.warn('取得 Gemini 模型列表失敗:', error);
        return [];
    }
}

/**
 * 驗證 Gemini API Key
 */
export async function validateGeminiKey(apiKey) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (response.ok) {
            const data = await response.json();
            const models = data.models
                .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
                .map((m) => ({
                    id: m.name.replace('models/', ''),
                    name: m.displayName || m.name.replace('models/', ''),
                }))
                .sort((a, b) => {
                    const p = (id) => (id.includes('flash') ? 0 : id.includes('pro') ? 2 : 4);
                    return p(a.id) - p(b.id);
                });
            cachedAvailableModels = models;
            return { valid: true, models };
        }
        const errorData = await response.json().catch(() => ({}));
        return { valid: false, error: errorData?.error?.message || `HTTP ${response.status}` };
    } catch (err) {
        return { valid: false, error: err.message };
    }
}

/**
 * 驗證 GAISF API Key（用 gpt-4o-mini 發最小請求測試）
 */
export async function validateGaisfKey(apiKey) {
    try {
        const url = buildGaisfUrl('gpt-4o-mini', '2024-10-21');
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
            }),
        });
        if (!resp.ok) {
            const errBody = await resp.text().catch(() => '');
            throw new Error(`HTTP ${resp.status}: ${errBody.substring(0, 100)}`);
        }
        console.log('✅ GAISF API Key 驗證成功');
        return { valid: true, models: GAISF_MODELS };
    } catch (error) {
        console.warn('❌ GAISF 驗證失敗:', error.message);
        return { valid: false, error: error.message };
    }
}

/**
 * 統一驗證入口：自動根據 provider 選擇驗證方式
 */
export async function validateApiKey(apiKey, provider) {
    if (provider === PROVIDERS.GAISF) return validateGaisfKey(apiKey);
    return validateGeminiKey(apiKey);
}

/**
 * 解析自然語言消費描述（雙引擎路由）
 */
export async function parseExpenseWithAI(text, apiKey, preferredCurrency = 'AUTO') {
    const provider = getProvider();

    // 構建提示
    let finalPrompt = text;
    if (preferredCurrency && preferredCurrency !== 'AUTO') {
        finalPrompt = `使用者目前的預選幣種是 ${preferredCurrency}。如果輸入文字只包含數字或未明確提及幣種，請解析為 ${preferredCurrency}。輸入內容：${text}`;
    }

    // ===== GAISF 路徑 =====
    if (provider === PROVIDERS.GAISF) {
        const modelId = localStorage.getItem('gaisf_selected_model') || 'gpt-4o-mini';
        const modelsToTry = [
            modelId,
            ...GAISF_MODELS.filter((m) => m.id !== modelId).map((m) => m.id),
        ];

        let lastError = null;
        for (const mid of modelsToTry) {
            if (isModelOnCooldown(mid)) continue;
            try {
                const responseText = await callGaisf(
                    [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: finalPrompt },
                    ],
                    mid,
                    apiKey
                );

                let jsonStr = responseText.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                }

                const parsed = JSON.parse(jsonStr);
                const validCategories = CATEGORIES.map((c) => c.id);
                if (!validCategories.includes(parsed.category)) parsed.category = 'other';

                parsed.currency = parsed.currency?.toUpperCase() || 'TWD';
                // 預選幣種覆寫：有鎖定幣種(非AUTO)且未明確說出幣別 → 以鎖定幣種為準
                if (preferredCurrency && preferredCurrency !== 'AUTO' &&
                    !(parsed.currencyMentioned === true || parsed.currencyMentioned === 'true')) {
                    parsed.currency = preferredCurrency;
                }
                parsed.originalAmount = Math.abs(Number(parsed.amount) || 0);
                if (parsed.currency !== 'TWD') {
                    parsed.amount = await convertToTWD(parsed.originalAmount, parsed.currency);
                } else {
                    parsed.amount = parsed.originalAmount;
                }

                const modelName = GAISF_MODELS.find((m) => m.id === mid)?.name || mid;
                parsed._model = `GAISF ${modelName}`;
                console.log(`✅ GAISF ${modelName} 解析成功`);
                return parsed;
            } catch (error) {
                lastError = error;
                if (isQuotaError(error)) {
                    setModelCooldown(mid);
                    console.warn(`⚠️ GAISF ${mid} 配額超限，嘗試下一個`);
                } else {
                    console.error(`❌ GAISF ${mid} 錯誤:`, error.message);
                }
            }
        }
        throw new Error(lastError?.message || '所有 GAISF 模型都無法使用，請確認 API Key');
    }

    // ===== Gemini 路徑 =====
    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError = null;

    let modelsToTry = [];
    if (cachedAvailableModels.length > 0) {
        const sel = localStorage.getItem('gemini_selected_model') || '';
        if (sel) {
            const selected = cachedAvailableModels.find((m) => m.id === sel);
            const others = cachedAvailableModels.filter((m) => m.id !== sel);
            if (selected) modelsToTry.push(selected);
            modelsToTry.push(...others);
        } else {
            modelsToTry = [...cachedAvailableModels];
        }
    } else {
        modelsToTry.push(
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        );
    }

    for (const modelConfig of modelsToTry) {
        if (isModelOnCooldown(modelConfig.id)) continue;
        try {
            console.log(`🤖 Gemini 嘗試 ${modelConfig.name} (${modelConfig.id})`);
            const model = genAI.getGenerativeModel({
                model: modelConfig.id,
                systemInstruction: SYSTEM_PROMPT,
            });
            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            const responseText = response.text().trim();

            let jsonStr = responseText;
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }

            const parsed = JSON.parse(jsonStr);
            const validCategories = CATEGORIES.map((c) => c.id);
            if (!validCategories.includes(parsed.category)) parsed.category = 'other';

            parsed.currency = parsed.currency?.toUpperCase() || 'TWD';
            // 預選幣種覆寫：有鎖定幣種(非AUTO)且未明確說出幣別 → 以鎖定幣種為準
            if (preferredCurrency && preferredCurrency !== 'AUTO' &&
                !(parsed.currencyMentioned === true || parsed.currencyMentioned === 'true')) {
                parsed.currency = preferredCurrency;
            }
            parsed.originalAmount = Math.abs(Number(parsed.amount) || 0);
            if (parsed.currency !== 'TWD') {
                parsed.amount = await convertToTWD(parsed.originalAmount, parsed.currency);
            } else {
                parsed.amount = parsed.originalAmount;
            }

            parsed._model = modelConfig.name;
            console.log(`✅ ${modelConfig.name} 解析成功`);
            return parsed;
        } catch (error) {
            lastError = error;
            if (isQuotaError(error)) {
                setModelCooldown(modelConfig.id);
            }
        }
    }

    throw new Error('所有 AI 模型都無法使用，請到設定頁面確認 API Key 與模型選擇');
}
