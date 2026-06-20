import { useState, useEffect } from 'react';
import { Key, Download, Upload, Trash2, CheckCircle2, XCircle, Shield, LogOut, LogIn, Cloud, Smartphone, Eye, EyeOff, Users, User, Cpu, ChevronDown, Zap, Sparkles, RefreshCw } from 'lucide-react';
import { validateApiKey, fetchAvailableModels, getSelectedModel, setSelectedModel, GAISF_MODELS, PROVIDERS } from '../services/gemini';
import { exportData, importData, clearAllData } from '../services/db';
import { signInWithGoogle, logOut } from '../services/auth';

// 建置時間（由 vite define 注入），用來在 App 內顯示目前版本，方便判斷是否已更新到最新
const BUILD_LABEL = (() => {
    try {
        const iso = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
        return iso ? new Date(iso).toLocaleString('zh-TW', { hour12: false }) : 'dev';
    } catch {
        return 'dev';
    }
})();

const KEY_SOURCES = [
    { id: 'custom', label: '自己的 Key', icon: User, color: 'cyan' },
    { id: 'dage', label: '達哥的 Key', icon: Users, color: 'amber' },
];

/**
 * 設定頁面
 */
export default function Settings({ user }) {
    const [keySource, setKeySource] = useState('custom');
    const [customKey, setCustomKey] = useState('');
    const [dageKey, setDageKey] = useState('');
    const [keyStatus, setKeyStatus] = useState('idle');
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [message, setMessage] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);

    const [validationError, setValidationError] = useState('');

    // 模型選擇相關
    const [availableModels, setAvailableModels] = useState([]);
    const [selectedModel, setSelectedModelState] = useState(getSelectedModel());
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [modelsLoading, setModelsLoading] = useState(false);

    // 載入已儲存的 API Key
    useEffect(() => {
        const source = localStorage.getItem('gemini_key_source') || 'custom';
        const savedCustom = localStorage.getItem('gemini_api_key_custom') || localStorage.getItem('gemini_api_key') || '';
        const savedDage = localStorage.getItem('gemini_api_key_dage') || '';
        setKeySource(source);
        setCustomKey(savedCustom);
        setDageKey(savedDage);

        // 如果已有 Key，自動載入可用模型
        const activeKeyVal = source === 'dage' ? savedDage : savedCustom;
        if (activeKeyVal) {
            setKeyStatus('valid');
            if (source === 'dage') {
                // GAISF 模型是固定清單
                setAvailableModels(GAISF_MODELS.map((m) => ({ ...m })));
            } else {
                loadModels(activeKeyVal);
            }
        }
    }, []);

    const activeKey = keySource === 'dage' ? dageKey : customKey;
    const setActiveKey = keySource === 'dage' ? setDageKey : setCustomKey;
    const storageKey = keySource === 'dage' ? 'gemini_api_key_dage' : 'gemini_api_key_custom';

    // 載入可用模型
    const loadModels = async (apiKey) => {
        setModelsLoading(true);
        const models = await fetchAvailableModels(apiKey);
        setAvailableModels(models);
        setModelsLoading(false);
    };

    // 切換 Key 來源
    const handleSwitchSource = (sourceId) => {
        setKeySource(sourceId);
        setKeyStatus('idle');
        setShowKey(false);
        setAvailableModels([]);
        setShowModelPicker(false);
        localStorage.setItem('gemini_key_source', sourceId);

        const key = sourceId === 'dage'
            ? localStorage.getItem('gemini_api_key_dage') || ''
            : localStorage.getItem('gemini_api_key_custom') || localStorage.getItem('gemini_api_key') || '';
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            window.dispatchEvent(new Event('apikey-changed'));
            setKeyStatus('valid');
            if (sourceId === 'dage') {
                setAvailableModels(GAISF_MODELS.map((m) => ({ ...m })));
            } else {
                loadModels(key);
            }
        } else {
            localStorage.removeItem('gemini_api_key');
            window.dispatchEvent(new Event('apikey-changed'));
        }
    };

    // 儲存 API Key（含驗證）
    const handleSaveKey = async () => {
        if (!activeKey.trim()) {
            localStorage.removeItem(storageKey);
            localStorage.removeItem('gemini_api_key');
            setKeyStatus('idle');
            setAvailableModels([]);
            return;
        }

        setKeyStatus('checking');
        setValidationError('');
        const provider = keySource === 'dage' ? PROVIDERS.GAISF : PROVIDERS.GEMINI;
        const result = await validateApiKey(activeKey.trim(), provider);
        if (result.valid) {
            localStorage.setItem(storageKey, activeKey.trim());
            localStorage.setItem('gemini_api_key', activeKey.trim());
            window.dispatchEvent(new Event('apikey-changed'));
            setKeyStatus('valid');
            setValidationError('');
            setAvailableModels(result.models || []);
            const engineName = provider === PROVIDERS.GAISF ? 'GAISF' : 'Gemini';
            showMessage(`✅ ${engineName} 驗證成功！共 ${result.models?.length || 0} 個可用模型`);
        } else {
            setKeyStatus('invalid');
            setValidationError(result.error || '未知錯誤');
            showMessage(`❌ 驗證失敗`);
        }
    };

    // 跳過驗證，直接儲存並載入模型
    const handleForceSave = async () => {
        if (!activeKey.trim()) return;
        localStorage.setItem(storageKey, activeKey.trim());
        localStorage.setItem('gemini_api_key', activeKey.trim());
        window.dispatchEvent(new Event('apikey-changed'));
        setKeyStatus('valid');
        setValidationError('');
        if (keySource === 'dage') {
            setAvailableModels(GAISF_MODELS.map((m) => ({ ...m })));
            showMessage('⚠️ 已儲存，GAISF 模型已載入');
        } else {
            showMessage('⚠️ 已儲存，正在載入可用模型...');
            await loadModels(activeKey.trim());
        }
    };

    // 選擇模型
    const handleSelectModel = (modelId) => {
        setSelectedModel(modelId);
        setSelectedModelState(modelId);
        setShowModelPicker(false);
        const model = availableModels.find((m) => m.id === modelId);
        showMessage(`🤖 已切換至 ${model?.name || modelId}`);
    };

    // Google 登入
    const handleLogin = async () => {
        setLoginLoading(true);
        try {
            await signInWithGoogle();
            showMessage('✅ 登入成功！資料將跨裝置同步');
        } catch (err) {
            showMessage(`❌ ${err.message}`);
        } finally {
            setLoginLoading(false);
        }
    };

    // 登出
    const handleLogout = async () => {
        await logOut();
        showMessage('已登出，資料將儲存在本機');
    };

    // 匯出資料
    const handleExport = async () => {
        try {
            const json = await exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expense-data-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showMessage('✅ 資料匯出成功');
        } catch (err) {
            showMessage('❌ 匯出失敗');
        }
    };

    // 匯入資料
    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                await importData(text);
                showMessage('✅ 資料匯入成功');
            } catch (err) {
                showMessage('❌ 匯入失敗，請確認檔案格式');
            }
        };
        input.click();
    };

    // 清除所有資料
    const handleClear = async () => {
        await clearAllData();
        setShowConfirmClear(false);
        showMessage('🗑️ 所有消費記錄已清除');
    };

    // 顯示暫時訊息
    const showMessage = (msg) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), 3000);
    };

    // 強制更新到最新版：登出 Service Worker + 清掉所有快取 + 帶時戳重載（繞過所有快取）
    const handleForceUpdate = async () => {
        showMessage('🔄 清除快取並更新中…');
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
            }
            if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
        } catch (e) {
            console.warn('清快取失敗', e);
        }
        // 帶時戳重載，確保連 HTTP 快取也一起繞過
        setTimeout(() => location.replace(location.pathname + '?_t=' + Date.now()), 400);
    };

    // 模型分類標籤
    const getModelTag = (id) => {
        if (id.includes('flash-lite') || id.includes('flash_lite')) return { label: 'Lite', color: 'text-emerald-400 bg-emerald-500/15' };
        if (id.includes('flash')) return { label: 'Flash', color: 'text-cyan-400 bg-cyan-500/15' };
        if (id.includes('pro')) return { label: 'Pro', color: 'text-purple-400 bg-purple-500/15' };
        if (id.includes('exp')) return { label: 'Exp', color: 'text-amber-400 bg-amber-500/15' };
        return { label: 'Other', color: 'text-white/40 bg-white/5' };
    };

    return (
        <div className="space-y-5">
            {/* 訊息提示 */}
            {message && (
                <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-center text-sm text-white animate-in">
                    {message}
                </div>
            )}

            {/* 帳戶 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                <div className="text-white font-medium">帳戶與同步</div>
                {user ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                            <img
                                src={user.photoURL}
                                alt=""
                                className="w-10 h-10 rounded-full ring-2 ring-cyan-500/30"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">{user.displayName}</p>
                                <p className="text-white/40 text-xs truncate">{user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400 text-xs">
                            <Cloud className="w-3.5 h-3.5" />
                            <span>已啟用雲端同步 — 手機與電腦資料即時同步</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/60 text-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            登出
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-white/40 text-xs">
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>登入 Google 帳戶後，可在手機與電腦間同步資料</span>
                        </div>
                        <button
                            onClick={handleLogin}
                            disabled={loginLoading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            <LogIn className="w-4 h-4" />
                            {loginLoading ? '登入中...' : '使用 Google 帳戶登入'}
                        </button>
                        <div className="flex items-start gap-2 text-white/20 text-xs">
                            <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>目前資料僅儲存在本機瀏覽器，不同裝置無法共用</span>
                        </div>
                    </div>
                )}
            </div>

            {/* API Key 設定 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                <div className="flex items-center gap-2 text-white font-medium">
                    <Key className="w-4 h-4 text-cyan-400" />
                    Gemini API Key
                </div>

                {/* Key 來源切換 */}
                <div className="flex gap-2">
                    {KEY_SOURCES.map((src) => {
                        const Icon = src.icon;
                        const isActive = keySource === src.id;
                        const colorMap = {
                            cyan: {
                                active: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]',
                                dot: 'bg-cyan-400',
                            },
                            amber: {
                                active: 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
                                dot: 'bg-amber-400',
                            },
                        };
                        const colors = colorMap[src.color];
                        return (
                            <button
                                key={src.id}
                                onClick={() => handleSwitchSource(src.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                                    isActive
                                        ? colors.active
                                        : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {src.label}
                                {isActive && (
                                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                <p className="text-white/40 text-xs">
                    {keySource === 'dage'
                        ? '輸入達哥提供的 Gemini API Key，與達哥共用額度。'
                        : '輸入自己的 Google Gemini API Key 以啟用 AI 語音分類功能。'}
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline ml-1"
                    >
                        取得免費 API Key →
                    </a>
                </p>
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={activeKey}
                            onChange={(e) => { setActiveKey(e.target.value); setKeyStatus('idle'); setAvailableModels([]); }}
                            placeholder="AIzaSy..."
                            className={`w-full bg-white/5 border rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder:text-white/20 focus:outline-none transition-colors ${
                                keySource === 'dage'
                                    ? 'border-amber-500/20 focus:border-amber-500/50'
                                    : 'border-white/10 focus:border-cyan-500/50'
                            }`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <button
                        onClick={handleSaveKey}
                        disabled={keyStatus === 'checking'}
                        className={`px-5 py-3 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 ${
                            keySource === 'dage'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600'
                        }`}
                    >
                        {keyStatus === 'checking' ? '驗證中...' : '儲存'}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                    {keyStatus === 'valid' && (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">
                                已驗證 — 目前使用{keySource === 'dage' ? '達哥的' : '自己的'} Key
                            </span>
                        </>
                    )}
                    {keyStatus === 'invalid' && (
                        <div className="w-full space-y-2">
                            <div className="flex items-center gap-2">
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-red-400">驗證失敗</span>
                            </div>
                            {validationError && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-300/80 text-xs font-mono break-all">
                                    {validationError}
                                </div>
                            )}
                            <button
                                onClick={handleForceSave}
                                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                            >
                                跳過驗證，直接儲存 →
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-start gap-2 text-white/30 text-xs">
                    <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>API Key 僅儲存在您的瀏覽器中，不會上傳至任何伺服器。</span>
                </div>
            </div>

            {/* 模型選擇 — 只在有可用模型時顯示 */}
            {(availableModels.length > 0 || modelsLoading) && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white font-medium">
                            <Cpu className="w-4 h-4 text-purple-400" />
                            AI 模型選擇
                        </div>
                        {!modelsLoading && (
                            <span className="text-white/30 text-xs">{availableModels.length} 個可用</span>
                        )}
                    </div>

                    {modelsLoading ? (
                        <div className="flex items-center gap-2 text-white/40 text-sm py-2">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
                            正在載入可用模型...
                        </div>
                    ) : (
                        <>
                            {/* 目前選定的模型 */}
                            <button
                                onClick={() => setShowModelPicker(!showModelPicker)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-white text-sm font-medium truncate">
                                            {selectedModel
                                                ? (availableModels.find((m) => m.id === selectedModel)?.name || selectedModel)
                                                : '自動選擇（推薦）'}
                                        </div>
                                        <div className="text-white/30 text-xs truncate">
                                            {selectedModel || '依可用性自動使用最佳模型'}
                                        </div>
                                    </div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                            </button>

                            {/* 模型選擇清單 */}
                            {showModelPicker && (
                                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                                    {/* 自動選擇選項 */}
                                    <button
                                        onClick={() => handleSelectModel('')}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                                            !selectedModel
                                                ? 'bg-purple-500/15 border border-purple-500/30'
                                                : 'bg-white/5 border border-transparent hover:bg-white/10'
                                        }`}
                                    >
                                        <Zap className="w-4 h-4 text-purple-400 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-white text-sm font-medium">自動選擇</div>
                                            <div className="text-white/30 text-xs">自動降級，確保最高可用性</div>
                                        </div>
                                        {!selectedModel && (
                                            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 ml-auto" />
                                        )}
                                    </button>

                                    {/* 各個模型 */}
                                    {availableModels.map((model) => {
                                        const tag = getModelTag(model.id);
                                        const isSelected = selectedModel === model.id;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => handleSelectModel(model.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                                                    isSelected
                                                        ? 'bg-purple-500/15 border border-purple-500/30'
                                                        : 'bg-white/5 border border-transparent hover:bg-white/10'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white text-sm font-medium truncate">{model.name}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${tag.color}`}>
                                                            {tag.label}
                                                        </span>
                                                    </div>
                                                    <div className="text-white/25 text-xs truncate mt-0.5">{model.id}</div>
                                                </div>
                                                {isSelected && (
                                                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 資料管理 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-3">
                <div className="text-white font-medium mb-2">資料管理</div>

                <button
                    onClick={handleExport}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                    <Download className="w-5 h-5 text-cyan-400" />
                    <div>
                        <div className="text-white text-sm font-medium">匯出資料</div>
                        <div className="text-white/30 text-xs">下載所有消費記錄為 JSON 檔</div>
                    </div>
                </button>

                <button
                    onClick={handleImport}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                    <Upload className="w-5 h-5 text-blue-400" />
                    <div>
                        <div className="text-white text-sm font-medium">匯入資料</div>
                        <div className="text-white/30 text-xs">從 JSON 檔匯入消費記錄</div>
                    </div>
                </button>

                {!showConfirmClear ? (
                    <button
                        onClick={() => setShowConfirmClear(true)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-red-500/10 transition-colors text-left"
                    >
                        <Trash2 className="w-5 h-5 text-red-400" />
                        <div>
                            <div className="text-white text-sm font-medium">清除所有資料</div>
                            <div className="text-white/30 text-xs">刪除所有消費記錄（不可復原）</div>
                        </div>
                    </button>
                ) : (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                        <p className="text-red-400 text-sm font-medium">⚠️ 確定要清除所有消費記錄嗎？</p>
                        <p className="text-white/40 text-xs">此操作不可復原，建議先匯出備份。</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowConfirmClear(false)}
                                className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleClear}
                                className="flex-1 py-2.5 rounded-xl bg-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/40 transition-colors"
                            >
                                確認清除
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 版本與更新 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-3">
                <div className="flex items-center gap-2 text-white font-medium">
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                    版本與更新
                </div>
                <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                    <div className="text-xs min-w-0">
                        <div className="text-white/40">目前版本（建置時間）</div>
                        <div className="text-white/80 font-mono mt-0.5 break-all">{BUILD_LABEL}</div>
                    </div>
                    <span className="text-emerald-400 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 shrink-0 ml-2">已載入</span>
                </div>
                <button
                    onClick={handleForceUpdate}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 active:scale-[0.98] transition"
                >
                    <RefreshCw className="w-4 h-4" />
                    強制更新到最新版（清快取重載）
                </button>
                <p className="text-white/30 text-[11px] leading-relaxed">
                    看不到新功能時點這顆：會登出舊的 Service Worker、清除所有快取、重新載入最新版。
                    先記下上面的「建置時間」，更新後若時間變新＝成功切到最新版。
                </p>
            </div>

            {/* 關於 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-white font-medium mb-2">關於</div>
                <div className="text-white/40 text-xs space-y-1">
                    <p>AI 語音記帳工具 v2.0</p>
                    <p>{user ? '☁️ 雲端同步模式 (Firestore)' : '📱 本機儲存模式 (IndexedDB)'}</p>
                    <p>語音辨識使用 Web Speech API</p>
                    <p>AI 分類使用 Google Gemini API（動態模型選擇）</p>
                </div>
            </div>
        </div>
    );
}
