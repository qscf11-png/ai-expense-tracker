import { useState, useEffect, useCallback } from 'react';
import { Mic, List, BarChart3, Settings as SettingsIcon, PenLine } from 'lucide-react';
import VoiceInput from './components/VoiceInput';
import ManualInput from './components/ManualInput';
import ExpenseList from './components/ExpenseList';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { addExpense } from './services/db';
import { formatCurrency } from './utils/formatters';
import { getExpensesByDate } from './services/db';
import { getToday } from './utils/dateUtils';

const TABS = [
  { id: 'voice', label: '語音', icon: Mic },
  { id: 'manual', label: '手動', icon: PenLine },
  { id: 'list', label: '清單', icon: List },
  { id: 'dashboard', label: '分析', icon: BarChart3 },
  { id: 'settings', label: '設定', icon: SettingsIcon },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('voice');
  const [apiKey, setApiKey] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [toast, setToast] = useState('');
  const [listKey, setListKey] = useState(0);

  // 載入 API Key
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setApiKey(saved);

    // 監聽 localStorage 變化
    const handleStorage = () => {
      const key = localStorage.getItem('gemini_api_key');
      setApiKey(key || '');
    };
    window.addEventListener('storage', handleStorage);

    // 定時檢查（同一頁面 localStorage 變化不會觸發 storage event）
    const interval = setInterval(handleStorage, 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // 載入今天的支出總額
  const loadTodayTotal = useCallback(async () => {
    const today = await getExpensesByDate(getToday());
    setTodayTotal(today.reduce((sum, e) => sum + e.amount, 0));
  }, []);

  useEffect(() => {
    loadTodayTotal();
  }, [loadTodayTotal]);

  // 儲存消費
  const handleSave = async (expense) => {
    await addExpense(expense);
    await loadTodayTotal();
    setListKey((k) => k + 1);
    showToast(`✅ 已記錄 ${expense.item} ${formatCurrency(expense.amount)}`);
  };

  // 顯示提示
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* 背景氛圍 */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-cyan-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              AI 記帳
            </h1>
            <p className="text-white/30 text-xs">語音智慧記帳工具</p>
          </div>
          <div className="text-right">
            <div className="text-white/40 text-xs">今日支出</div>
            <div className="text-cyan-400 font-bold">{formatCurrency(todayTotal)}</div>
          </div>
        </div>
      </header>

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-white/20 rounded-xl px-5 py-3 shadow-2xl animate-in text-sm text-white whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* 主要內容 */}
      <main className="relative z-10 flex-1 px-5 pb-24 overflow-y-auto">
        {activeTab === 'voice' && (
          <VoiceInput onSave={handleSave} apiKey={apiKey} />
        )}
        {activeTab === 'manual' && (
          <ManualInput onSave={handleSave} />
        )}
        {activeTab === 'list' && (
          <ExpenseList key={listKey} />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard key={listKey} />
        )}
        {activeTab === 'settings' && (
          <Settings />
        )}
      </main>

      {/* 底部導航列 */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div className="flex items-center justify-around px-2 pt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${isActive
                    ? 'text-cyan-400'
                    : 'text-white/30 hover:text-white/50'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]' : ''}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
