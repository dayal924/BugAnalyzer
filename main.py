import uvicorn
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
    if re.search(r"(def\s+\w+|import\s+os|import\s+sys|print\()", code): return "python"
    if re.search(r"(#include\s+<|int\s+main\s*\(|std::|printf\()", code): return "cpp"
    if re.search(r"(public\s+class|System\.out\.println|private\s+static)", code): return "java"
    if re.search(r"(function\s+\w+|console\.log\(|const\s+\w+\s*=|let\s+\w+)", code): return "javascript"
    return "python"

# ==========================================
# 3. ENGINE A: PYTHON DEEP SCAN (AST)
# ==========================================
def analyze_python_deep_scan(code: str) -> List[Dict[str, Any]]:
    """Parses Python Abstract Syntax Tree to find logic and security flaws."""
    issues = []
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            
            # [Security] Arbitrary Execution
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in ['eval', 'exec']:
                    issues.append({
                        "line": node.lineno,
                        "severity": "Critical",
                        "title": "Arbitrary Code Execution",
                        "description": f"The function '{node.func.id}' executes code dynamically. Attackers can inject malicious commands via user input."
                    })

            # [Security] Hardcoded Credentials
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        # Detects variable names like password, secret, api_key
                        if any(s in target.id.lower() for s in ['password', 'secret', 'key', 'token', 'auth']):
                            if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                                # Logic: If string is long (>8 chars) and doesn't look like an env var fetch
                                if len(node.value.value) > 8 and "env" not in node.value.value.lower():
                                    issues.append({
                                        "line": node.lineno,
                                        "severity": "Critical",
                                        "title": "Hardcoded Credential",
                                        "description": f"Sensitive variable '{target.id}' appears to be hardcoded. Use environment variables (e.g., os.getenv) instead."
                                    })

            # [Logic] Infinite Loop Detection
            if isinstance(node, ast.While):
                # Checks for 'while True'
                if isinstance(node.test, ast.Constant) and node.test.value is True:
                    # Scans children for a 'break' statement
                    if not any(isinstance(child, ast.Break) for child in ast.walk(node)):
                        issues.append({
                            "line": node.lineno,
                            "severity": "High",
                            "title": "Infinite Loop",
                            "description": "A 'while True' loop was detected with no reachable 'break' condition. This will freeze the application."
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
# 4. ENGINE B: UNIVERSAL & LOGIC SCANNER
# ==========================================
def analyze_universal_patterns(code: str, language: str) -> List[Dict[str, Any]]:
    """Uses advanced Regex to find bugs in C++, Java, and JS."""
    issues = []
    lines = code.split('\n')
    
    patterns = {
        "universal": [
            (r"TODO:|FIXME:", "Low", "Tech Debt", "A developer task marker was left in production code."),
            (r"[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}", "Medium", "IP Address Leak", "A raw IP address was found. Use DNS names or configuration files.")
        ],
        "javascript": [
            (r"\.innerHTML\s*=", "High", "XSS Vulnerability", "Directly writing to innerHTML allows Cross-Site Scripting (XSS) attacks. Use textContent instead."),
            (r"document\.write\(", "Medium", "Deprecated Method", "document.write() blocks page rendering and is discouraged in modern web apps."),
            (r"debugger;", "Low", "Production Debugger", "Remove debugger statements before deployment.")
        ],
        "cpp": [
            # The "Logic Trap" Detector (Assignment in Condition)
            (r"if\s*\(.*(?<![=!<>])=(?![=]).*\)", "High", "Logic Error (Assignment)", "An assignment operator '=' was used inside an 'if' condition. Did you mean '==' (comparison)?"),
            
            (r"(strcpy|strcat|sprintf|gets)\s*\(", "Critical", "Buffer Overflow", "This function does not check buffer boundaries, leading to crashes or remote code execution exploits."),
            (r"system\(", "High", "Command Injection", "Executing system commands directly is dangerous. Sanitize inputs or use safer APIs.")
        ],
        "java": [
            # The "Logic Trap" Detector for Java
            (r"if\s*\(.*(?<![=!<>])=(?![=]).*\)", "High", "Logic Error (Assignment)", "Assignment operator '=' used in condition. Likely meant '=='."),
            
            (r"Runtime\.getRuntime\(\)\.exec\(", "High", "Command Injection", "External process execution detected. Validate all inputs strictly."),
            (r"e\.printStackTrace\(", "Low", "Improper Logging", "Stack traces should be logged to a secure file, not printed to stdout where users can see them.")
        ],
        "python": [
            (r"os\.system\(", "High", "OS Command Injection", "Use the subprocess module with shell=False for safer execution.")
        ]
    }

    active_patterns = patterns.get("universal", []) + patterns.get(language, [])
    
    # Safe list of comment markers to avoid false positives
    # We break the string to avoid the parser error that happened before
    comment_markers = ("//", "#", "/*", "*", "<" + "!--")

    for i, line in enumerate(lines):
        line_num = i + 1
        stripped = line.strip()
        
        if stripped.startswith(comment_markers):
            continue

        for regex, severity, title, desc in active_patterns:
            try:
                if re.search(regex, stripped, re.IGNORECASE):
                    issues.append({
                        "line": line_num,
                        "severity": severity,
                        "title": title,
                        "description": desc
                    })
            except:
                continue
                
    return issues

# ==========================================
# 5. MAIN CONTROLLER
# ==========================================
def run_analysis_pipeline(code: str, language_hint: str):
    # 1. Detect Language
    language = language_hint
    if not language or language == "auto":
        language = detect_language_signature(code)
    
    print(f"DEBUG: Analyzing as {language}")
    
    issues = []
    
    # 2. Run Engines
    if language == "python":
        issues.extend(analyze_python_deep_scan(code))
    
    issues.extend(analyze_universal_patterns(code, language))
    
    # 3. Deduplicate
    unique_issues = {f"{i['line']}-{i['title']}": i for i in issues}.values()
    final_issues = sorted(list(unique_issues), key=lambda x: x['line'])

    # 4. Metrics & Scoring
    loops = len(re.findall(r"\b(for|while|foreach)\b", code))
    # Complexity = 1 + Loops + Branches
    complexity = 1 + loops + len(re.findall(r"\b(if|else|case|catch)\b", code))
    
    risk_score = 0
    weights = {"Critical": 30, "High": 20, "Medium": 10, "Low": 2}
    for i in final_issues:
        risk_score += weights.get(i['severity'], 5)
    
    if complexity > 15: risk_score += 10
    
    return {
        "language": language,
        "loc": len(code.split('\n')),
        "loops": loops,
        "complexity": complexity,
        "risk_score": min(99, risk_score),
        "issues": final_issues
    }

# ==========================================
# 6. API ROUTES
# ==========================================
@app.post("/analyze")
async def api_analyze(request: CodeRequest):
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
    return run_analysis_pipeline(request.code, request.language)

@app.get("/")
def api_health():
    return {"status": "BugAnalyzer Professional Online", "version": "4.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)