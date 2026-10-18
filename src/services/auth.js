// Google 登入/登出服務
import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

/**
 * 是否以「加入主畫面」的獨立 App 模式執行（iOS/Android PWA）
 * 此模式下彈出視窗登入會失敗，需改用轉址登入
 */
export function isStandalone() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
    );
}

/**
 * Google 登入
 * - 一般瀏覽器：彈出視窗流程（體驗較好，不離開頁面）
 * - PWA 獨立模式：轉址流程（整頁跳轉到 Google 登入，完成後跳回）
 * @returns {Object|null} 使用者資訊；轉址流程會跳轉頁面，回傳 null
 */
export async function signInWithGoogle() {
    if (isStandalone()) {
        // 轉址登入：頁面會跳轉到 Google，登入後回到 App 由 getRedirectResult 接手
        await signInWithRedirect(auth, googleProvider);
        return null;
    }

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
        // 顯示完整錯誤代碼，方便遠端診斷
        throw new Error(`登入失敗（${error.code || error.message}）`);
    }
}

/**
 * 處理轉址登入返回的結果（App 啟動時呼叫一次）
 * 沒有待處理的轉址結果時回傳 null，不影響一般啟動流程
 */
export async function handleRedirectResult() {
    try {
        const result = await getRedirectResult(auth);
        return result ? result.user : null;
    } catch (error) {
        console.error('轉址登入失敗:', error);
        // 顯示完整錯誤代碼，方便遠端診斷
        throw new Error(`登入失敗（${error.code || error.message}）`);
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
