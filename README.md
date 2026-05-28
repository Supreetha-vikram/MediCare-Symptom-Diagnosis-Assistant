# MediCare AI - Symptom Diagnosis Chatbot Assistant

MediCare AI is a state-of-the-art, responsive, NLP-powered web application that helps users perform preliminary symptom assessments. It combines advanced Natural Language Processing (NLP) with Machine Learning classification to predict diseases, assess severity, suggest follow-up questions, and maintain a secure patient portal with persistent log history in a MongoDB database.

---

## 🌟 Key Features

### 1. Modern & Professional UI (Light/Dark Modes)
- **Responsive Layout**: Adapts flawlessly to desktop and mobile screen viewports.
- **Micro-Animations & Transitions**: Beautiful transitions on buttons, bubbles, and theme switches, designed using Google Fonts (*Outfit*) for a premium clinical aesthetic.
- **Theme Toggling**: Seamless theme switching between standard Bright Theme (clinical teals/indigos) and Dark Theme (deep space slates and glows).

### 2. Intelligent Diagnostic Engine
- **Natural Language Parsing (NLP)**: Analyzes unstructured, conversational user input (e.g., *"I have a mild fever, dry cough, and my chest hurts"*) to extract distinct symptom tags using **spaCy**.
- **ML Disease Predictor**: Transforms extracted symptoms into a binary classification vector and inputs them to a pre-trained **Random Forest classifier**, returning the predicted diagnosis with a confidence percentage.
- **Clinical Severity Assessment**: Evaluates symptoms to classify the overall condition as **Mild**, **Moderate**, or **Severe**, displaying active alerts and warning legends accordingly.

### 3. Patient Auth Portal & Secure History Storage
- **Central Registration & Login**: Central patient portal where users can create accounts and log in. Passwords are securely hashed using `SHA-256` with a custom salt in MongoDB.
- **Persistent Chat Logs (MongoDB)**: Chat sessions are automatically generated and synced with MongoDB. Click **"New Chat"** to archive old diagnostic logs in the sidebar history and start a fresh session.
- **Chat Log Management**: Fully integrated options to load previous chat sessions, delete individual logs, or clear all history from the database at once.

---

## 🛠️ Technology Stack

| Layer | Technology Used |
| :--- | :--- |
| **Frontend** | React JS, Axios, CSS Variables, SVG Graphics |
| **Backend** | FastAPI (Python), Uvicorn server, Pydantic v2 |
| **NLP & ML** | spaCy, Scikit-Learn, Joblib, Pandas |
| **Database** | MongoDB, PyMongo (official MongoDB driver) |

---

## ⚙️ Project Structure

```
symptom-chatbot/
├── backend/
│   ├── app.py                  # Main FastAPI endpoints, auth & history DB controllers
│   ├── chatbot_logic.py        # Logic for follow-up questions
│   ├── severity.py             # Rule-based severity assessor
│   ├── symptom_extractor.py    # spaCy NLP symptom parser
│   ├── disease_model.pkl       # Pre-trained Random Forest ML model
│   └── requirements.txt        # Backend dependencies (including PyMongo & dnspython)
├── frontend/
│   ├── src/
│   │   ├── App.js              # Main React file with Auth, Theme, & Chat History states
│   │   ├── App.css             # Layout styles for login, theme switcher & grids
│   │   ├── index.css           # Global custom property variables (Light/Dark design systems)
│   │   └── index.js            # React root mount
│   └── package.json            # React scripts and libraries
└── README.md                   # System documentation
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Python 3.8+**
- **Node.js (v16+)**
- **MongoDB** running locally on port `27017` (or remote MongoDB connection string).

### 1. Database Setup
Ensure that the MongoDB service is active on your machine.
- Default local connection: `mongodb://localhost:27017`
- Set `MONGO_URI` as an environment variable if you are using a remote cluster (e.g. MongoDB Atlas):
  ```bash
  export MONGO_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/medicare_db"
  ```

### 2. Backend Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a Python virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - **Windows (CMD/PowerShell)**:
     ```bash
     venv\Scripts\activate
     ```
   - **Mac/Linux**:
     ```bash
     source venv/bin/activate
     ```
4. Install python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app:app --reload
   ```
   *The backend will be live at: http://127.0.0.1:8000*

### 3. Frontend Installation
1. Open a new terminal tab and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm package dependencies:
   ```bash
   npm install
   ```
3. Run the React development server:
   ```bash
   npm start
   ```
   *The web client will load automatically at: http://localhost:3000*

---

## 🔌 API Documentation

| Endpoint | Method | Input Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/chat` | `POST` | `{"message": "symptom prompt text"}` | Evaluates text, predicts disease, outputs severity & questions |
| `/api/auth/register` | `POST` | `{"username": "...", "email": "...", "password": "..."}` | Registers a new patient with custom SHA-256 hashed password |
| `/api/auth/login` | `POST` | `{"username": "...", "password": "..."}` | Validates user password against database records |
| `/api/history` | `GET` | `?username=...` | Fetches all chat sessions for the patient (newest first) |
| `/api/history` | `POST` | `ChatSession object` | Inserts or updates (upserts) chat logs inside MongoDB |
| `/api/history/{chat_id}`| `DELETE`| `?username=...` | Deletes a single chat session from patient history |
| `/api/history` | `DELETE`| `?username=...` | Clears all past chat sessions for the patient |

---

## ⚕️ Medical Disclaimer

> [!CAUTION]
> **MediCare AI is a machine-learning-based preliminary symptom evaluator and is NOT a medical diagnosis.** All predictions, clinical severity levels, and wellness tips are for informational and educational tracking purposes only.
>
> If you are experiencing serious or sudden symptoms (e.g. shortness of breath, chest pain, or severe head pressure), please contact **911** or your local emergency number immediately. Always consult a qualified physician or healthcare provider for official medical counsel.
