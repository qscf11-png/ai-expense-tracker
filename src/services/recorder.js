/**
 * 錄音服務：用 MediaRecorder 錄下語音，交給 AI 直接聽寫
 * 不經過瀏覽器的語音辨識（iOS 主畫面 App 的語音辨識只有第一筆能用）
 */

/**
 * 檢查瀏覽器是否支援錄音
 */
export function isRecordingSupported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/** 依瀏覽器挑一個支援的錄音格式（iOS 為 audio/mp4，Chrome 為 audio/webm） */
function pickMimeType() {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

/**
 * 開始錄音
 * @returns {Promise<{stop: Function, cancel: Function}>}
 *   stop() 回傳錄好的 Blob；cancel() 放棄這段錄音
 *   兩者都會關閉麥克風，避免佔住 iOS 的音訊裝置
 */
export async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
    });
    const releaseMic = () => stream.getTracks().forEach((t) => t.stop());

    const mimeType = pickMimeType();
    let recorder;
    try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
        releaseMic();
        throw err;
    }

    const chunks = [];
    recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.start();

    return {
        stop: () =>
            new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    releaseMic();
                    resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }));
                };
                recorder.onerror = (e) => {
                    releaseMic();
                    reject(e.error || new Error('錄音失敗'));
                };
                if (recorder.state === 'inactive') recorder.onstop();
                else recorder.stop();
            }),
        cancel: () => {
            recorder.onstop = null;
            try {
                if (recorder.state !== 'inactive') recorder.stop();
            } catch {
                // 已停止的錄音再 stop 會丟錯，忽略
            }
            releaseMic();
        },
    };
}

/**
 * 把錄音轉成 16kHz 單聲道 WAV
 * iOS 錄出來是 audio/mp4，不在 Gemini 官方支援的音訊格式清單內，統一轉成 WAV 最保險
 * @returns {Promise<{blob: Blob, duration: number}>}
 */
export async function convertToWav(blob, targetRate = 16000) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new AC();
    try {
        const arrayBuffer = await blob.arrayBuffer();
        // 用 callback 形式，相容舊版 Safari 的 decodeAudioData
        const decoded = await new Promise((resolve, reject) => {
            const p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
            if (p && p.then) p.then(resolve, reject);
        });

        const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
        const offline = new OAC(1, length, targetRate);
        const source = offline.createBufferSource();
        source.buffer = decoded;
        source.connect(offline.destination);
        source.start(0);
        const rendered = await new Promise((resolve, reject) => {
            offline.oncomplete = (e) => resolve(e.renderedBuffer);
            const p = offline.startRendering();
            if (p && p.then) p.then(resolve, reject);
        });

        return { blob: encodeWav(rendered.getChannelData(0), targetRate), duration: decoded.duration };
    } finally {
        ctx.close?.();
    }
}

/** 將 PCM 浮點樣本編碼為 16-bit WAV */
function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 單聲道
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

/** Blob 轉 base64（不含 data: 前綴） */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
