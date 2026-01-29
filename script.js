document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // CONFIGURATION
    // ==========================================
    const API_URL = '/api/analyze'; // Points to Vercel/Python backend (prefixed with /api)
    const REPORT_PAGE = 'analyze.html'; // The page to show results

    // ==========================================
    // DOM ELEMENTS (Home Page)
    // ==========================================
    const codeInput = document.getElementById('code-input');
    const lineNumbers = document.getElementById('line-numbers');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analyzeSpinner = document.getElementById('analyze-spinner');
    const btnText = document.getElementById('btn-text'); // or analyze-text
    const langSelect = document.getElementById('language-select');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const formatBadge = document.getElementById('format-badge');

    // ==========================================
    // DOM ELEMENTS (Report Page)
    // ==========================================
    // We check if these exist to know which page we are on
    const riskBanner = document.getElementById('risk-banner');

    // ##################################################################
    // PAGE 1 LOGIC: EDITOR, UPLOAD & ANALYSIS (Home Page)
    // ##################################################################
    
    if (codeInput) {
        console.log("BugSense: Editor Mode Active");

        // --- 1. Line Number & Scroll Sync ---
        const updateLineNumbers = () => {
            const lines = codeInput.value.split('\n').length;
            if(lineNumbers) lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
        };

        codeInput.addEventListener('scroll', () => {
            if(lineNumbers) lineNumbers.scrollTop = codeInput.scrollTop;
        });

        codeInput.addEventListener('input', updateLineNumbers);
        // Initial call
        updateLineNumbers();

        // --- 2. Smart Paste (Clean up messy code) ---
        codeInput.addEventListener('paste', (e) => {
            e.preventDefault();
            let text = (e.clipboardData || window.clipboardData).getData('text');
            
            // Normalize endings and remove excessive gaps
            text = text.replace(/\r\n/g, "\n").replace(/\n\s*\n\s*\n/g, '\n\n');
            
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            const currentText = codeInput.value;
            
            codeInput.value = currentText.substring(0, start) + text + currentText.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + text.length;
            
            updateLineNumbers();

            // Show "Formatted" Badge
            if(formatBadge) {
                formatBadge.classList.remove('hidden');
                setTimeout(() => formatBadge.classList.add('hidden'), 3000);
            }
        });

        // --- 3. File Upload & Auto-Detect ---
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Auto-detect Language
                const ext = file.name.split('.').pop().toLowerCase();
                const langMap = {
                    'py': 'python', 'js': 'javascript', 'ts': 'javascript',
                    'java': 'java', 'c': 'cpp', 'cpp': 'cpp'
                };
                if (langMap[ext] && langSelect) langSelect.value = langMap[ext];

                // Read File
                const reader = new FileReader();
                reader.onload = (e) => {
                    codeInput.value = e.target.result;
                    updateLineNumbers();
                    if(formatBadge) {
                        formatBadge.textContent = "File Loaded";
                        formatBadge.classList.remove('hidden');
                        setTimeout(() => formatBadge.classList.add('hidden'), 3000);
                    }
                };
                reader.readAsText(file);
            });
        }

        // --- 4. THE ANALYZE BUTTON (Connect to Backend) ---
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async () => {
                const code = codeInput.value;
                const lang = langSelect ? langSelect.value : 'auto';
                
                if (!code.trim()) {
                    alert("Please enter code first!");
                    return;
                }

                // UI Loading State
                analyzeBtn.disabled = true;
                if(btnText) btnText.textContent = "Processing...";
                if(analyzeSpinner) analyzeSpinner.classList.remove('hidden');

                try {
                    console.log(`Sending to ${API_URL}...`);
                    
                    const response = await fetch(API_URL, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ code: code, language: lang })
                    });

                    if (!response.ok) throw new Error("Backend connection failed.");

                    const result = await response.json();

                    // SUCCESS: Save data and Redirect
                    console.log("Analysis successful. Redirecting...");
                    localStorage.setItem('bugSenseResults', JSON.stringify(result));
                    
                    // Small delay for UX
                    setTimeout(() => {
                        window.location.href = REPORT_PAGE;
                    }, 500);

                } catch (error) {
                    console.error(error);
                    alert("Error: Could not connect to the Prediction Agent. \n\nCheck if your backend is running.");
                    
                    // Reset UI
                    analyzeBtn.disabled = false;
                    if(btnText) btnText.textContent = "Run Prediction Agent";
                    if(analyzeSpinner) analyzeSpinner.classList.add('hidden');
                }
            });
        }
    }

    // ##################################################################
    // PAGE 2 LOGIC: RENDER REPORT (Report/Analyze Page)
    // ##################################################################
    
    // We detect if we are on the report page by checking for a specific element
    if (document.getElementById('findings-container') || riskBanner) {
        console.log("BugSense: Report Mode Active");

        // 1. Get Data
        const dataString = localStorage.getItem('bugSenseResults');
        if(!dataString) {
            // If no data, send them back home
            window.location.href = 'index.html';
            return;
        }

        const data = JSON.parse(dataString);

        // 2. Populate Metrics
        const elLang = document.getElementById('lang-display');
        const elLoc = document.getElementById('loc-display') || document.getElementById('metric-loc');
        const elComp = document.getElementById('complexity-display') || document.getElementById('metric-complexity');
        const elCrit = document.getElementById('critical-count');

        if(elLang) elLang.textContent = data.language || 'Unknown';
        if(elLoc) elLoc.textContent = data.loc || 0;
        if(elComp) elComp.textContent = data.complexity || 0;
        
        // 3. Risk Banner Logic
        const score = data.risk_score || 0;
        const badgeContainer = document.getElementById('risk-badge-container');
        
        // If using the simple layout
        const riskLevelEl = document.getElementById('risk-level');
        const riskPercentEl = document.getElementById('risk-percentage');
        const riskProgressEl = document.getElementById('risk-progress');
        const riskIconEl = document.getElementById('risk-icon');

        // Determine Theme
        let colorTheme = score < 30 ? 'emerald' : (score < 70 ? 'orange' : 'red');
        let titleText = score < 30 ? 'Safe' : (score < 70 ? 'Warning' : 'Critical');
        let iconName = score < 30 ? 'check-circle' : (score < 70 ? 'alert-triangle' : 'slash');

        // Render Complex Banner (if elements exist)
        if (riskLevelEl && riskPercentEl) {
             riskLevelEl.textContent = titleText;
             riskLevelEl.className = `text-3xl font-black italic tracking-tight text-${colorTheme}-600 dark:text-${colorTheme}-400`;
             
             riskPercentEl.textContent = score + "%";
             riskPercentEl.className = `text-5xl font-black tracking-tighter text-${colorTheme}-600 dark:text-${colorTheme}-400`;

             if(riskIconEl) {
                 riskIconEl.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner bg-${colorTheme}-100 dark:bg-${colorTheme}-900/30 text-${colorTheme}-600 dark:text-${colorTheme}-400`;
                 riskIconEl.innerHTML = `<i data-feather="${iconName}" class="w-8 h-8"></i>`;
             }

             if(riskProgressEl) {
                 riskProgressEl.className = `h-full rounded-full transition-all duration-1000 w-0 bg-${colorTheme}-500`;
                 setTimeout(() => riskProgressEl.style.width = score + "%", 200);
             }
        }

        // Render Badge Container (from turn 12 design)
        if (badgeContainer) {
             badgeContainer.innerHTML = `
                <div class="flex flex-col items-end">
                    <div class="px-5 py-2 rounded-xl font-bold text-lg border bg-${colorTheme}-100 text-${colorTheme}-700 border-${colorTheme}-200 flex items-center gap-2 shadow-sm">
                        <i data-feather="${iconName}" class="w-5 h-5"></i>
                        ${titleText} Risk
                    </div>
                    <div class="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Score: ${score}/100</div>
                </div>
            `;
        }

        // 4. Render Issues List
        const container = document.getElementById('findings-container') || document.getElementById('issues-list');
        let critCount = 0;

        if (container) {
            container.innerHTML = "";
            if (!data.issues || data.issues.length === 0) {
                container.innerHTML = `<div class="p-12 text-center text-slate-400">No vulnerabilities found. Code is clean.</div>`;
            } else {
                data.issues.forEach(issue => {
                    if(issue.severity === 'Critical') critCount++;
                    
                    // Dynamic Colors for Issues
                    let sevColor = issue.severity === 'Critical' ? 'red' : (issue.severity === 'High' ? 'orange' : 'blue');
                    
                    const html = `
                        <div class="p-6 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <div class="flex items-start gap-4">
                                <div class="mt-1 flex-shrink-0">
                                    <span class="px-3 py-1 rounded-md text-xs font-bold border uppercase bg-${sevColor}-100 text-${sevColor}-700 border-${sevColor}-200 dark:bg-${sevColor}-900/30 dark:text-${sevColor}-400 dark:border-${sevColor}-800">
                                        ${issue.severity}
                                    </span>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center justify-between mb-1">
                                        <h3 class="font-bold text-slate-800 dark:text-slate-200 text-lg">${issue.title}</h3>
                                        <span class="text-sm font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">Line ${issue.line}</span>
                                    </div>
                                    <p class="text-slate-600 dark:text-slate-400 leading-relaxed">${issue.description}</p>
                                </div>
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', html);
                });
            }
        }
        
        if(elCrit) elCrit.textContent = critCount;
        
        // Re-init Icons
        if(typeof feather !== 'undefined') feather.replace();
    }
});