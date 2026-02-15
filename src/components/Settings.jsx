import { useState, useEffect } from 'react';
import { Key, Download, Upload, Trash2, CheckCircle2, XCircle, Shield, LogOut, LogIn, Cloud, Smartphone, Eye, EyeOff } from 'lucide-react';
import { validateApiKey } from '../services/gemini';
import { exportData, importData, clearAllData } from '../services/db';
import { signInWithGoogle, logOut } from '../services/auth';

/**
 * 設定頁面
 */
export default function Settings({ user }) {
    const [apiKey, setApiKey] = useState('');
    const [keyStatus, setKeyStatus] = useState('idle'); // idle | checking | valid | invalid
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [message, setMessage] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [showKey, setShowKey] = useState(false);

    // 載入已儲存的 API Key
    useEffect(() => {
        const saved = localStorage.getItem('gemini_api_key');
        if (saved) {
            setApiKey(saved);
            setKeyStatus('valid');
        }
    }, []);

    // 儲存 API Key
    const handleSaveKey = async () => {
        if (!apiKey.trim()) {
            localStorage.removeItem('gemini_api_key');
            setKeyStatus('idle');
            return;
        }

        setKeyStatus('checking');
        const valid = await validateApiKey(apiKey.trim());
        if (valid) {
            localStorage.setItem('gemini_api_key', apiKey.trim());
            setKeyStatus('valid');
            showMessage('✅ API Key 驗證成功並已儲存');
        } else {
            setKeyStatus('invalid');
            showMessage('❌ API Key 無效，請確認後重試');
        }
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
                        {/* 使用者資訊 */}
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
                        {/* 同步狀態 */}
                        <div className="flex items-center gap-2 text-emerald-400 text-xs">
                            <Cloud className="w-3.5 h-3.5" />
                            <span>已啟用雲端同步 — 手機與電腦資料即時同步</span>
                        </div>
                        {/* 登出按鈕 */}
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
                <p className="text-white/40 text-xs">
                    輸入 Google Gemini API Key 以啟用 AI 語音分類功能。
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
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setKeyStatus('idle'); }}
                            placeholder="AIzaSy..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
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
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {keyStatus === 'checking' ? '驗證中...' : '儲存'}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    {keyStatus === 'valid' && (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">已驗證</span>
                        </>
                    )}
                    {keyStatus === 'invalid' && (
                        <>
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-red-400">無效的 API Key</span>
                        </>
                    )}
                </div>
                <div className="flex items-start gap-2 text-white/30 text-xs">
                    <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>API Key 僅儲存在您的瀏覽器中，不會上傳至任何伺服器。</span>
                </div>
            </div>

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

            {/* 關於 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="text-white font-medium mb-2">關於</div>
                <div className="text-white/40 text-xs space-y-1">
                    <p>AI 語音記帳工具 v2.0</p>
                    <p>{user ? '☁️ 雲端同步模式 (Firestore)' : '📱 本機儲存模式 (IndexedDB)'}</p>
                    <p>語音辨識使用 Web Speech API</p>
                    <p>AI 分類使用 Google Gemini API（多模型自動降級）</p>
                </div>
            </div>
        </div>
    );
}
