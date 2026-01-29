# 🐛 BugAnalyzer – AI‑Powered Bug Prediction System

BugAnalyzer is a **web‑based, AI‑inspired static code analysis tool** built during a hackathon. It analyzes source code and predicts potential bugs **before execution**, helping developers improve code quality early in the development cycle.

---

## 🚀 Features

* 📄 Paste or upload source code
* 🌐 Multi‑language support (C/C++, Python, Java, JavaScript)
* ⚡ Real‑time analysis
* 📊 Bug risk score with confidence percentage
* 🚨 Severity classification (Safe / Warning / Critical)
* 🔍 Line‑wise detected issues
* 🌙 Light & Dark mode UI
* ☁️ Full‑stack deployment on Vercel

---

## 🏗️ System Architecture

```
Frontend (HTML, CSS, JavaScript)
        |
        |  JSON Request (Fetch API)
        ↓
Backend (FastAPI – Python)
        |
        |  Rule‑Based Analysis Engine
        ↓
Risk Score + Bug Report (JSON)
        ↓
Frontend Visualization
```

---

## 🛠️ Technology Stack

### Frontend

* HTML5
* CSS3 + Tailwind CSS
* JavaScript

### Backend

* Python
* FastAPI
* Pydantic

### Deployment & Tools

* Vercel (Frontend + Backend)
* GitHub
* VS Code

---

## 🔄 Working Flow

1. User opens BugAnalyzer web app
2. Pastes or uploads source code
3. Selects or auto‑detects programming language
4. Clicks **Run Prediction Agent**
5. Frontend sends code to backend via REST API
6. Backend analyzes code using rule‑based logic
7. Risk score and detected issues are generated
8. Results are displayed on the frontend

---

## 📁 Project Structure

```
├── frontend/
│   ├── index.html        # Landing page
│   ├── analyze.html      # Results page
│   ├── script.js         # Frontend logic
│   └── style.css         # Styling & animations
│
├── backend/
│   ├── main.py           # FastAPI backend
│   └── requirements.txt  # Backend dependencies
│
├── vercel.json           # Vercel deployment config
├── .venv/                # Python virtual environment
└── README.md
```

---

## ⚙️ Local Setup

### 1️⃣ Clone the Repository

```bash
git clone <your-repo-url>
cd buganalyzer
```

### 2️⃣ Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend will run at:

```
http://127.0.0.1:8000
```

### 3️⃣ Frontend Setup

Open `frontend/index.html` directly in the browser

---

## ☁️ Deployment (Vercel)

* Frontend deployed as static files
* Backend deployed as serverless FastAPI function
* Routing managed via `vercel.json`

---

## 👥 Team Members

* **Lipsita Khadgarai** – Team Lead
* **Dayal Kumar Padhy**
* **Kamolika Patra**
* **Ashish Nayak**

---

## 🌱 Future Enhancements

* Machine learning‑based bug prediction
* GitHub repository analysis
* CI/CD pipeline integration
* Security vulnerability detection
* Support for more programming languages

---

## 📌 Conclusion

BugAnalyzer demonstrates how **intelligent static analysis tools** can help developers shift from **bug fixing** to **bug prevention**, improving software reliability, productivity, and learning.

---

### ⭐ Built for Hackathon 2026
