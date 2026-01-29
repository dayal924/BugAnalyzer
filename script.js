document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. GLOBAL UTILITIES & CONFIG
    // ==========================================
    const CONFIG = {
        API_URL: '/api/analyze',        // Points to Vercel Serverless Function
        REPORT_PAGE: 'analyze.html',    // The results page
        MAX_FILE_SIZE_MB: 5,            // Max upload limit
        REQUEST_TIMEOUT: 15000,         // 15s timeout for Vercel functions
    };

    /**
     * Stabilizer: Debounce function 
     * NOTE: Used for network requests, NOT for typing sync.
     */
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

    /**
     * Stabilizer: Retry logic for serverless cold starts
     */
    async function fetchWithRetry(url, options, retries = 2) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (retries > 0 && (response.status === 504 || response.status === 500)) {
                    console.log(`Retrying request... Attempts left: ${retries}`);
                    await new Promise(res => setTimeout(res, 1000)); 
                    return fetchWithRetry(url, options, retries - 1);
                }
                throw new Error(`Server returned status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                console.warn("Connection unstable, retrying...", error);
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

    // Report Page Elements
    const riskBanner = document.getElementById('risk-banner');
    const findingsContainer = document.getElementById('findings-container') || document.getElementById('issues-list');

    // ==========================================
    // 2. PAGE LOGIC: EDITOR & HOME (Home Page)
    // ==========================================
    
    if (codeInput) {
        console.log("BugSense: Editor Mode Initialized");

        // --- A. Synchronized Scrolling (Stabilized) ---
        let isScrolling = false;
        
        const syncScroll = () => {
            if(lineNumbers) {
                lineNumbers.scrollTop = codeInput.scrollTop;
            }
            isScrolling = false;
        };

        codeInput.addEventListener('scroll', () => {
            if (!isScrolling) {
                window.requestAnimationFrame(syncScroll);
                isScrolling = true;
            }
        }, { passive: true });

        // --- B. Line Number Logic (FLICKER FIX) ---
        const updateLineNumbers = () => {
            // Count lines
            const lines = codeInput.value.split('\n').length;
            
            // Get current line count from DOM
            const currentLineCount = lineNumbers.children.length || 0;

            // OPTIMIZATION: Only touch the DOM if the number of lines actually changed.
            // This prevents the "flash" of rebuilding the list on every character type.
            if (lines !== currentLineCount) {
                lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
            }
        };

        // *** CRITICAL FIX HERE ***
        // Removed 'debounce'. We need 1:1 instant syncing when you press Enter.
        codeInput.addEventListener('input', updateLineNumbers);
        
        // Also sync on window resize to ensure alignment
        window.addEventListener('resize', updateLineNumbers);

        // Run once immediately
        updateLineNumbers();

        // --- C. Smart Paste (Auto-Formatter) ---
        codeInput.addEventListener('paste', (e) => {
            e.preventDefault();
            let text = (e.clipboardData || window.clipboardData).getData('text');
            
            // Normalize: Windows (\r\n) -> Unix (\n)
            text = text.replace(/\r\n/g, "\n").replace(/\n\s*\n\s*\n/g, '\n\n');
            
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            const currentText = codeInput.value;
            
            codeInput.value = currentText.substring(0, start) + text + currentText.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + text.length;
            
            updateLineNumbers();

            if(formatBadge) {
                formatBadge.textContent = "Code Formatted";
                formatBadge.classList.remove('hidden');
                formatBadge.classList.add('animate-fade-in'); 
                setTimeout(() => formatBadge.classList.add('hidden'), 3000);
            }
        });

        // --- D. File Upload Handler ---
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
                    alert(`File is too large! Max size is ${CONFIG.MAX_FILE_SIZE_MB}MB.`);
                    return;
                }

                const ext = file.name.split('.').pop().toLowerCase();
                const langMap = {
                    'py': 'python', 'js': 'javascript', 'jsx': 'javascript',
                    'ts': 'javascript', 'tsx': 'javascript',
                    'java': 'java', 'c': 'cpp', 'cpp': 'cpp', 'cs': 'csharp',
                    'go': 'go', 'rs': 'rust'
                };
                
                if (langMap[ext] && langSelect) {
                    langSelect.value = langMap[ext];
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    codeInput.value = e.target.result;
                    updateLineNumbers();
                    
                    if(formatBadge) {
                        formatBadge.textContent = `Loaded: ${file.name}`;
                        formatBadge.classList.remove('hidden');
                        setTimeout(() => formatBadge.classList.add('hidden'), 3000);
                    }
                };
                
                reader.onerror = () => {
                    alert("Error reading file.");
                };
                
                reader.readAsText(file);
                fileInput.value = ''; 
            });
        }

        // --- E. Analyze Button ---
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async () => {
                const code = codeInput.value;
                const lang = langSelect ? langSelect.value : 'auto';
                
                if (!code.trim()) {
                    if (codeInput) codeInput.classList.add('ring-2', 'ring-red-500');
                    setTimeout(() => codeInput.classList.remove('ring-2', 'ring-red-500'), 500);
                    alert("Please enter code or upload a file first.");
                    return;
                }

                analyzeBtn.disabled = true;
                if(btnText) btnText.textContent = "Analyzing Code...";
                if(analyzeSpinner) analyzeSpinner.classList.remove('hidden');

                try {
                    console.log(`Connecting to prediction agent at ${CONFIG.API_URL}...`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

                    const response = await fetchWithRetry(CONFIG.API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ 
                            code: code, 
                            language: lang,
                            timestamp: Date.now() 
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    const result = await response.json();
                    
                    localStorage.setItem('bugSenseResults', JSON.stringify({
                        ...result,
                        timestamp: new Date().toISOString()
                    }));
                    
                    if(btnText) btnText.textContent = "Redirecting...";
                    setTimeout(() => {
                        window.location.href = CONFIG.REPORT_PAGE;
                    }, 500);

                } catch (error) {
                    console.error("Analysis Failed:", error);
                    
                    let errorMessage = "Could not reach the analysis engine.";
                    if (error.name === 'AbortError') {
                        errorMessage = "Analysis timed out. The server might be waking up (Cold Start). Please try again.";
                    } else if (error.message.includes("Server returned status")) {
                        errorMessage = "The analysis server encountered an error. Please check your code syntax.";
                    }

                    alert(`Analysis Failed:\n${errorMessage}`);
                    
                    analyzeBtn.disabled = false;
                    if(btnText) btnText.textContent = "Run Prediction Agent";
                    if(analyzeSpinner) analyzeSpinner.classList.add('hidden');
                }
            });
        }
    }

    // ==========================================
    // 3. PAGE LOGIC: REPORT RENDERER
    // ==========================================
    if (findingsContainer || riskBanner) {
        console.log("BugSense: Report Mode Initialized");

        const dataString = localStorage.getItem('bugSenseResults');
        
        if(!dataString) {
            console.warn("No analysis data found. Redirecting to home.");
            window.location.href = 'index.html';
            return;
        }

        let data;
        try {
            data = JSON.parse(dataString);
        } catch(e) {
            console.error("Corrupt data found.");
            localStorage.removeItem('bugSenseResults');
            window.location.href = 'index.html';
            return;
        }

        const setSafeText = (id, text) => {
            const el = document.getElementById(id);
            if(el) el.textContent = text;
        };

        setSafeText('lang-display', data.language || 'Detected Code');
        setSafeText('loc-display', data.loc || data.lines_of_code || 'N/A');
        setSafeText('complexity-display', data.complexity || 'Low');
        
        const score = data.risk_score !== undefined ? data.risk_score : (data.score || 0);

        const riskLevelEl = document.getElementById('risk-level');
        const riskPercentEl = document.getElementById('risk-percentage');
        const riskProgressEl = document.getElementById('risk-progress');
        const riskIconEl = document.getElementById('risk-icon');
        const badgeContainer = document.getElementById('risk-badge-container');

        let colorTheme, titleText, iconName;
        
        if (score < 30) {
            colorTheme = 'emerald';
            titleText = 'Safe';
            iconName = 'check-circle';
        } else if (score < 70) {
            colorTheme = 'orange'; 
            titleText = 'Warning';
            iconName = 'alert-triangle';
        } else {
            colorTheme = 'red';
            titleText = 'Critical';
            iconName = 'slash'; 
        }

        if (riskLevelEl) {
             riskLevelEl.textContent = titleText;
             riskLevelEl.className = `text-3xl font-black italic tracking-tight text-${colorTheme}-600 dark:text-${colorTheme}-400`;
        }

        if (riskPercentEl) {
             riskPercentEl.textContent = `${score}%`;
             riskPercentEl.className = `text-5xl font-black tracking-tighter text-${colorTheme}-600 dark:text-${colorTheme}-400`;
        }

        if (riskIconEl) {
             riskIconEl.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner bg-${colorTheme}-100 dark:bg-${colorTheme}-900/30 text-${colorTheme}-600 dark:text-${colorTheme}-400 transition-colors duration-500`;
             riskIconEl.innerHTML = `<i data-feather="${iconName}" class="w-8 h-8"></i>`;
        }

        if (riskProgressEl) {
             riskProgressEl.className = `h-full rounded-full transition-all duration-1000 ease-out w-0 bg-${colorTheme}-500`;
             setTimeout(() => {
                 riskProgressEl.style.width = `${score}%`;
             }, 300);
        }

        if (badgeContainer) {
             badgeContainer.innerHTML = `
                <div class="flex flex-col items-end animate-fade-in-up">
                    <div class="px-5 py-2 rounded-xl font-bold text-lg border bg-${colorTheme}-100 text-${colorTheme}-700 border-${colorTheme}-200 flex items-center gap-2 shadow-sm">
                        <i data-feather="${iconName}" class="w-5 h-5"></i>
                        ${titleText} Risk
                    </div>
                    <div class="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                        Security Score: ${score}/100
                    </div>
                </div>
            `;
        }

        let critCount = 0;

        if (findingsContainer) {
            findingsContainer.innerHTML = ""; 

            if (!data.issues || data.issues.length === 0) {
                findingsContainer.innerHTML = `
                    <div class="p-12 text-center flex flex-col items-center justify-center text-slate-400">
                        <i data-feather="shield" class="w-12 h-12 mb-4 text-emerald-400 opacity-50"></i>
                        <p class="text-lg">No vulnerabilities found.</p>
                        <p class="text-sm">Your code appears clean and secure.</p>
                    </div>`;
            } else {
                const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                const sortedIssues = data.issues.sort((a, b) => 
                    (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
                );

                sortedIssues.forEach((issue, index) => {
                    if(issue.severity === 'Critical') critCount++;
                    
                    let sevColor = 'blue'; 
                    if (issue.severity === 'Critical') sevColor = 'red';
                    else if (issue.severity === 'High') sevColor = 'orange';
                    else if (issue.severity === 'Medium') sevColor = 'yellow';

                    const issueCard = document.createElement('div');
                    issueCard.style.animationDelay = `${index * 100}ms`;
                    issueCard.className = `
                        p-6 border-b border-slate-100 dark:border-slate-800 
                        hover:bg-slate-50 dark:hover:bg-slate-800/50 
                        transition-all duration-300 group animate-fade-in
                    `;
                    
                    issueCard.innerHTML = `
                        <div class="flex items-start gap-4">
                            <div class="mt-1 flex-shrink-0">
                                <span class="px-3 py-1 rounded-md text-xs font-bold border uppercase 
                                    bg-${sevColor}-100 text-${sevColor}-700 border-${sevColor}-200 
                                    dark:bg-${sevColor}-900/30 dark:text-${sevColor}-400 dark:border-${sevColor}-800">
                                    ${issue.severity}
                                </span>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-1">
                                    <h3 class="font-bold text-slate-800 dark:text-slate-200 text-lg group-hover:text-indigo-500 transition-colors">
                                        ${issue.title}
                                    </h3>
                                    ${issue.line ? `
                                    <span class="text-sm font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                        Line ${issue.line}
                                    </span>` : ''}
                                </div>
                                <p class="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                                    ${issue.description}
                                </p>
                                ${issue.suggestion ? `
                                <div class="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800 text-sm font-mono text-slate-500">
                                    <span class="font-bold text-indigo-500">Fix:</span> ${issue.suggestion}
                                </div>` : ''}
                            </div>
                        </div>
                    `;
                    
                    findingsContainer.appendChild(issueCard);
                });
            }
        }
        
        setSafeText('critical-count', critCount);
        
        if(typeof feather !== 'undefined') {
            feather.replace();
        }
    }
});
