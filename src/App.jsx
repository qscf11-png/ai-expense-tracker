import { useState, useEffect, useCallback } from 'react';
import { Mic, List, BarChart3, Settings as SettingsIcon, PenLine, LogIn } from 'lucide-react';
import VoiceInput from './components/VoiceInput';
import ManualInput from './components/ManualInput';
import ExpenseList from './components/ExpenseList';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import { addExpense, setCurrentUser, migrateLocalToCloud } from './services/db';
import { formatCurrency } from './utils/formatters';
import { getExpensesByDate } from './services/db';
import { getToday } from './utils/dateUtils';
import { useAuth } from './hooks/useAuth';
import { signInWithGoogle } from './services/auth';

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
  const [loginLoading, setLoginLoading] = useState(false);

  const { user, loading: authLoading } = useAuth();

  // 設定 Firestore 使用者身份
  useEffect(() => {
    setCurrentUser(user ? user.uid : null);

    // 登入後嘗試遷移本機資料到雲端
    if (user) {
      migrateLocalToCloud().then((count) => {
        if (count > 0) {
          showToast(`☁️ 已將 ${count} 筆本機資料同步到雲端`);
        }
      });
    }
  }, [user]);

  // 載入 API Key
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setApiKey(saved);

    const handleStorage = () => {
      const key = localStorage.getItem('gemini_api_key');
      setApiKey(key || '');
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // 載入今天的支出總額
  const loadTodayTotal = useCallback(async () => {
    try {
      const today = await getExpensesByDate(getToday());
      setTodayTotal(today.reduce((sum, e) => sum + e.amount, 0));
    } catch {
      setTodayTotal(0);
    }
  }, []);

  useEffect(() => {
    loadTodayTotal();
  }, [loadTodayTotal, user]);

  // 儲存消費
  const handleSave = async (expense) => {
    await addExpense(expense);
    await loadTodayTotal();
    setListKey((k) => k + 1);
    showToast(`✅ 已記錄 ${expense.item} ${formatCurrency(expense.amount)}`);
  };

  // Google 登入
  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await signInWithGoogle();
      showToast('✅ 登入成功！資料將跨裝置同步');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  // 顯示提示
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Auth 載入中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-lg">載入中...</div>
      </div>
    );
  }

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
          <div className="flex items-center gap-3">
            {/* 登入狀態 */}
            {user ? (
              <div className="flex items-center gap-2">
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-6 h-6 rounded-full ring-1 ring-white/20"
                />
                <div className="text-right">
                  <div className="text-white/40 text-xs">今日支出</div>
                  <div className="text-cyan-400 font-bold">{formatCurrency(todayTotal)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogin}
                  disabled={loginLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-xs text-white/70"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {loginLoading ? '登入中...' : '登入同步'}
                </button>
                <div className="text-right">
                  <div className="text-white/40 text-xs">今日支出</div>
                  <div className="text-cyan-400 font-bold">{formatCurrency(todayTotal)}</div>
                </div>
              </div>
            )}
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
          <Settings user={user} />
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
