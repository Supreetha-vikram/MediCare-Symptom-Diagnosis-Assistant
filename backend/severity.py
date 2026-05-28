def check_severity(symptoms):

    severe_symptoms = [
        "chest_pain",
        "breathing_difficulty",
        "unconsciousness"
    ]

    for symptom in symptoms:

        if symptom in severe_symptoms:
            return "Severe"

    if len(symptoms) >= 4:
        return "Moderate"

    return "Mild"