from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
from symptom_extractor import extract_symptoms
from chatbot_logic import get_followup_questions
from severity import check_severity
from fastapi.middleware.cors import CORSMiddleware
import os
import hashlib
from pymongo import MongoClient

# Create FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model
model = joblib.load("disease_model.pkl")

# Load dataset columns
df = pd.read_csv("dataset/Training.csv")

# Get symptom columns
symptom_columns = df.drop("prognosis", axis=1).columns

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    # Set a server selection timeout so it fails quickly if MongoDB isn't running
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = mongo_client["medicare_db"]
    users_col = db["users"]
    history_col = db["history"]
    # Trigger a connection check
    mongo_client.server_info()
    print("Successfully connected to MongoDB.")
except Exception as e:
    print(f"Warning: Could not connect to MongoDB at {MONGO_URI}. Error: {e}")
    print("Ensure MongoDB is running for auth and history logs to work properly.")

# Password hashing helper
def hash_password(password: str) -> str:
    salt = "medicare_salt_123!" # Persistent salt
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

# Request body structures
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class ChatMessage(BaseModel):
    sender: str
    text: str
    data: dict = None

class ChatSession(BaseModel):
    username: str
    id: int
    title: str
    timestamp: str
    messages: list

# Home route
@app.get("/")
def home():
    return {
        "message": "Symptom Diagnosis Chatbot API Running with MongoDB Support"
    }

# Register endpoint
@app.post("/api/auth/register")
def register(user_data: UserRegister):
    username = user_data.username.strip()
    email = user_data.email.strip()
    password = user_data.password
    
    # Check if username or email already exists
    if users_col.find_one({"$or": [{"username": {"$regex": f"^{username}$", "$options": "i"}}, {"email": {"$regex": f"^{email}$", "$options": "i"}}]}):
        raise HTTPException(status_code=400, detail="Username or email already registered.")
    
    new_user = {
        "username": username,
        "email": email,
        "password_hash": hash_password(password)
    }
    users_col.insert_one(new_user)
    return {"message": "Registration successful.", "username": username, "email": email}

# Login endpoint
@app.post("/api/auth/login")
def login(user_data: UserLogin):
    username = user_data.username.strip()
    password = user_data.password
    
    password_hash = hash_password(password)
    found_user = users_col.find_one({
        "$or": [
            {"username": {"$regex": f"^{username}$", "$options": "i"}},
            {"email": {"$regex": f"^{username}$", "$options": "i"}}
        ],
        "password_hash": password_hash
    })
    
    if not found_user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")
        
    return {"username": found_user["username"], "email": found_user["email"]}

# Get user chat history
@app.get("/api/history")
def get_history(username: str):
    logs = list(history_col.find({"username": username}, {"_id": 0}))
    # Sort descending by ID (newest first)
    logs.sort(key=lambda x: x.get("id", 0), reverse=True)
    return logs

# Save or update user chat session
@app.post("/api/history")
def save_history(chat_session: ChatSession):
    session_dict = chat_session.model_dump() if hasattr(chat_session, "model_dump") else chat_session.dict()
    history_col.update_one(
        {"username": session_dict["username"], "id": session_dict["id"]},
        {"$set": session_dict},
        upsert=True
    )
    return {"message": "History saved successfully."}

# Delete single chat session
@app.delete("/api/history/{chat_id}")
def delete_history_item(chat_id: int, username: str):
    history_col.delete_one({"username": username, "id": chat_id})
    return {"message": "Chat session deleted successfully."}

# Clear all chat history
@app.delete("/api/history")
def clear_history(username: str):
    history_col.delete_many({"username": username})
    return {"message": "All chat history cleared successfully."}

# Prediction route
@app.post("/chat")
def chat(user_input: dict):
    # Get user message
    text = user_input["message"]

    # Extract symptoms
    symptoms = extract_symptoms(text)

    # If no symptoms found
    if len(symptoms) == 0:
        return {
            "message": "No symptoms detected. Please describe your symptoms more clearly."
        }

    # Create zero vector
    input_data = [0] * len(symptom_columns)

    # Convert symptoms to vector
    for symptom in symptoms:
        if symptom in symptom_columns:
            index = list(symptom_columns).index(symptom)
            input_data[index] = 1

    # DataFrame
    input_df = pd.DataFrame(
        [input_data],
        columns=symptom_columns
    )

    # Prediction
    prediction = model.predict(input_df)[0]
    probabilities = model.predict_proba(input_df)[0]
    confidence = max(probabilities) * 100

    # Follow-up questions
    followups = get_followup_questions(symptoms)

    # Check severity
    severity = check_severity(symptoms)
   
    return {
        "user_message": text,
        "detected_symptoms": symptoms,
        "predicted_disease": prediction,
        "confidence": round(confidence, 2),
        "followup_questions": followups,
        "severity_level": severity,
        "medical_disclaimer": "This is an AI-generated preliminary assessment and not a medical diagnosis."
    }