// Google 登入/登出服務
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

/**
 * Google 登入
 * @returns {Object} 使用者資訊
 */
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('登入視窗已關閉');
        }
        if (error.code === 'auth/popup-blocked') {
            throw new Error('登入視窗被阻擋，請允許彈出視窗');
        }
        console.error('Google 登入失敗:', error);
        throw new Error('登入失敗，請稍後再試');
    }
}

/**
 * 登出
 */
export async function logOut() {
    await signOut(auth);
}

/**
 * 監聽登入狀態變化
 * @param {Function} callback - 狀態變化時的回呼函式
 * @returns {Function} 取消訂閱函式
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}
