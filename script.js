document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🔐 HARD STABILITY GUARD (DEPLOY FIX)
    // ==========================================
    if (window.__BUGSENSE_APP_INITIALIZED__) {
        console.warn("BugSense already initialized. Skipping duplicate execution.");
        return;
    }
    window.__BUGSENSE_APP_INITIALIZED__ = true;

    // Hide UI until layout + JS stabilizes
    document.documentElement.classList.add('js-loading');

    // ==========================================
    // 0. GLOBAL UTILITIES & CONFIG
    // ==========================================
    const CONFIG = {
        API_URL: '/api/analyze',
        REPORT_PAGE: 'analyze.html',
        MAX_FILE_SIZE_MB: 5,
        REQUEST_TIMEOUT: 15000,
    };

    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    async function fetchWithRetry(url, options, retries = 2) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (retries > 0 && (response.status === 504 || response.status === 500)) {
                    await new Promise(res => setTimeout(res, 1000));
                    return fetchWithRetry(url, options, retries - 1);
                }
                throw new Error(`Server returned status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                await new Promise(res => setTimeout(res, 1000));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    // ==========================================
    // 1. DOM ELEMENTS
    // ==========================================
    const codeInput = document.getElementById('code-input');
    const lineNumbers = document.getElementById('line-numbers');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analyzeSpinner = document.getElementById('analyze-spinner');
    const btnText = document.getElementById('btn-text');
    const langSelect = document.getElementById('language-select');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const formatBadge = document.getElementById('format-badge');

    const riskBanner = document.getElementById('risk-banner');
    const findingsContainer = document.getElementById('findings-container') || document.getElementById('issues-list');

    // ==========================================
    // 2. HOME / EDITOR PAGE
    // ==========================================
    if (codeInput) {

        let isScrolling = false;
        const syncScroll = () => {
            if (lineNumbers) lineNumbers.scrollTop = codeInput.scrollTop;
            isScrolling = false;
        };

        codeInput.addEventListener('scroll', () => {
            if (!isScrolling) {
                requestAnimationFrame(syncScroll);
                isScrolling = true;
            }
        }, { passive: true });

        const updateLineNumbers = () => {
            const lines = codeInput.value.split('\n').length;
            const current = lineNumbers.children.length || 0;
            if (lines !== current) {
                lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
            }
        };

        codeInput.addEventListener('input', updateLineNumbers);

        // Resize stabilization
        const safeResizeUpdate = debounce(updateLineNumbers, 100);
        window.addEventListener('resize', safeResizeUpdate);

        updateLineNumbers();

        codeInput.addEventListener('paste', (e) => {
            e.preventDefault();
            let text = (e.clipboardData || window.clipboardData).getData('text');
            text = text.replace(/\r\n/g, "\n").replace(/\n\s*\n\s*\n/g, '\n\n');

            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            codeInput.value =
                codeInput.value.substring(0, start) +
                text +
                codeInput.value.substring(end);

            codeInput.selectionStart = codeInput.selectionEnd = start + text.length;
            updateLineNumbers();

            if (formatBadge) {
                formatBadge.textContent = "Code Formatted";
                formatBadge.classList.remove('hidden');
                setTimeout(() => formatBadge.classList.add('hidden'), 3000);
            }
        });

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
                    alert("File too large");
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    codeInput.value = e.target.result;
                    updateLineNumbers();
                };
                reader.readAsText(file);
                fileInput.value = '';
            });
        }

        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async () => {
                if (!codeInput.value.trim()) {
                    alert("Enter code first");
                    return;
                }

                analyzeBtn.disabled = true;
                if (btnText) btnText.textContent = "Analyzing...";
                if (analyzeSpinner) analyzeSpinner.classList.remove('hidden');

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

                    const response = await fetchWithRetry(CONFIG.API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code: codeInput.value,
                            language: langSelect?.value || 'auto',
                            timestamp: Date.now()
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    const result = await response.json();
                    localStorage.setItem('bugSenseResults', JSON.stringify(result));
                    window.location.href = CONFIG.REPORT_PAGE;

                } catch (e) {
                    alert("Analysis failed");
                    analyzeBtn.disabled = false;
                    if (btnText) btnText.textContent = "Run Prediction Agent";
                    if (analyzeSpinner) analyzeSpinner.classList.add('hidden');
                }
            });
        }
    }

    // ==========================================
    // 3. REPORT PAGE
    // ==========================================
    if (findingsContainer || riskBanner) {
        const raw = localStorage.getItem('bugSenseResults');
        if (!raw) {
            window.location.href = 'index.html';
            return;
        }

        const data = JSON.parse(raw);
        if (findingsContainer) findingsContainer.innerHTML = "";

        if (typeof feather !== 'undefined') feather.replace();
    }

    // ==========================================
    // ✅ FINAL UI REVEAL (NO FLICKER)
    // ==========================================
    const revealUI = () => {
        document.documentElement.classList.remove('js-loading');
    };

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(revealUI);
            });
        });
    } else {
        requestAnimationFrame(() => {
            requestAnimationFrame(revealUI);
        });
    }

});
