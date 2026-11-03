/**
 * Web Speech API 語音辨識服務
 * 支援中文（台灣）語音辨識
 * 修正 iOS 數字尾音截斷問題：累積所有結果，結束時才一次送出
 */

/**
 * 檢查瀏覽器是否支援 Web Speech API
 */
export function isSpeechSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * 建立語音辨識實例
 * @param {Object} options
 * @param {Function} options.onResult - 辨識完成回呼（語音完全結束後才觸發）
 * @param {Function} options.onInterim - 中間結果回呼（即時顯示辨識文字）
 * @param {Function} options.onAudioStart - 麥克風真正開始收音時回呼
 * @param {Function} options.onEnd - 辨識結束回呼，參數為是否有辨識到內容
 * @param {Function} options.onError - 錯誤回呼
 * @param {Function} options.onDebug - 診斷紀錄回呼（每個語音事件都會回報）
 * @returns {SpeechRecognition} 語音辨識實例
 */
export function createSpeechRecognition({ onResult, onInterim, onAudioStart, onEnd, onError, onDebug }) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        throw new Error('此瀏覽器不支援語音辨識');
    }

    const recognition = new SpeechRecognition();
    const debug = (msg) => onDebug && onDebug(msg);

    // 設定中文（台灣）語言
    recognition.lang = 'zh-TW';
    // 持續辨識直到手動停止（避免 iOS 過早截斷）
    recognition.continuous = true;
    // 回傳中間結果（即時顯示辨識中的文字）
    recognition.interimResults = true;
    // 最多回傳 1 個結果
    recognition.maxAlternatives = 1;

    // 累積所有 final 結果
    let accumulatedFinal = '';
    let latestInterim = '';

    // 收音過程的各階段事件，用來判斷卡在哪一步
    recognition.onstart = () => debug('start');
    recognition.onaudiostart = () => {
        debug('audiostart（麥克風收音中）');
        if (onAudioStart) onAudioStart();
    };
    recognition.onsoundstart = () => debug('soundstart（偵測到聲音）');
    recognition.onspeechstart = () => debug('speechstart（偵測到人聲）');
    recognition.onspeechend = () => debug('speechend');
    recognition.onaudioend = () => debug('audioend');
    recognition.onnomatch = () => debug('nomatch');

    recognition.onresult = (event) => {
        let currentInterim = '';
        let fullFinal = '';

        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                fullFinal += transcript;
            } else {
                currentInterim += transcript;
            }
        }
        accumulatedFinal = fullFinal;
        latestInterim = currentInterim;
        debug(`result：${(fullFinal + currentInterim).slice(0, 20)}`);

        // 顯示即時中間結果（final + interim 合併顯示）
        const displayText = accumulatedFinal + currentInterim;
        if (displayText && onInterim) {
            onInterim(displayText);
        }
    };

    recognition.onend = () => {
        // 語音辨識完全結束後，才送出最終結果
        const finalText = (accumulatedFinal || latestInterim).trim();
        debug(`end（${finalText ? '有內容' : '無內容'}）`);
        if (finalText && onResult) {
            onResult(finalText);
        }
        if (onEnd) onEnd(!!finalText);
        detach(recognition);
    };

    recognition.onerror = (event) => {
        debug(`error：${event.error}`);
        // no-speech 不算致命錯誤，讓 onEnd 處理
        if (event.error !== 'no-speech' && onError) {
            onError(event.error);
        }
    };

    return recognition;
}

/** 解除實例上所有事件 handler */
function detach(recognition) {
    recognition.onstart = null;
    recognition.onaudiostart = null;
    recognition.onsoundstart = null;
    recognition.onspeechstart = null;
    recognition.onspeechend = null;
    recognition.onaudioend = null;
    recognition.onnomatch = null;
    recognition.onresult = null;
    recognition.onend = null;
    recognition.onerror = null;
}

/**
 * 強制釋放語音辨識實例（開始新的辨識前呼叫）
 */
export function disposeRecognition(recognition) {
    if (!recognition) return;
    try {
        detach(recognition);
        recognition.abort();
    } catch {
        // 已結束的實例 abort 會丟錯，忽略即可
    }
}
