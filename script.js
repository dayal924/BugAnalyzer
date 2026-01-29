/**
 * =========================================================
 * BugSense – Frontend Controller Script (FINAL + STABLE++)
 * =========================================================
 * Responsibilities:
 * 1. Code editor behavior (line numbers, paste cleanup)
 * 2. File upload & language detection
 * 3. Backend communication (FastAPI on Vercel)
 * 4. Report rendering & risk visualization
 * 5. UI stability (no flicker / no layout shift)
 * 6. NO silent JS failure (robust fetch handling)
 * 7. Extra UX feedback & debug helpers (ADDED)
 * =========================================================
 */

document.addEventListener("DOMContentLoaded", () => {

  console.log("[BugSense] script.js loaded");

  /* =======================================================
   * CONFIGURATION (DO NOT CHANGE)
   * ======================================================= */
  const API_URL = "/api/analyze";
  const REPORT_ROUTE = "/analyze";

  /* =======================================================
   * SAFE STATIC COLOR MAP (Tailwind Compatible)
   * ======================================================= */
  const COLOR_MAP = {
    emerald: {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      border: "border-emerald-200 dark:border-emerald-800",
      progress: "bg-emerald-500"
    },
    orange: {
      text: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-900/30",
      border: "border-orange-200 dark:border-orange-800",
      progress: "bg-orange-500"
    },
    red: {
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      border: "border-red-200 dark:border-red-800",
      progress: "bg-red-500"
    },
    blue: {
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      border: "border-blue-200 dark:border-blue-800"
    }
  };

  /* =======================================================
   * DOM ELEMENTS – HOME PAGE
   * ======================================================= */
  const codeInput = document.getElementById("code-input");
  const lineNumbers = document.getElementById("line-numbers");
  const analyzeBtn = document.getElementById("analyze-btn");
  const analyzeSpinner = document.getElementById("analyze-spinner");
  const btnText = document.getElementById("btn-text");
  const langSelect = document.getElementById("language-select");
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("file-input");
  const formatBadge = document.getElementById("format-badge");

  /* =======================================================
   * DOM ELEMENTS – REPORT PAGE
   * ======================================================= */
  const findingsContainer = document.getElementById("findings-container");
  const riskBanner = document.getElementById("risk-banner");
  const resultsSection = document.getElementById("results-section");

  /* =======================================================
   * PAGE 1 – CODE EDITOR & ANALYSIS
   * ======================================================= */
  if (codeInput) {

    console.log("[BugSense] Editor Mode Active");

    /* ---------- Line Numbers ---------- */
    const updateLineNumbers = () => {
      const count = codeInput.value.split("\n").length;
      lineNumbers.innerHTML = Array.from(
        { length: count },
        (_, i) => i + 1
      ).join("<br>");
    };

    codeInput.addEventListener("input", updateLineNumbers);
    codeInput.addEventListener("scroll", () => {
      lineNumbers.scrollTop = codeInput.scrollTop;
    });
    updateLineNumbers();

    /* ---------- Smart Paste ---------- */
    codeInput.addEventListener("paste", e => {
      e.preventDefault();
      let text = (e.clipboardData || window.clipboardData).getData("text");
      text = text.replace(/\r\n/g, "\n").replace(/\n\s*\n\s*\n/g, "\n\n");

      const start = codeInput.selectionStart;
      const end = codeInput.selectionEnd;
      codeInput.value =
        codeInput.value.slice(0, start) +
        text +
        codeInput.value.slice(end);

      codeInput.selectionStart = codeInput.selectionEnd = start + text.length;
      updateLineNumbers();

      if (formatBadge) {
        formatBadge.textContent = "Formatted";
        formatBadge.classList.remove("hidden");
        setTimeout(() => formatBadge.classList.add("hidden"), 2000);
      }
    });

    /* ---------- File Upload ---------- */
    uploadBtn?.addEventListener("click", () => {
      console.log("[BugSense] Upload button clicked");
      fileInput.click();
    });

    fileInput?.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;

      console.log("[BugSense] File selected:", file.name);

      const ext = file.name.split(".").pop().toLowerCase();
      const map = { py: "python", js: "javascript", java: "java", c: "cpp", cpp: "cpp" };
      if (langSelect && map[ext]) langSelect.value = map[ext];

      const reader = new FileReader();
      reader.onload = ev => {
        codeInput.value = ev.target.result;
        updateLineNumbers();
        alert("File loaded successfully ✓");
      };
      reader.readAsText(file);
    });

    /* ---------- ANALYZE BUTTON (CRITICAL PART) ---------- */
    let isAnalyzing = false;

    analyzeBtn?.addEventListener("click", async () => {

      if (isAnalyzing) return;

      if (!codeInput.value.trim()) {
        alert("Please enter code first.");
        return;
      }

      isAnalyzing = true;
      analyzeBtn.disabled = true;
      btnText.textContent = "Analyzing…";
      analyzeSpinner?.classList.remove("hidden");

      try {
        console.log("[BugSense] Sending request to backend…");

        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codeInput.value,
            language: (langSelect && langSelect.value) ? langSelect.value : "python"
          })
        });

        console.log("[BugSense] Response status:", res.status);

        const rawText = await res.text();
        console.log("[BugSense] Raw response:", rawText);

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error("Backend returned invalid JSON");
        }

        if (!res.ok) {
          throw new Error(data.detail || "Analysis failed");
        }

        localStorage.setItem("bugSenseResults", JSON.stringify(data));

        if (resultsSection) {
          resultsSection.classList.remove("hidden");
          resultsSection.scrollIntoView({ behavior: "smooth" });
        }

        btnText.textContent = "Analysis Complete ✓";

      } catch (err) {
        console.error("[BugSense] Analyze failed:", err);
        alert("Analyze failed. Check console for details.");
      } finally {
        isAnalyzing = false;
        analyzeBtn.disabled = false;
        analyzeSpinner?.classList.add("hidden");
      }
    });
  }

  /* =======================================================
   * PAGE 2 – REPORT RENDERING
   * ======================================================= */
  if (findingsContainer || riskBanner) {

    console.log("[BugSense] Report Mode Active");

    const raw = localStorage.getItem("bugSenseResults");
    if (!raw) {
      console.warn("[BugSense] No analysis data found.");
      return;
    }

    const data = JSON.parse(raw);
    const score = data.risk_score || 0;

    const theme = score < 30 ? "emerald" : score < 70 ? "orange" : "red";
    const colors = COLOR_MAP[theme];

    document.getElementById("metric-loc")?.textContent = data.loc || 0;
    document.getElementById("metric-loops")?.textContent = data.loops || 0;
    document.getElementById("metric-complexity")?.textContent = data.complexity || 0;

    const progress = document.getElementById("risk-progress");
    if (progress) {
      progress.className = `h-full transition-all duration-700 ${colors.progress}`;
      requestAnimationFrame(() => progress.style.width = score + "%");
    }

    findingsContainer.innerHTML = "";

    if (!data.issues || data.issues.length === 0) {
      findingsContainer.innerHTML = `
        <div class="p-10 text-center text-slate-400">
          No vulnerabilities found 🎉
        </div>`;
    } else {
      data.issues.forEach(issue => {
        const sev =
          issue.severity === "Critical"
            ? COLOR_MAP.red
            : issue.severity === "High"
            ? COLOR_MAP.orange
            : COLOR_MAP.blue;

        findingsContainer.insertAdjacentHTML("beforeend", `
          <div class="p-6 border-b ${sev.border}">
            <div class="flex justify-between mb-2">
              <span class="px-3 py-1 rounded text-xs font-bold ${sev.bg} ${sev.text}">
                ${issue.severity}
              </span>
              <span class="text-xs font-mono text-slate-400">
                Line ${issue.line}
              </span>
            </div>
            <h3 class="font-semibold text-lg">${issue.title}</h3>
            <p class="text-slate-500">${issue.description}</p>
          </div>
        `);
      });
    }

    requestAnimationFrame(() => window.feather?.replace());
  }

});
