followup_questions = {
    "fever": "How high is your fever?",
    "cough": "Is your cough dry or wet?",
    "chest_pain": "Do you have breathing difficulty?",
    "headache": "How long have you had the headache?",
    "vomiting": "How many times have you vomited today?"
}

def get_followup_questions(symptoms):

    questions = []

    for symptom in symptoms:

        if symptom in followup_questions:
            questions.append(
                followup_questions[symptom]
            )

    return questions