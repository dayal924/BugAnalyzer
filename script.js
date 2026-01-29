/**
 * =========================================================
 * BugSense – Stabilized Frontend Controller (FINAL)
 * =========================================================
 * - Uses requestAnimationFrame for scroll syncing (No Jitter)
 * - Prevents Layout Thrashing
 * - Vercel-safe Backend Connections
 */

document.addEventListener("DOMContentLoaded", () => {

    /* =======================================================
     * CONFIGURATION
     * ======================================================= */
    const API_URL = "/api/analyze";
    const REPORT_ROUTE = "/analyze"; // Matches Vercel rewrite

    /* =======================================================
     * DOM ELEMENTS
     * ======================================================= */
    const codeInput = document.getElementById("code-input");
    const lineNumbers = document.getElementById("line-numbers");
    const analyzeBtn = document.getElementById("analyze-btn");
    const analyzeSpinner = document.getElementById("analyze-spinner");
    const btnText = document.getElementById("analyze-text") || document.getElementById("btn-text");
    const langSelect = document.getElementById("language-select");
    const uploadBtn = document.getElementById("upload-btn");
    const fileInput = document.getElementById("file-input");
    const riskBanner = document.getElementById("risk-banner");
    const findingsContainer = document.getElementById("issues-list") || document.getElementById("findings-container");

    /* =======================================================
     * THEME MAPPING (Safe for Tailwind JIT)
     * ======================================================= */
    const THEMES = {
        safe: {
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            text: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-200 dark:border-emerald-800',
            progress: 'bg-emerald-500',
            icon: 'check-circle'
        },
        warning: {
            bg: 'bg-orange-100 dark:bg-orange-900/30',
            text: 'text-orange-600 dark:text-orange-400',
            border: 'border-orange-200 dark:border-orange-800',
            progress: 'bg-orange-500',
            icon: 'alert-triangle'
        },
        critical: {
            bg: 'bg-red-100 dark:bg-red-900/30',
            text: 'text-red-600 dark:text-red-400',
            border: 'border-red-200 dark:border-red-800',
            progress: 'bg-red-500',
            icon: 'slash'
        }
    };

    /* =======================================================
     * PAGE 1: EDITOR ENGINE (Anti-Flicker Logic)
     * ======================================================= */
    if (codeInput && lineNumbers) {
        console.log("BugSense: Editor Engine Started");

        // --- A. THE SCROLL LOOP (The Fix) ---
        // Instead of reacting to scroll events directly, we sync on every animation frame.
        // This locks the two panels together perfectly.
        let lastScrollTop = -1;
        
        const syncLoop = () => {
            const scrollTop = codeInput.scrollTop;
            if (lastScrollTop !== scrollTop) {
                lineNumbers.scrollTop = scrollTop;
                lastScrollTop = scrollTop;
            }
            requestAnimationFrame(syncLoop);
        };
        requestAnimationFrame(syncLoop);

        // --- B. LINE NUMBER GENERATION ---
        const updateLineNumbers = () => {
            const lines = codeInput.value.split("\n").length;
            const currentCount = lineNumbers.childElementCount;

            // Only touch DOM if line count changes (Prevents layout thrashing)
            if (lines !== currentCount) {
                // Using Array.join is faster than a loop
                lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
            }
        };

        codeInput.addEventListener("input", updateLineNumbers);
        
        // Initial Render
        updateLineNumbers();

        // --- C. SMART PASTE ---
        codeInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData("text");
            const cleanText = text.replace(/\r\n/g, "\n"); // Normalize line endings
            
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            const original = codeInput.value;
            
            codeInput.value = original.substring(0, start) + cleanText + original.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + cleanText.length;
            
            updateLineNumbers();
        });

        // --- D. FILE UPLOAD ---
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener("click", (e) => {
                e.preventDefault();
                fileInput.click();
            });

            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Auto-detect language
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

        // --- E. ANALYZE ACTION ---
        if (analyzeBtn) {
            analyzeBtn.addEventListener("click", async (e) => {
                e.preventDefault(); // Stop page reload
                
                const code = codeInput.value.trim();
                if (!code) {
                    alert("Please enter code first.");
                    return;
                }

                // Lock UI
                analyzeBtn.disabled = true;
                if(analyzeBtn.classList) analyzeBtn.classList.add("opacity-75", "cursor-wait");
                if(btnText) btnText.textContent = "Analyzing...";
                if(analyzeSpinner) analyzeSpinner.classList.remove("hidden");

                try {
                    const res = await fetch(API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code: codeInput.value,
                            language: langSelect ? langSelect.value : "auto"
                        })
                    });

                    if (!res.ok) throw new Error("Backend Error");

                    const data = await res.json();
                    localStorage.setItem("bugSenseResults", JSON.stringify(data));
                    
                    // Redirect
                    window.location.href = REPORT_ROUTE;

                } catch (err) {
                    console.error(err);
                    alert("Connection failed. Check backend.");
                    
                    // Reset UI
                    analyzeBtn.disabled = false;
                    if(analyzeBtn.classList) analyzeBtn.classList.remove("opacity-75", "cursor-wait");
                    if(btnText) btnText.textContent = "Run Prediction Agent";
                    if(analyzeSpinner) analyzeSpinner.classList.add("hidden");
                }
            });
        }
    }

    /* =======================================================
     * PAGE 2: REPORT RENDERING
     * ======================================================= */
    if (riskBanner) {
        console.log("BugSense: Report Mode Active");

        const rawData = localStorage.getItem("bugSenseResults");
        if (!rawData) {
            window.location.href = "/";
            return;
        }

        const data = JSON.parse(rawData);
        const score = data.risk_score || 0;
        
        // Determine Theme
        let themeKey = 'safe';
        if (score >= 70) themeKey = 'critical';
        else if (score >= 30) themeKey = 'warning';
        const theme = THEMES[themeKey];

        // --- Update Banner ---
        const elLevel = document.getElementById("risk-level");
        const elPercent = document.getElementById("risk-percentage");
        const elIcon = document.getElementById("risk-icon");
        const elProgress = document.getElementById("risk-progress");

        if (elLevel) {
            elLevel.textContent = themeKey === 'safe' ? 'Safe' : (themeKey === 'warning' ? 'Warning' : 'Critical');
            elLevel.className = `text-3xl font-black italic tracking-tight ${theme.text}`;
        }
        
        if (elPercent) {
            elPercent.textContent = `${score}%`;
            elPercent.className = `text-5xl font-black tracking-tighter ${theme.text}`;
        }

        if (elIcon) {
            elIcon.className = `w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${theme.bg}`;
            elIcon.innerHTML = `<i data-feather="${theme.icon}" class="w-8 h-8 ${theme.text.split(' ')[0]}"></i>`;
        }

        if (elProgress) {
            // Reset and apply new color
            elProgress.className = `h-full rounded-full transition-all duration-1000 w-0 ${theme.progress}`;
            setTimeout(() => elProgress.style.width = `${score}%`, 100);
        }

        // --- Update Metrics ---
        document.getElementById("metric-loc").textContent = data.loc || 0;
        document.getElementById("metric-loops").textContent = data.loops || 0;
        document.getElementById("metric-complexity").textContent = data.complexity || 0;

        // --- Render Issues ---
        if (findingsContainer) {
            findingsContainer.innerHTML = "";
            
            if (!data.issues || data.issues.length === 0) {
                findingsContainer.innerHTML = `<div class="p-10 text-center text-slate-400">No vulnerabilities found 🎉</div>`;
            } else {
                let html = "";
                data.issues.forEach(issue => {
                    // Map Issue Severity to Theme
                    let sKey = 'safe';
                    if (issue.severity === 'Critical') sKey = 'critical';
                    else if (issue.severity === 'High') sKey = 'warning';
                    
                    const iTheme = THEMES[sKey];

                    html += `
                    <div class="p-6 border-b border-slate-100 dark:border-slate-800">
                        <div class="flex items-start gap-4">
                            <span class="px-2 py-1 rounded text-xs font-bold border uppercase ${iTheme.bg} ${iTheme.text.split(' ')[0]} ${iTheme.border}">
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
                findingsContainer.innerHTML = html;
            }
        }
    }

    // --- Global: Initialize Icons Once ---
    if (window.feather) window.feather.replace();
});
