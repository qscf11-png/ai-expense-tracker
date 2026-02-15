// React Hook：管理使用者登入狀態
import { useState, useEffect } from 'react';
import { onAuthChange } from '../services/auth';

/**
 * 使用者認證狀態 Hook
 * @returns {Object} { user, loading }
 */
export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthChange((firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { user, loading };
}
