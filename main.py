import re
import ast
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

# ==========================================
# 1. SETUP & CONFIGURATION
# ==========================================
app = FastAPI(title="BugAnalyzer Professional Engine", version="4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str
    language: str

# ==========================================
# 2. INTELLIGENT LANGUAGE DETECTOR
# ==========================================
def detect_language_signature(code: str) -> str:
    """Fingerprints code to auto-detect language with high accuracy."""
    code = code.strip()
    if re.search(r"(def\s+\w+|import\s+os|import\s+sys|print\()", code): 
        return "python"
    if re.search(r"(#include\s+<|int\s+main\s*\(|std::|printf\()", code): 
        return "cpp"
    if re.search(r"(public\s+class|System\.out\.println|private\s+static)", code): 
        return "java"
    if re.search(r"(function\s+\w+|console\.log\(|const\s+\w+\s*=|let\s+\w+)", code): 
        return "javascript"
    return "python"

# ==========================================
# 3. ENGINE A: PYTHON DEEP SCAN (AST)
# ==========================================
def analyze_python_deep_scan(code: str) -> List[Dict[str, Any]]:
    issues = []
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):

            # Arbitrary Execution
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in ["eval", "exec"]:
                    issues.append({
                        "line": node.lineno,
                        "severity": "Critical",
                        "title": "Arbitrary Code Execution",
                        "description": f"The function '{node.func.id}' executes dynamic code and is dangerous."
                    })

            # Hardcoded Credentials
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        if any(k in target.id.lower() for k in ["password", "secret", "key", "token", "auth"]):
                            if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                                if len(node.value.value) > 8:
                                    issues.append({
                                        "line": node.lineno,
                                        "severity": "Critical",
                                        "title": "Hardcoded Credential",
                                        "description": f"Sensitive variable '{target.id}' appears hardcoded."
                                    })

            # Infinite Loop
            if isinstance(node, ast.While):
                if isinstance(node.test, ast.Constant) and node.test.value is True:
                    if not any(isinstance(c, ast.Break) for c in ast.walk(node)):
                        issues.append({
                            "line": node.lineno,
                            "severity": "High",
                            "title": "Infinite Loop",
                            "description": "A while True loop without break was detected."
                        })

    except SyntaxError as e:
        issues.append({
            "line": e.lineno or 1,
            "severity": "High",
            "title": "Syntax Error",
            "description": f"Python parsing failed: {e.msg}"
        })
    except Exception:
        pass

    return issues

# ==========================================
# 4. ENGINE B: UNIVERSAL SCANNER
# ==========================================
def analyze_universal_patterns(code: str, language: str) -> List[Dict[str, Any]]:
    issues = []
    lines = code.split("\n")

    patterns = {
        "universal": [
            (r"TODO:|FIXME:", "Low", "Tech Debt", "Developer task marker left in code."),
            (r"[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+", "Medium", "IP Address Leak", "Hardcoded IP address detected.")
        ],
        "javascript": [
            (r"\.innerHTML\s*=", "High", "XSS Vulnerability", "innerHTML can lead to XSS attacks."),
            (r"document\.write\(", "Medium", "Deprecated Method", "document.write() is discouraged."),
            (r"debugger;", "Low", "Debugger Found", "Remove debugger statements.")
        ],
        "cpp": [
            (r"if\s*\(.*(?<![=!<>])=(?![=]).*\)", "High", "Logic Error", "Assignment used in condition."),
            (r"(strcpy|strcat|sprintf|gets)\s*\(", "Critical", "Buffer Overflow", "Unsafe C function."),
            (r"system\(", "High", "Command Injection", "system() call detected.")
        ],
        "java": [
            (r"if\s*\(.*(?<![=!<>])=(?![=]).*\)", "High", "Logic Error", "Assignment in condition."),
            (r"Runtime\.getRuntime\(\)\.exec\(", "High", "Command Injection", "Runtime exec detected."),
            (r"printStackTrace\(", "Low", "Improper Logging", "Avoid printing stack traces.")
        ],
        "python": [
            (r"os\.system\(", "High", "OS Command Injection", "Avoid os.system().")
        ]
    }

    active = patterns["universal"] + patterns.get(language, [])
    comment_markers = ("//", "#", "/*", "*", "<!--")

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith(comment_markers):
            continue

        for regex, severity, title, desc in active:
            if re.search(regex, stripped, re.IGNORECASE):
                issues.append({
                    "line": i,
                    "severity": severity,
                    "title": title,
                    "description": desc
                })

    return issues

# ==========================================
# 5. ANALYSIS PIPELINE
# ==========================================
def run_analysis_pipeline(code: str, language_hint: str):
    language = language_hint if language_hint and language_hint != "auto" else detect_language_signature(code)

    issues = []
    if language == "python":
        issues.extend(analyze_python_deep_scan(code))

    issues.extend(analyze_universal_patterns(code, language))

    unique = {f"{i['line']}-{i['title']}": i for i in issues}.values()
    final = sorted(unique, key=lambda x: x["line"])

    loops = len(re.findall(r"\b(for|while|foreach)\b", code))
    complexity = 1 + loops + len(re.findall(r"\b(if|else|case|catch)\b", code))

    weights = {"Critical": 30, "High": 20, "Medium": 10, "Low": 2}
    risk = sum(weights.get(i["severity"], 5) for i in final)
    if complexity > 15:
        risk += 10

    return {
        "language": language,
        "loc": len(code.split("\n")),
        "loops": loops,
        "complexity": complexity,
        "risk_score": min(99, risk),
        "issues": final
    }

# ==========================================
# 6. API ROUTES (VERCEL SAFE)
# ==========================================
@app.post("/api/analyze")
async def api_analyze(request: CodeRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    return run_analysis_pipeline(request.code, request.language)

@app.get("/api/health")
def api_health():
    return {
        "status": "BugAnalyzer Professional Online",
        "version": "4.0"
    }
