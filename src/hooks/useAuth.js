// React Hook：管理使用者登入狀態
import { useState, useEffect } from 'react';
import { onAuthChange, handleRedirectResult } from '../services/auth';

/**
 * 使用者認證狀態 Hook
 * @returns {Object} { user, loading }
 */
export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        // 接收 PWA 轉址登入返回的結果（無待處理結果時安靜略過）
        // 失敗時把錯誤浮出到 UI（PWA 裡看不到主控台）
        handleRedirectResult().catch((err) => {
            console.warn('轉址登入結果處理失敗:', err.message);
            setAuthError(err.message);
        });

        const unsubscribe = onAuthChange((firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { user, loading, authError };
}
