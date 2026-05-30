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
 * @param {Function} options.onEnd - 辨識結束回呼
 * @param {Function} options.onError - 錯誤回呼
 * @returns {SpeechRecognition} 語音辨識實例
 */
export function createSpeechRecognition({ onResult, onInterim, onEnd, onError }) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        throw new Error('此瀏覽器不支援語音辨識');
    }

    const recognition = new SpeechRecognition();

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

    recognition.onresult = (event) => {
        let currentInterim = '';

        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                // 重新計算所有 final 結果（避免重複累加）
            } else {
                currentInterim += transcript;
            }
        }

        // 重新計算完整的 final 文字
        let fullFinal = '';
        for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                fullFinal += event.results[i][0].transcript;
            }
        }
        accumulatedFinal = fullFinal;
        latestInterim = currentInterim;

        // 顯示即時中間結果（final + interim 合併顯示）
        const displayText = accumulatedFinal + currentInterim;
        if (displayText && onInterim) {
            onInterim(displayText);
        }
    };

    recognition.onend = () => {
        // 語音辨識完全結束後，才送出最終結果
        const finalText = (accumulatedFinal || latestInterim).trim();
        if (finalText && onResult) {
            onResult(finalText);
        }
        if (onEnd) onEnd();
    };

    recognition.onerror = (event) => {
        console.error('語音辨識錯誤:', event.error);
        // no-speech 不算致命錯誤，讓 onEnd 處理
        if (event.error !== 'no-speech' && onError) {
            onError(event.error);
        }
    };

    return recognition;
}
