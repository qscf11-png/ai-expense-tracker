import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/**
 * PWA 新版偵測 + 一鍵更新
 * - 部署新版後，App 會在「每 60 秒」與「回到前景時」主動檢查
 * - 偵測到新版 → 跳出橫幅 → 點「更新」即重載到最新版（解決快取看到舊版的問題）
 */
export default function PWAUpdater() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            if (!r) return;
            // 每 60 秒主動檢查一次有沒有新版
            setInterval(() => r.update(), 60 * 1000);
            // App 回到前景時也檢查（手機切換 App 回來最常見）
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') r.update();
            });
        },
    });

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm animate-in">
            <div className="flex items-center gap-3 bg-slate-800 border border-cyan-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-cyan-500/10">
                <RefreshCw className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="flex-1">
                    <div className="text-white text-sm font-medium">有新版本可用 🎉</div>
                    <div className="text-white/40 text-xs">點「更新」載入最新功能</div>
                </div>
                <button
                    onClick={() => updateServiceWorker(true)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 active:scale-95 transition"
                >
                    更新
                </button>
                <button
                    onClick={() => setNeedRefresh(false)}
                    className="text-white/30 hover:text-white/60 transition"
                    aria-label="稍後再說"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
