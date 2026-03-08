import { useState, useEffect } from 'react';
import { PlusCircle, Languages } from 'lucide-react';
import { CATEGORIES } from '../utils/categories';
import { getToday } from '../utils/dateUtils';
import { convertToTWD, getCurrencyLabel } from '../utils/exchangeRate';

/**
 * 手動記帳表單
 */
export default function ManualInput({ onSave }) {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('TWD');
    const [convertedPreview, setConvertedPreview] = useState(null);
    const [category, setCategory] = useState('food');
    const [item, setItem] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(getToday());

    const currencies = ['TWD', 'JPY', 'USD', 'CNY', 'THB', 'VND'];

    // 處理即時換算預覽
    useEffect(() => {
        const updatePreview = async () => {
            if (currency !== 'TWD' && amount && Number(amount) > 0) {
                const twd = await convertToTWD(Number(amount), currency);
                setConvertedPreview(twd);
            } else {
                setConvertedPreview(null);
            }
        };
        updatePreview();
    }, [amount, currency]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || Number(amount) <= 0) return;

        let finalAmount = Number(amount);
        let finalNote = note;

        if (currency !== 'TWD') {
            finalAmount = await convertToTWD(Number(amount), currency);
            const currencyLabel = getCurrencyLabel(currency);
            finalNote = note ? `${note} (${currencyLabel} ${amount})` : `(${currencyLabel} ${amount})`;
        }

        onSave({
            amount: finalAmount,
            category,
            item: item || CATEGORIES.find((c) => c.id === category)?.name || '消費',
            note: finalNote,
            date,
        });

        // 重置表單
        setAmount('');
        setCurrency('TWD');
        setItem('');
        setNote('');
        setCategory('food');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 px-1">
            {/* 金額 */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-white/50 text-xs font-medium block">金額 *</label>
                    {convertedPreview !== null && (
                        <div className="flex items-center gap-1 text-cyan-400 text-[10px] font-medium animate-pulse">
                            <Languages className="w-3 h-3" />
                            <span>約 NT$ {convertedPreview.toLocaleString()}</span>
                        </div>
                    )}
                </div>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm font-bold">
                        {currency === 'TWD' ? 'NT$' : currency}
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-16 pr-4 py-3.5 text-xl font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        required
                    />
                </div>
            </div>

            {/* 幣種選擇 */}
            <div>
                <label className="text-white/50 text-xs font-medium block mb-2">幣種</label>
                <div className="flex flex-wrap gap-2">
                    {currencies.map((curr) => (
                        <button
                            key={curr}
                            type="button"
                            onClick={() => setCurrency(curr)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${currency === curr
                                ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                                : 'bg-white/5 border border-transparent text-white/40 hover:bg-white/10'
                                }`}
                        >
                            {curr}
                        </button>
                    ))}
                </div>
            </div>

            {/* 分類 */}
            <div>
                <label className="text-white/50 text-xs font-medium block mb-2">分類</label>
                <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs transition-all ${category === cat.id
                                ? 'bg-white/15 border border-white/25 text-white shadow-lg'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                                }`}
                        >
                            <span className="text-lg">{cat.emoji}</span>
                            <span>{cat.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 品項 */}
            <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">品項</label>
                <input
                    type="text"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="例如：午餐便當"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
            </div>

            {/* 日期 */}
            <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">日期</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors [color-scheme:dark]"
                />
            </div>

            {/* 備註 */}
            <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">備註</label>
                <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="選填"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
            </div>

            {/* 送出按鈕 */}
            <button
                type="submit"
                disabled={!amount || Number(amount) <= 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] transition-all"
            >
                <PlusCircle className="w-5 h-5" />
                新增記錄
            </button>
        </form>
    );
}
