import { useState, useRef, memo } from 'react';
import { Mic, MicOff, Loader2, Check, X, Sparkles, Languages, Send, PenLine, Keyboard, RotateCw } from 'lucide-react';
import { isSpeechSupported, createSpeechRecognition, disposeRecognition } from '../services/speech';
import { parseExpenseWithAI } from '../services/gemini';
import { CATEGORIES } from '../utils/categories';
import { getToday } from '../utils/dateUtils';
import { getCurrencyLabel } from '../utils/exchangeRate';

/**
 * 語音記帳元件
 * 大型麥克風按鈕 + 語音辨識 + 文字確認/編輯 + AI 分類 + 確認儲存
 */
export default memo(function VoiceInput({ onSave, apiKey }) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [editingText, setEditingText] = useState('');
    const [interimText, setInterimText] = useState('');
    const [parsed, setParsed] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [selectedDate, setSelectedDate] = useState(getToday());
    const [selectedCurrency, setSelectedCurrency] = useState('AUTO');
    const [showEditor, setShowEditor] = useState(false);
    const recognitionRef = useRef(null);
    // 用 ref 同步「最新」的預選幣種。語音的 onResult callback 被 useCallback 凍結在
    // 初次 render 的閉包裡，若直接讀 state 會永遠是舊值('AUTO')，導致選了日幣卻不換算。
    const selectedCurrencyRef = useRef('AUTO');

    // 選幣種：同時更新畫面 state 與 ref（ref 供凍結的語音 callback 讀取最新值）
    const chooseCurrency = (curr) => {
        setSelectedCurrency(curr);
        selectedCurrencyRef.current = curr;
    };

    const currencies = ['AUTO', 'JPY', 'USD', 'CNY', 'THB', 'VND'];
    const speechSupported = isSpeechSupported();

    // 診斷紀錄：記下每次語音辨識經過哪些事件，第二筆失敗時可看出卡在哪一步
    const [debugLog, setDebugLog] = useState([]);
    const [showDebug, setShowDebug] = useState(false);
    const [speechFailed, setSpeechFailed] = useState(false);
    const [typedText, setTypedText] = useState('');
    const sessionRef = useRef(0);
    const watchdogRef = useRef(null);

    const log = (msg) => {
        const t = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        setDebugLog((prev) => [...prev.slice(-39), `#${sessionRef.current} ${t} ${msg}`]);
    };

    const clearWatchdog = () => {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
    };

    // 啟動一次辨識；isRetry 表示這是看門狗觸發的自動重試
    const beginSession = (isRetry) => {
        // 先強制釋放上一次的辨識實例，避免佔住 iOS 語音引擎
        disposeRecognition(recognitionRef.current);
        recognitionRef.current = null;
        clearWatchdog();

        // 追蹤本次是否已有錯誤，避免 onEnd 的「沒聽到聲音」提示蓋掉具體錯誤
        const hadError = { current: false };
        let alive = false;

        try {
            const rec = createSpeechRecognition({
                onResult: (text) => {
                    // 語音完全結束才觸發，直接送 AI 解析
                    setTranscript(text);
                    setEditingText(text);
                    setInterimText('');
                    setIsListening(false);
                    setSpeechFailed(false);
                    if (apiKey) {
                        processWithAI(text);
                    } else {
                        setError('請先在設定頁面輸入 API Key');
                    }
                },
                onInterim: (text) => {
                    alive = true;
                    setInterimText(text);
                },
                onAudioStart: () => {
                    alive = true;
                },
                onEnd: (hasResult) => {
                    clearWatchdog();
                    setIsListening(false);
                    if (!hasResult && !hadError.current) {
                        setSpeechFailed(true);
                        setError('沒有聽到語音內容。請再按一次麥克風，或改用下方鍵盤輸入');
                    }
                    if (recognitionRef.current === rec) recognitionRef.current = null;
                },
                onError: (err) => {
                    hadError.current = true;
                    clearWatchdog();
                    setIsListening(false);
                    setSpeechFailed(true);
                    if (err === 'not-allowed') {
                        setError('請允許麥克風權限');
                    } else {
                        setError(`語音辨識錯誤: ${err}`);
                    }
                },
                onDebug: log,
            });

            recognitionRef.current = rec;
            rec.start();
            log(isRetry ? '重試 start()' : 'start()');
            setIsListening(true);

            // 看門狗：4 秒內麥克風沒開始收音，視為語音引擎卡住
            watchdogRef.current = setTimeout(() => {
                if (alive || recognitionRef.current !== rec) return;
                log('看門狗：4 秒內沒有開始收音');
                disposeRecognition(rec);
                recognitionRef.current = null;
                if (!isRetry) {
                    // 自動用全新實例再試一次
                    setTimeout(() => beginSession(true), 400);
                } else {
                    setIsListening(false);
                    setSpeechFailed(true);
                    setError('語音引擎沒有回應。可改用下方鍵盤輸入，或點「重新載入」');
                }
            }, 4000);
        } catch (err) {
            log(`start() 例外：${err.message}`);
            setIsListening(false);
            setSpeechFailed(true);
            setError(`語音啟動失敗：${err.message}`);
        }
    };

    // 開始錄音
    const startListening = () => {
        if (!speechSupported) {
            setError('此瀏覽器不支援語音辨識，請使用 Chrome');
            return;
        }

        setError('');
        setTranscript('');
        setEditingText('');
        setInterimText('');
        setParsed(null);
        setShowEditor(false);
        setSpeechFailed(false);
        sessionRef.current += 1;
        beginSession(false);
    };

    // 停止錄音
    const stopListening = () => {
        const rec = recognitionRef.current;
        if (!rec) return;
        log('手動 stop()');
        rec.stop();
        // 保險：stop 後 1.5 秒仍未結束，強制釋放，避免畫面卡在聆聽中
        setTimeout(() => {
            if (recognitionRef.current === rec) {
                log('stop 後未結束，強制釋放');
                disposeRecognition(rec);
                recognitionRef.current = null;
                clearWatchdog();
                setIsListening(false);
            }
        }, 1500);
    };

    // 鍵盤輸入（可用 iOS 鍵盤上的麥克風聽寫，不受網頁語音辨識問題影響）
    const handleTypedSubmit = () => {
        const text = typedText.trim();
        if (!text) return;
        if (!apiKey) {
            setError('請先在設定頁面輸入 API Key');
            return;
        }
        setTranscript(text);
        setEditingText(text);
        setTypedText('');
        setSpeechFailed(false);
        processWithAI(text);
    };

    // 手動修正文字後重新送 AI
    const handleResend = () => {
        if (!editingText.trim()) return;
        if (!apiKey) {
            setError('請先在設定頁面輸入 API Key');
            return;
        }
        setTranscript(editingText.trim());
        setShowEditor(false);
        processWithAI(editingText.trim());
    };

    // AI 解析
    const processWithAI = async (text) => {
        setIsProcessing(true);
        setError('');
        try {
            // 讀 ref 而非 state，確保拿到的是「使用者剛剛選的」幣種，不是凍結的舊值
            const result = await parseExpenseWithAI(text, apiKey, selectedCurrencyRef.current);
            setParsed(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // 確認儲存
    const handleConfirm = () => {
        if (parsed) {
            const { _model, ...expenseData } = parsed;
            onSave({
                ...expenseData,
                date: selectedDate,
                rawText: transcript || '',
            });
            setParsed(null);
            setTranscript('');
            setSelectedDate(getToday());
        }
    };

    // 取消
    const handleCancel = () => {
        setParsed(null);
        setTranscript('');
        setError('');
        setSelectedDate(getToday());
    };

    // 修改分類
    const handleCategoryChange = (categoryId) => {
        setParsed((prev) => ({ ...prev, category: categoryId }));
    };

    // 修改金額
    const handleAmountChange = (amount) => {
        setParsed((prev) => ({ ...prev, amount: Number(amount) }));
    };

    return (
        <div className="flex flex-col items-center gap-6 py-6">
            {/* 幣種預選 (New) */}
            <div className="w-full max-w-sm px-4">
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2 block text-center">
                    預選幣種
                </label>
                <div className="flex flex-wrap justify-center gap-2">
                    {currencies.map((curr) => (
                        <button
                            key={curr}
                            onClick={() => chooseCurrency(curr)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedCurrency === curr
                                ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                                : 'bg-white/5 text-white/40 hover:bg-white/10 border border-white/5'
                                }`}
                        >
                            {curr === 'AUTO' ? '✨ Auto' : curr}
                        </button>
                    ))}
                </div>
                {selectedCurrency !== 'AUTO' && (
                    <p className="text-cyan-400/60 text-[10px] text-center mt-2 italic">
                        💡 已鎖定 {getCurrencyLabel(selectedCurrency)}，說數字即可換算
                    </p>
                )}
            </div>

            {/* 語音狀態顯示 */}
            <div className="min-h-[60px] text-center px-4 w-full">
                {isListening && (
                    <div className="text-cyan-400 animate-pulse text-lg font-medium">
                        🎧 正在聆聽...
                    </div>
                )}
                {interimText && (
                    <p className="text-white/60 text-sm mt-2 italic">「{interimText}」</p>
                )}
                {isProcessing && (
                    <div className="flex items-center justify-center gap-2 text-purple-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>AI 分析中...</span>
                    </div>
                )}
                {!isListening && !isProcessing && !parsed && !error && (
                    <p className="text-white/40 text-sm">
                        {apiKey ? '按下麥克風說出消費內容' : '請先在設定頁面輸入 API Key'}
                    </p>
                )}
            </div>

            {/* 麥克風按鈕 */}
            <div className="relative">
                {isListening && (
                    <>
                        <div className="absolute inset-0 rounded-full bg-cyan-500/30 animate-ping" />
                        <div className="absolute -inset-3 rounded-full bg-cyan-500/20 animate-pulse" />
                    </>
                )}
                <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessing}
                    className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isListening
                        ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_40px_rgba(239,68,68,0.5)] scale-110'
                        : isProcessing
                            ? 'bg-white/10 cursor-not-allowed'
                            : 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95'
                        }`}
                >
                    {isProcessing ? (
                        <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
                    ) : isListening ? (
                        <MicOff className="w-10 h-10 text-white" />
                    ) : (
                        <Mic className="w-10 h-10 text-white" />
                    )}
                </button>
            </div>

            {/* 鍵盤輸入：可直接打字，或用 iOS 鍵盤上的麥克風聽寫 */}
            {!parsed && !isProcessing && !isListening && (
                <div className="w-full max-w-sm">
                    <div className={`flex gap-2 rounded-2xl p-1.5 border transition-colors ${speechFailed
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-white/5 border-white/10'
                        }`}>
                        <div className="flex items-center pl-2 text-white/30">
                            <Keyboard className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            value={typedText}
                            onChange={(e) => setTypedText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTypedSubmit()}
                            placeholder="或打字／用鍵盤麥克風說，例：晚餐 150"
                            className="flex-1 min-w-0 bg-transparent px-1 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none"
                        />
                        <button
                            onClick={handleTypedSubmit}
                            disabled={!typedText.trim()}
                            className="px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white disabled:opacity-30 transition-opacity"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* 語音辨識結果 + 修正功能 */}
            {transcript && !parsed && !isProcessing && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-sm space-y-3">
                    {showEditor ? (
                        <>
                            <label className="text-white/40 text-xs flex items-center gap-1">
                                <PenLine className="w-3 h-3" />
                                修正辨識文字
                            </label>
                            <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleResend()}
                                autoFocus
                                className="w-full bg-white/5 border border-cyan-500/30 rounded-xl px-4 py-3 text-white text-center text-lg focus:outline-none focus:border-cyan-500/50"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowEditor(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/40 text-sm hover:bg-white/10 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleResend}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    重新分析
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-white/80 text-center text-lg">「{transcript}」</p>
                            <button
                                onClick={() => setShowEditor(true)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 text-white/40 text-xs hover:bg-white/10 hover:text-white/60 transition-colors"
                            >
                                <PenLine className="w-3 h-3" />
                                辨識有誤？點此修正
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* AI 解析結果預覽 */}
            {parsed && (
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 w-full max-w-sm space-y-4 animate-in">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
                            <Sparkles className="w-4 h-4" />
                            AI 辨識結果
                        </div>
                        {parsed._model && (
                            <span className="text-white/20 text-[10px] font-mono">{parsed._model}</span>
                        )}
                    </div>

                    {/* 確認/取消按鈕（置頂，不需捲動即可操作） */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            取消
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
                        >
                            <Check className="w-4 h-4" />
                            確認記帳
                        </button>
                    </div>

                    {/* 語音原文 */}
                    <p className="text-white/50 text-xs italic">「{transcript}」</p>

                    {/* 金額 */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-white/40 text-xs block">金額</label>
                            {parsed.currency !== 'TWD' && (
                                <div className="flex items-center gap-1 text-cyan-400 text-[10px] font-medium animate-pulse">
                                    <Languages className="w-3 h-3" />
                                    <span>已自動從 {getCurrencyLabel(parsed.currency)} 轉換</span>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={parsed.amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-2xl font-bold text-white text-center focus:outline-none focus:border-cyan-500/50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-xs font-medium">
                                TWD
                            </div>
                        </div>
                        {parsed.currency !== 'TWD' && (
                            <p className="text-white/40 text-[10px] mt-1 text-right">
                                原金額：{getCurrencyLabel(parsed.currency)} {parsed.originalAmount?.toLocaleString()}
                            </p>
                        )}
                    </div>

                    {/* 品項 */}
                    <div>
                        <label className="text-white/40 text-xs block mb-1">品項</label>
                        <p className="text-white text-lg">{parsed.item}</p>
                    </div>

                    {/* 分類選擇 */}
                    <div>
                        <label className="text-white/40 text-xs block mb-2">分類</label>
                        <div className="grid grid-cols-4 gap-2">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryChange(cat.id)}
                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-all ${parsed.category === cat.id
                                        ? 'bg-white/15 border border-white/20 text-white'
                                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                                        }`}
                                >
                                    <span className="text-lg">{cat.emoji}</span>
                                    <span>{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 日期選擇（支援補登） */}
                    <div>
                        <label className="text-white/40 text-xs block mb-1">日期</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={getToday()}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                        />
                        {selectedDate !== getToday() && (
                            <p className="text-amber-400 text-xs mt-1">📝 補登 {selectedDate} 的消費</p>
                        )}
                    </div>

                </div>
            )}

            {/* 錯誤訊息 */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 w-full max-w-sm space-y-2">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                    {speechFailed && (
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 transition-colors"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                            重新載入 App（重置語音引擎）
                        </button>
                    )}
                </div>
            )}

            {/* 診斷紀錄：語音失敗時可截圖回報 */}
            {debugLog.length > 0 && (
                <div className="w-full max-w-sm">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="text-white/20 text-[10px] hover:text-white/40 transition-colors"
                    >
                        🔧 語音診斷紀錄 {showDebug ? '▲' : '▼'}
                    </button>
                    {showDebug && (
                        <div className="mt-2 bg-black/40 border border-white/10 rounded-lg p-2 font-mono text-[10px] text-white/50 space-y-0.5 max-h-60 overflow-y-auto">
                            {debugLog.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
})
