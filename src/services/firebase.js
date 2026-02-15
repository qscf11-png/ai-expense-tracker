// Firebase 設定與初始化
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Firebase 設定 — 來自 Firebase Console
const firebaseConfig = {
    apiKey: 'AIzaSyDA-868ZUbI5rd6eN8YqIznS27Ncdqjjak',
    authDomain: 'tk-private.firebaseapp.com',
    databaseURL: 'https://tk-private-default-rtdb.firebaseio.com',
    projectId: 'tk-private',
    storageBucket: 'tk-private.firebasestorage.app',
    messagingSenderId: '392798264555',
    appId: '1:392798264555:web:e8ed47934f18ec2feef2ae',
    measurementId: 'G-FXBKFH2WQ6',
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 初始化 Firestore
export const firestore = getFirestore(app);

// 啟用 Firestore 離線快取（支援離線使用）
enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code === 'failed-precondition') {
        // 多個分頁同時開啟時無法啟用
        console.warn('Firestore 離線快取：多個分頁同時開啟，僅一個可啟用');
    } else if (err.code === 'unimplemented') {
        // 瀏覽器不支援
        console.warn('Firestore 離線快取：此瀏覽器不支援');
    }
});

export default app;
