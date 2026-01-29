/**
 * =========================================================
 * BugAnalyzer – Frontend Controller (FINAL)
 * =========================================================
 * Handles: Editor interactions, Backend API calls, and Report Rendering.
 */

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. CONFIGURATION
    // ==========================================
    // Matches your vercel.json rewrite: /api/analyze -> main.py
    const API_URL = "/api/analyze"; 
    
    // Matches your vercel.json route: /analyze -> analysis.html
    const REPORT_ROUTE = "/analyze"; 

    // ==========================================
    // 2. TAILWIND COLOR MAP (Safe for JIT)
    // ==========================================
    // We use a map instead of string interpolation (e.g. `bg-${color}-500`)
    // to ensure Tailwind doesn't purge these classes during production builds.
    const THEMES = {
        safe: {
            color: 'emerald',
            text: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            border: 'border-emerald-200 dark:border-emerald-800',
            progress: 'bg-emerald-500',
            badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            icon: 'check-circle'
        },
        warning: {
            color: 'orange',
            text: 'text-orange-600 dark:text-orange-400',
            bg: 'bg-orange-100 dark:bg-orange-900/30',
            border: 'border-orange-200 dark:border-orange-800',
            progress: 'bg-orange-500',
            badge: 'bg-orange-100 text-orange-700 border-orange-200',
            icon: 'alert-triangle'
        },
        critical: {
            color: 'red',
            text: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-100 dark:bg-red-900/30',
            border: 'border-red-200 dark:border-red-800',
            progress: 'bg-red-500',
            badge: 'bg-red-100 text-red-700 border-red-200',
            icon: 'slash'
        }
    };

    // ==========================================
    // 3. DOM ELEMENTS
    // ==========================================
    // Home Page Elements
    const codeInput = document.getElementById("code-input");
    const lineNumbers = document.getElementById("line-numbers");
    const analyzeBtn = document.getElementById("analyze-btn");
    const analyzeSpinner = document.getElementById("analyze-spinner");
    const btnText = document.getElementById("analyze-text"); // Updated ID to match HTML
    const langSelect = document.getElementById("language-select");
    const uploadBtn = document.getElementById("upload-btn");
    const fileInput = document.getElementById("file-input");
    const formatBadge = document.getElementById("format-badge"); // Optional badge

    // Report Page Elements
    const findingsContainer = document.getElementById("issues-list");
    const riskBanner = document.getElementById("risk-banner");

    // ==========================================
    // 4. LOGIC: EDITOR PAGE (index.html)
    // ==========================================
    if (codeInput) {
        console.log("BugAnalyzer: Editor Initialized");

        // --- Line Numbers Logic ---
        const updateLineNumbers = () => {
            const lines = codeInput.value.split("\n").length;
            // Using <br> allows exact line mapping even with empty lines
            lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join("<br>");
        };

        // Sync Scroll
        codeInput.addEventListener("scroll", () => {
            lineNumbers.scrollTop = codeInput.scrollTop;
        });

        // Sync Content
        codeInput.addEventListener("input", updateLineNumbers);
        
        // Initialize
        updateLineNumbers();

        // --- Smart Paste (Fixes indentation/newlines) ---
        codeInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData("text");
            // Normalize newlines
            const cleanText = text.replace(/\r\n/g, "\n");
            
            // Insert at cursor
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            const original = codeInput.value;
            
            codeInput.value = original.substring(0, start) + cleanText + original.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + cleanText.length;
            
            updateLineNumbers();
        });

        // --- File Upload ---
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener("click", () => fileInput.click());
            
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Auto-detect language by extension
                const ext = file.name.split(".").pop().toLowerCase();
                const map = { py: "python", js: "javascript", java: "java", cpp: "cpp", c: "cpp" };
                if (langSelect && map[ext]) langSelect.value = map[ext];

                const reader = new FileReader();
                reader.onload = (ev) => {
                    codeInput.value = ev.target.result;
                    updateLineNumbers();
                };
                reader.readAsText(file);
            });
        }

        // --- API Call ---
        if (analyzeBtn) {
            analyzeBtn.addEventListener("click", async () => {
                const code = codeInput.value.trim();
                
                if (!code) {
                    alert("Please enter some code to analyze.");
                    return;
                }

                // 1. UI Loading State
                analyzeBtn.disabled = true;
                analyzeBtn.classList.add("opacity-75", "cursor-wait");
                if (btnText) btnText.textContent = "Analyzing...";
                if (analyzeSpinner) analyzeSpinner.classList.remove("hidden");

                try {
                    // 2. Fetch from Backend
                    const res = await fetch(API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: codeInput.value, // Send raw value to preserve formatting
                            language: langSelect ? langSelect.value : "auto"
                        })
                    });

                    // 3. Handle Errors
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.detail || "Analysis failed");
                    }

                    // 4. Success: Save & Redirect
                    const data = await res.json();
                    localStorage.setItem("bugAnalyzerResults", JSON.stringify(data));
                    
                    // Redirect to the report page defined in Vercel routes
                    window.location.href = REPORT_ROUTE; 

                } catch (err) {
                    console.error("Analysis Error:", err);
                    alert("Error connecting to analysis engine.\nCheck console for details.");
                    
                    // Reset UI
                    analyzeBtn.disabled = false;
                    analyzeBtn.classList.remove("opacity-75", "cursor-wait");
                    if (btnText) btnText.textContent = "Run Prediction Agent";
                    if (analyzeSpinner) analyzeSpinner.classList.add("hidden");
                }
            });
        }
    }

    // ==========================================
    // 5. LOGIC: REPORT PAGE (analysis.html)
    // ==========================================
    if (riskBanner) {
        console.log("BugAnalyzer: Report Mode Active");

        // 1. Retrieve Data
        const rawData = localStorage.getItem("bugAnalyzerResults");
        if (!rawData) {
            window.location.href = "/"; // Redirect home if no data
            return;
        }
        const data = JSON.parse(rawData);

        // 2. Determine Theme based on Risk Score
        const score = data.risk_score || 0;
        let themeKey = 'safe';
        if (score >= 70) themeKey = 'critical';
        else if (score >= 30) themeKey = 'warning';
        
        const theme = THEMES[themeKey];

        // 3. Update Banner UI
        const riskLevelTxt = document.getElementById("risk-level");
        const riskPercentTxt = document.getElementById("risk-percentage");
        const riskIconContainer = document.getElementById("risk-icon");
        const riskProgressBar = document.getElementById("risk-progress");

        if (riskLevelTxt) {
            riskLevelTxt.textContent = themeKey === 'safe' ? 'Low Risk' : (themeKey === 'critical' ? 'Critical' : 'Warning');
            riskLevelTxt.className = `text-3xl font-black italic tracking-tight ${theme.text}`;
        }

        if (riskPercentTxt) {
            riskPercentTxt.textContent = `${score}%`;
            riskPercentTxt.className = `text-5xl font-black tracking-tighter ${theme.text}`;
        }

        if (riskIconContainer) {
            riskIconContainer.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${theme.bg}`;
            riskIconContainer.innerHTML = `<i data-feather="${theme.icon}" class="w-8 h-8 ${theme.text.split(' ')[0]}"></i>`;
        }

        if (riskProgressBar) {
            riskProgressBar.className = `h-full rounded-full transition-all duration-1000 w-0 ${theme.progress}`;
            // Small timeout to trigger CSS transition
            setTimeout(() => {
                riskProgressBar.style.width = `${score}%`;
            }, 100);
        }

        // 4. Update Metrics Sidebar
        document.getElementById("metric-loc").textContent = data.loc || 0;
        document.getElementById("metric-loops").textContent = data.loops || 0;
        document.getElementById("metric-complexity").textContent = data.complexity || 0;

        // 5. Render Findings List
        if (findingsContainer) {
            findingsContainer.innerHTML = ""; // Clear placeholders

            if (!data.issues || data.issues.length === 0) {
                findingsContainer.innerHTML = `
                    <div class="text-center py-12">
                        <div class="inline-flex p-4 rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
                            <i data-feather="check-shield" class="w-8 h-8 text-emerald-500"></i>
                        </div>
                        <h3 class="text-lg font-bold text-slate-700 dark:text-slate-300">Clean Code Detected</h3>
                        <p class="text-slate-500">No known patterns were found in this scan.</p>
                    </div>
                `;
            } else {
                data.issues.forEach(issue => {
                    // Map API severity to Theme keys
                    let severityKey = 'safe';
                    if (issue.severity === 'Critical') severityKey = 'critical';
                    else if (issue.severity === 'High') severityKey = 'warning';
                    
                    const itemTheme = THEMES[severityKey];

                    const html = `
                    <div class="p-6 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <div class="flex items-start gap-4">
                            <div class="flex-shrink-0 mt-1">
                                <span class="px-2.5 py-0.5 rounded text-xs font-bold border uppercase ${itemTheme.bg} ${itemTheme.text.split(' ')[0]} ${itemTheme.border}">
                                    ${issue.severity}
                                </span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between mb-1">
                                    <h5 class="text-base font-bold text-slate-800 dark:text-slate-200 truncate">
                                        ${issue.title}
                                    </h5>
                                    <span class="text-xs font-mono text-slate-500">Line ${issue.line}</span>
                                </div>
                                <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    ${issue.description}
                                </p>
                            </div>
                        </div>
                    </div>`;
                    
                    findingsContainer.insertAdjacentHTML('beforeend', html);
                });
            }
        }
        
        // Re-initialize icons for dynamic content
        if (window.feather) window.feather.replace();
    }

    // Initialize icons on load
    if (window.feather) window.feather.replace();
});
