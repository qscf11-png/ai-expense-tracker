/**
 * Web Speech API 語音辨識服務
 * 支援中文（台灣）語音辨識
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
 * @param {Function} options.onResult - 辨識結果回呼函式
 * @param {Function} options.onInterim - 中間結果回呼函式（即時顯示辨識文字）
 * @param {Function} options.onEnd - 辨識結束回呼函式
 * @param {Function} options.onError - 錯誤回呼函式
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
    // 持續辨識直到手動停止
    recognition.continuous = false;
    // 回傳中間結果（即時顯示辨識中的文字）
    recognition.interimResults = true;
    // 最多回傳 1 個結果
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (interimTranscript && onInterim) {
            onInterim(interimTranscript);
        }

        if (finalTranscript && onResult) {
            onResult(finalTranscript);
        }
    };

    recognition.onend = () => {
        if (onEnd) onEnd();
    };

    recognition.onerror = (event) => {
        console.error('語音辨識錯誤:', event.error);
        if (onError) onError(event.error);
    };

    return recognition;
}
