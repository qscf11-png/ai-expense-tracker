import { useState, useEffect, memo } from 'react';
import { Repeat, Plus, Trash2, Power, TrendingDown, TrendingUp, Pencil } from 'lucide-react';
import { CATEGORIES, INCOME_CATEGORIES, getCategoryById } from '../utils/categories';
import {
    addRecurringItem,
    getRecurringItems,
    updateRecurringItem,
    deleteRecurringItem,
    applyRecurringItems,
} from '../services/db';
import { formatCurrency } from '../utils/formatters';

/**
 * 固定收支管理元件
 * 新增/停用/刪除每月固定收入與支出項目（如薪資、房租、訂閱費）
 * 到期時 App 啟動會自動入帳，無需手動記錄
 */
export default memo(function RecurringManager({ onChanged }) {
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [editingId, setEditingId] = useState(null);

    // 新增表單欄位
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [formType, setFormType] = useState('expense');
    const [formName, setFormName] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formCategory, setFormCategory] = useState(CATEGORIES[0].id);
    const [formDay, setFormDay] = useState(1);
    const [formStartMonth, setFormStartMonth] = useState(currentMonth);

    const isIncome = formType === 'income';
    const activeCategories = isIncome ? INCOME_CATEGORIES : CATEGORIES;

    const loadItems = async () => {
        const data = await getRecurringItems();
        setItems(data);
    };

    useEffect(() => {
        loadItems();
    }, []);

    // 切換收入/支出時重置分類
    const handleTypeSwitch = (type) => {
        setFormType(type);
        setFormCategory(type === 'income' ? INCOME_CATEGORIES[0].id : CATEGORIES[0].id);
    };

    // 重置表單
    const resetForm = () => {
        setFormType('expense');
        setFormName('');
        setFormAmount('');
        setFormCategory(CATEGORIES[0].id);
        setFormDay(1);
        setFormStartMonth(currentMonth);
        setEditingId(null);
        setShowForm(false);
    };

    // 開始編輯既有項目：帶入現有值
    const handleEdit = (item) => {
        setFormType(item.type || 'expense');
        setFormName(item.name);
        setFormAmount(String(item.amount));
        setFormCategory(item.category);
        setFormDay(item.dayOfMonth);
        setFormStartMonth(item.startMonth || (item.createdAt || '').slice(0, 7) || currentMonth);
        setEditingId(item.id);
        setConfirmDeleteId(null);
        setShowForm(true);
    };

    // 新增或更新固定項目
    const handleAdd = async () => {
        if (!formName.trim() || !formAmount || Number(formAmount) <= 0) return;
        const fields = {
            name: formName.trim(),
            type: formType,
            amount: Number(formAmount),
            category: formCategory,
            dayOfMonth: Number(formDay),
            // 回溯補記起始月（YYYY-MM），不早於當月則等同無回溯
            startMonth: formStartMonth || currentMonth,
        };
        if (editingId) {
            // 更新：重設 lastApplied 觸發重新掃描，缺漏月份會補記、已入帳月份不重複
            await updateRecurringItem(editingId, { ...fields, lastApplied: null });
        } else {
            await addRecurringItem(fields);
        }
        resetForm();
        // 若有到期未入帳的月份，立即補記
        const applied = await applyRecurringItems();
        if (applied > 0) window.dispatchEvent(new Event('expense-changed'));
        await loadItems();
        if (onChanged) onChanged(applied);
    };

    // 啟用/停用
    const handleToggle = async (item) => {
        if (!item.enabled) {
            // 重新啟用：從當月開始記，不補記停用期間的月份
            const now = new Date();
            const prevM = now.getMonth() === 0
                ? `${now.getFullYear() - 1}-12`
                : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
            const updates = { enabled: true };
            // 已在本月入帳過則不回退，避免重複記錄
            if (!item.lastApplied || item.lastApplied < prevM) updates.lastApplied = prevM;
            await updateRecurringItem(item.id, updates);
            const applied = await applyRecurringItems();
            if (applied > 0) window.dispatchEvent(new Event('expense-changed'));
        } else {
            await updateRecurringItem(item.id, { enabled: false });
        }
        await loadItems();
    };

    // 刪除
    const handleDelete = async (id) => {
        await deleteRecurringItem(id);
        setConfirmDeleteId(null);
        await loadItems();
    };

    const incomeItems = items.filter((i) => i.type === 'income');
    const expenseItems = items.filter((i) => i.type !== 'income');
    const monthlyIncome = incomeItems.filter((i) => i.enabled).reduce((s, i) => s + i.amount, 0);
    const monthlyExpense = expenseItems.filter((i) => i.enabled).reduce((s, i) => s + i.amount, 0);

    const renderItem = (item) => {
        const cat = getCategoryById(item.category);
        const income = item.type === 'income';
        return (
            <div
                key={item.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${item.enabled ? 'bg-white/5' : 'bg-white/[0.02] opacity-50'
                    }`}
            >
                <span className="text-lg shrink-0">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{item.name}</div>
                    <div className="text-white/30 text-xs">每月 {item.dayOfMonth} 號自動入帳</div>
                </div>
                <span className={`font-bold text-sm shrink-0 ${income ? 'text-emerald-400' : 'text-white/80'}`}>
                    {income ? '+' : '-'}{formatCurrency(item.amount)}
                </span>
                <button
                    onClick={() => handleEdit(item)}
                    title="編輯"
                    className="p-1.5 rounded-lg text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors shrink-0"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => handleToggle(item)}
                    title={item.enabled ? '停用' : '啟用'}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${item.enabled
                        ? 'text-emerald-400 hover:bg-emerald-500/10'
                        : 'text-white/20 hover:bg-white/5'
                        }`}
                >
                    <Power className="w-3.5 h-3.5" />
                </button>
                {confirmDeleteId === item.id ? (
                    <button
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-1 rounded-lg bg-red-500/30 text-red-400 text-xs font-medium shrink-0"
                    >
                        確認
                    </button>
                ) : (
                    <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-medium">
                    <Repeat className="w-4 h-4 text-amber-400" />
                    固定收支管理
                </div>
                <button
                    onClick={() => (showForm ? resetForm() : setShowForm(true))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium hover:bg-amber-500/25 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    新增
                </button>
            </div>

            <p className="text-white/40 text-xs">
                設定每月固定的收入（薪資）與支出（房租、訂閱費），到期自動入帳，不需手動記錄。
            </p>

            {/* 每月固定收支摘要 */}
            {items.length > 0 && (
                <div className="flex gap-3 text-xs">
                    <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                        <div className="text-white/40">每月固定收入</div>
                        <div className="text-emerald-400 font-bold">+{formatCurrency(monthlyIncome)}</div>
                    </div>
                    <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                        <div className="text-white/40">每月固定支出</div>
                        <div className="text-red-400 font-bold">-{formatCurrency(monthlyExpense)}</div>
                    </div>
                </div>
            )}

            {/* 新增 / 編輯表單 */}
            {showForm && (
                <div className="bg-white/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    {editingId && (
                        <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-medium">
                            <Pencil className="w-3.5 h-3.5" />
                            編輯「{formName}」— 已入帳的記錄不會變動，僅影響之後的入帳
                        </div>
                    )}
                    {/* 類型切換 */}
                    <div className="flex bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => handleTypeSwitch('expense')}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${!isIncome
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                                : 'text-white/40'
                                }`}
                        >
                            <TrendingDown className="w-3.5 h-3.5" />
                            固定支出
                        </button>
                        <button
                            onClick={() => handleTypeSwitch('income')}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${isIncome
                                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                                : 'text-white/40'
                                }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            固定收入
                        </button>
                    </div>

                    <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder={isIncome ? '例如：薪資' : '例如：房租'}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                    />

                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">NT$</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={formAmount}
                                onChange={(e) => setFormAmount(e.target.value)}
                                placeholder="金額"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3">
                            <span className="text-white/40 text-xs shrink-0">每月</span>
                            <select
                                value={formDay}
                                onChange={(e) => setFormDay(e.target.value)}
                                className="bg-transparent text-white text-sm focus:outline-none [color-scheme:dark]"
                            >
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <span className="text-white/40 text-xs shrink-0">號</span>
                        </div>
                    </div>

                    {/* 回溯補記起始月 */}
                    <div className="space-y-1">
                        <label className="text-white/40 text-xs">從哪個月開始記錄（可回溯補記歷史月份）</label>
                        <input
                            type="month"
                            value={formStartMonth}
                            max={currentMonth}
                            onChange={(e) => setFormStartMonth(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
                        />
                        {formStartMonth < currentMonth && (
                            <p className="text-amber-400/80 text-xs">
                                📝 將自動補記 {formStartMonth.replace('-', ' 年 ')} 月起的每月記錄
                            </p>
                        )}
                    </div>

                    {/* 分類 */}
                    <div className="flex flex-wrap gap-1.5">
                        {activeCategories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setFormCategory(cat.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${formCategory === cat.id
                                    ? 'bg-white/15 border border-white/25 text-white'
                                    : 'bg-white/5 border border-transparent text-white/40'
                                    }`}
                            >
                                {cat.emoji} {cat.name}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={resetForm}
                            className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/40 text-sm hover:bg-white/10 transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!formName.trim() || !formAmount || Number(formAmount) <= 0}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium disabled:opacity-30 hover:opacity-90 transition-opacity"
                        >
                            {editingId ? '更新項目' : '儲存項目'}
                        </button>
                    </div>
                </div>
            )}

            {/* 項目清單 */}
            {items.length === 0 && !showForm ? (
                <p className="text-white/20 text-xs text-center py-3">尚未設定固定收支項目</p>
            ) : (
                <div className="space-y-3">
                    {incomeItems.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-emerald-400/60 text-[10px] font-semibold uppercase tracking-wider">收入</div>
                            {incomeItems.map(renderItem)}
                        </div>
                    )}
                    {expenseItems.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-red-400/60 text-[10px] font-semibold uppercase tracking-wider">支出</div>
                            {expenseItems.map(renderItem)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
})
