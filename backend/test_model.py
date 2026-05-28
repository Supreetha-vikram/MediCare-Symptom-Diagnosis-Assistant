import joblib
import pandas as pd

model = joblib.load("disease_model.pkl")

df = pd.read_csv("dataset/Training.csv")

columns = df.drop("prognosis", axis=1).columns

input_data = [0] * len(columns)

# Example symptoms
symptoms = ["headache", "fever"]

for symptom in symptoms:
    if symptom in columns:
        index = list(columns).index(symptom)
        input_data[index] = 1

prediction = model.predict([input_data])

print(prediction)