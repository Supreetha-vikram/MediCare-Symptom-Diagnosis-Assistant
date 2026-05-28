import spacy
import pandas as pd

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

# Load dataset columns
df = pd.read_csv("dataset/Training.csv")

# Get symptom names
symptom_list = list(
    df.drop("prognosis", axis=1).columns
)

# Convert underscores to spaces
processed_symptoms = {
    symptom.replace("_", " "): symptom
    for symptom in symptom_list
}

def extract_symptoms(text):

    text = text.lower()

    detected = []

    # Process text using spaCy
    doc = nlp(text)

    # Check symptoms
    for processed, original in processed_symptoms.items():

        if processed in text:
            detected.append(original)

    return list(set(detected))