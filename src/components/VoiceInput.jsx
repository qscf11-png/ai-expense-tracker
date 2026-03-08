import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, Check, X, Sparkles } from 'lucide-react';
import { isSpeechSupported, createSpeechRecognition } from '../services/speech';
import { parseExpenseWithAI } from '../services/gemini';
import { CATEGORIES } from '../utils/categories';
import { getToday } from '../utils/dateUtils';

/**
 * 語音記帳元件
 * 大型麥克風按鈕 + 語音辨識 + AI 分類 + 確認儲存
 */
export default function VoiceInput({ onSave, apiKey }) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');
    const [parsed, setParsed] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [selectedDate, setSelectedDate] = useState(getToday());
    const [selectedCurrency, setSelectedCurrency] = useState('AUTO');
    const recognitionRef = useRef(null);

    const currencies = ['AUTO', 'JPY', 'USD', 'CNY', 'THB', 'VND'];
    const speechSupported = isSpeechSupported();

    // 開始錄音
    const startListening = useCallback(() => {
        if (!speechSupported) {
            setError('此瀏覽器不支援語音辨識，請使用 Chrome');
            return;
        }

        setError('');
        setTranscript('');
        setInterimText('');
        setParsed(null);

        try {
            recognitionRef.current = createSpeechRecognition({
                onResult: (text) => {
                    setTranscript(text);
                    setInterimText('');
                    setIsListening(false);
                },
                onInterim: (text) => {
                    setInterimText(text);
                },
                onEnd: () => {
                    setIsListening(false);
                },
                onError: (err) => {
                    setIsListening(false);
                    if (err === 'no-speech') {
                        setError('未偵測到語音，請再試一次');
                    } else if (err === 'not-allowed') {
                        setError('請允許麥克風權限');
                    } else {
                        setError(`語音辨識錯誤: ${err}`);
                    }
                },
            });

            recognitionRef.current.start();
            setIsListening(true);
        } catch (err) {
            setError(err.message);
        }
    }, [speechSupported]);

    // 停止錄音
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    }, []);

    // 取得到語音文字後，自動呼叫 AI 解析
    useEffect(() => {
        if (transcript && apiKey) {
            processWithAI(transcript);
        } else if (transcript && !apiKey) {
            setError('請先在設定頁面輸入 Gemini API Key');
        }
    }, [transcript, apiKey]);

    // AI 解析
    const processWithAI = async (text) => {
        setIsProcessing(true);
        setError('');
        try {
            const result = await parseExpenseWithAI(text, apiKey);
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

            {/* 語音辨識結果 */}
            {transcript && !parsed && !isProcessing && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-sm">
                    <p className="text-white/80 text-center">「{transcript}」</p>
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

                    {/* 確認/取消按鈕 */}
                    <div className="flex gap-3 pt-2">
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
                </div>
            )}

            {/* 錯誤訊息 */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 w-full max-w-sm">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
            )}
        </div>
    );
}
