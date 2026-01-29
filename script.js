/**
 * =========================================================
 * BugAnalyzer – Frontend Controller (FINAL & STABLE)
 * =========================================================
 * Fixes:
 * - Stops Icon Flickering (Optimized feather.replace)
 * - Stabilizes Editor Scrolling
 * - Prevents Layout Shifts during Analysis
 */

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. CONFIGURATION
    // ==========================================
    const API_URL = "/api/analyze"; 
    const REPORT_ROUTE = "/analyze"; 

    // ==========================================
    // 2. THEME CONFIGURATION
    // ==========================================
    const THEMES = {
        safe: {
            color: 'emerald',
            text: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            border: 'border-emerald-200 dark:border-emerald-800',
            progress: 'bg-emerald-500',
            icon: 'check-circle'
        },
        warning: {
            color: 'orange',
            text: 'text-orange-600 dark:text-orange-400',
            bg: 'bg-orange-100 dark:bg-orange-900/30',
            border: 'border-orange-200 dark:border-orange-800',
            progress: 'bg-orange-500',
            icon: 'alert-triangle'
        },
        critical: {
            color: 'red',
            text: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-100 dark:bg-red-900/30',
            border: 'border-red-200 dark:border-red-800',
            progress: 'bg-red-500',
            icon: 'slash'
        }
    };

    // ==========================================
    // 3. DOM ELEMENTS
    // ==========================================
    const codeInput = document.getElementById("code-input");
    const lineNumbers = document.getElementById("line-numbers");
    const analyzeBtn = document.getElementById("analyze-btn");
    const analyzeSpinner = document.getElementById("analyze-spinner");
    const btnText = document.getElementById("analyze-text");
    const langSelect = document.getElementById("language-select");
    const uploadBtn = document.getElementById("upload-btn");
    const fileInput = document.getElementById("file-input");
    const riskBanner = document.getElementById("risk-banner");
    const findingsContainer = document.getElementById("issues-list");

    // ==========================================
    // 4. EDITOR LOGIC (Home Page)
    // ==========================================
    if (codeInput) {
        console.log("BugAnalyzer: Editor Ready");

        // --- Optimized Line Numbers (Prevents layout thrashing) ---
        const updateLineNumbers = () => {
            const lines = codeInput.value.split("\n").length;
            const currentLines = lineNumbers.childElementCount;

            // Only update DOM if line count actually changed
            if (lines !== currentLines) {
                lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join("<br>");
            }
        };

        // Sync Scroll (High Performance)
        codeInput.addEventListener("scroll", () => {
            lineNumbers.scrollTop = codeInput.scrollTop;
        }, { passive: true });

        // Sync Input
        codeInput.addEventListener("input", updateLineNumbers);
        
        // Initial Draw
        updateLineNumbers();

        // --- Smart Paste ---
        codeInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData("text");
            // Normalize content to prevent jumpiness
            const cleanText = text.replace(/\r\n/g, "\n");
            
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            const original = codeInput.value;
            
            codeInput.value = original.substring(0, start) + cleanText + original.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + cleanText.length;
            
            updateLineNumbers();
        });

        // --- File Upload ---
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener("click", (e) => {
                e.preventDefault(); // Stop any default button flashing
                fileInput.click();
            });
            
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (!file) return;

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

        // --- Analyze Action ---
        if (analyzeBtn) {
            analyzeBtn.addEventListener("click", async (e) => {
                e.preventDefault(); // Critical: prevents form submit refresh
                
                const code = codeInput.value.trim();
                if (!code) {
                    alert("Please enter code first.");
                    return;
                }

                // Lock UI
                analyzeBtn.disabled = true;
                analyzeBtn.classList.add("opacity-75", "cursor-wait");
                if (btnText) btnText.textContent = "Analyzing...";
                if (analyzeSpinner) analyzeSpinner.classList.remove("hidden");

                try {
                    const res = await fetch(API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: codeInput.value,
                            language: langSelect ? langSelect.value : "auto"
                        })
                    });

                    if (!res.ok) throw new Error("Analysis failed");

                    const data = await res.json();
                    localStorage.setItem("bugAnalyzerResults", JSON.stringify(data));
                    
                    // Smooth Redirect
                    window.location.href = REPORT_ROUTE;

                } catch (err) {
                    console.error(err);
                    alert("Connection failed. Check your backend.");
                    
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
    // 5. REPORT LOGIC (Analysis Page)
    // ==========================================
    if (riskBanner) {
        console.log("BugAnalyzer: Report Ready");

        const rawData = localStorage.getItem("bugAnalyzerResults");
        if (!rawData) {
            window.location.href = "/";
            return;
        }
        const data = JSON.parse(rawData);

        // Theme Selection
        const score = data.risk_score || 0;
        let themeKey = 'safe';
        if (score >= 70) themeKey = 'critical';
        else if (score >= 30) themeKey = 'warning';
        const theme = THEMES[themeKey];

        // Update Header Elements
        const elLevel = document.getElementById("risk-level");
        const elPercent = document.getElementById("risk-percentage");
        const elIcon = document.getElementById("risk-icon");
        const elProgress = document.getElementById("risk-progress");

        if (elLevel) {
            elLevel.textContent = themeKey === 'safe' ? 'Low Risk' : (themeKey === 'critical' ? 'Critical' : 'Warning');
            elLevel.className = `text-3xl font-black italic tracking-tight ${theme.text}`;
        }

        if (elPercent) {
            elPercent.textContent = `${score}%`;
            elPercent.className = `text-5xl font-black tracking-tighter ${theme.text}`;
        }

        if (elIcon) {
            // Set class directly instead of repeated replaces
            elIcon.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${theme.bg}`;
            elIcon.innerHTML = `<i data-feather="${theme.icon}" class="w-8 h-8 ${theme.text.split(' ')[0]}"></i>`;
        }

        if (elProgress) {
            elProgress.className = `h-full rounded-full transition-all duration-1000 w-0 ${theme.progress}`;
            setTimeout(() => elProgress.style.width = `${score}%`, 100);
        }

        // Update Metrics
        document.getElementById("metric-loc").textContent = data.loc || 0;
        document.getElementById("metric-loops").textContent = data.loops || 0;
        document.getElementById("metric-complexity").textContent = data.complexity || 0;

        // Render List
        if (findingsContainer) {
            findingsContainer.innerHTML = "";
            
            if (!data.issues || data.issues.length === 0) {
                findingsContainer.innerHTML = `
                    <div class="text-center py-12">
                        <div class="inline-flex p-4 rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
                            <i data-feather="check-shield" class="w-8 h-8 text-emerald-500"></i>
                        </div>
                        <h3 class="text-lg font-bold">Clean Code</h3>
                        <p class="text-slate-500">No issues found.</p>
                    </div>`;
            } else {
                let htmlBuffer = "";
                data.issues.forEach(issue => {
                    let severityKey = 'safe';
                    if (issue.severity === 'Critical') severityKey = 'critical';
                    else if (issue.severity === 'High') severityKey = 'warning';
                    const itemTheme = THEMES[severityKey];

                    htmlBuffer += `
                    <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                        <div class="flex items-start gap-4">
                            <span class="px-2 py-1 rounded text-xs font-bold border uppercase ${itemTheme.bg} ${itemTheme.text.split(' ')[0]} ${itemTheme.border}">
                                ${issue.severity}
                            </span>
                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <h5 class="font-bold text-slate-800 dark:text-slate-200">${issue.title}</h5>
                                    <span class="text-xs font-mono text-slate-500 ml-2">Line ${issue.line}</span>
                                </div>
                                <p class="text-sm text-slate-600 dark:text-slate-400">${issue.description}</p>
                            </div>
                        </div>
                    </div>`;
                });
                findingsContainer.innerHTML = htmlBuffer;
            }
        }
    }

    // ==========================================
    // 6. GLOBAL INITIALIZATION (Run Once)
    // ==========================================
    // Only run feather replace once at the very end to prevent flickering
    if (window.feather) {
        window.feather.replace();
    }
});
