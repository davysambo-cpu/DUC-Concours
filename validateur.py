"""
Script de validation des questions du pipeline de données.
Ce script vérifie la conformité stricte avec le schéma JSON de la Partie 1 :
- Présence de tous les champs obligatoires
- Format des types (string, liste, int)
- Exactitude des index de réponses correctes
- Exactitude des dates au format AAAA-MM-JJ
"""

import json
import os
import re
import sys
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Champs strictement requis selon le cahier des charges
CHAMPS_REQUIS = {
    "id": str,
    "matiere": str,
    "categorie": str,
    "type": str,
    "question": str,
    "options": list,
    "reponses_correctes": list,
    "explication": str,
    "version": int,
    "date_creation": str,
    "date_derniere_modification": str
}

CATEGORIES_AUTORISEES = ["specialite", "culture_generale"]
TYPES_AUTORISES = ["single", "multiple"]

def valider_format_date(date_str):
    """Vérifie si une date respecte le format AAAA-MM-JJ"""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False

def valider_question(q, index):
    """Vérifie une question individuelle et retourne la liste des erreurs trouvées"""
    erreurs = []
    if not isinstance(q, dict):
        return [f"[Question #{index + 1}] La question doit être un objet JSON"]

    prefixe = f"[Question #{index + 1} - ID: {q.get('id', 'INCONNU')}]"

    # 1. Vérification de la présence et du type des champs obligatoires
    for champ, type_attendu in CHAMPS_REQUIS.items():
        if champ not in q:
            erreurs.append(f"{prefixe} Champ manquant : '{champ}'")
        elif type_attendu is int and isinstance(q[champ], bool):
            erreurs.append(f"{prefixe} Le champ '{champ}' doit être un entier et non un booléen")
        elif not isinstance(q[champ], type_attendu):
            erreurs.append(f"{prefixe} Le champ '{champ}' doit être de type {type_attendu.__name__}")

    if erreurs:
        return erreurs

    # 2. Validation des valeurs admises
    if q["categorie"] not in CATEGORIES_AUTORISEES:
        erreurs.append(f"{prefixe} Catégorie invalide '{q['categorie']}'. Autorisées : {CATEGORIES_AUTORISEES}")

    if q["type"] not in TYPES_AUTORISES:
        erreurs.append(f"{prefixe} Type invalide '{q['type']}'. Autorisés : {TYPES_AUTORISES}")

    # 3. Contrôle des options
    if len(q["options"]) != 4:
        erreurs.append(f"{prefixe} Doit comporter exactement 4 options (trouvé : {len(q['options'])})")
    if any(not isinstance(option, str) or not option.strip() for option in q["options"]):
        erreurs.append(f"{prefixe} Toutes les options doivent être des textes non vides")
    if all(isinstance(option, str) for option in q["options"]) and len(set(q["options"])) != len(q["options"]):
        erreurs.append(f"{prefixe} Les options doivent être distinctes")

    if not q["question"].strip():
        erreurs.append(f"{prefixe} Le champ 'question' ne peut pas être vide")
    if not q["explication"].strip():
        erreurs.append(f"{prefixe} Le champ 'explication' ne peut pas être vide")

    # 4. Contrôle des réponses correctes
    if not q["reponses_correctes"]:
        erreurs.append(f"{prefixe} La liste 'reponses_correctes' ne peut pas être vide")
    else:
        for idx_rep in q["reponses_correctes"]:
            if isinstance(idx_rep, bool) or not isinstance(idx_rep, int):
                erreurs.append(f"{prefixe} L'index de réponse '{idx_rep}' doit être un entier")
            elif idx_rep < 0 or idx_rep >= len(q["options"]):
                erreurs.append(f"{prefixe} L'index de réponse '{idx_rep}' pointe hors des options disponibles")
        if all(isinstance(idx_rep, int) and not isinstance(idx_rep, bool) for idx_rep in q["reponses_correctes"]) and len(set(q["reponses_correctes"])) != len(q["reponses_correctes"]):
            erreurs.append(f"{prefixe} Les index de réponses correctes doivent être uniques")

    # Cohérence du type 'single'
    if q["type"] == "single" and len(q["reponses_correctes"]) > 1:
        erreurs.append(f"{prefixe} Une question de type 'single' ne peut avoir qu'une seule réponse correcte")

    # 5. Contrôle des dates
    if not valider_format_date(q["date_creation"]):
        erreurs.append(f"{prefixe} 'date_creation' ({q['date_creation']}) doit être au format AAAA-MM-JJ")
    if not valider_format_date(q["date_derniere_modification"]):
        erreurs.append(f"{prefixe} 'date_derniere_modification' ({q['date_derniere_modification']}) doit être au format AAAA-MM-JJ")

    return erreurs

def valider_fichier_json(chemin_fichier):
    """Charge un fichier JSON et valide l'ensemble de ses questions"""
    print(f"\n--- Analyse du fichier : {chemin_fichier} ---")

    if not os.path.exists(chemin_fichier):
        print(f"❌ Erreur : Le fichier {chemin_fichier} n'existe pas.")
        return False

    try:
        with open(chemin_fichier, "r", encoding="utf-8") as f:
            donnees = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Erreur de syntaxe JSON : {e}")
        return False

    if not isinstance(donnees, list):
        print("❌ Erreur : Le fichier doit contenir une liste de questions `[...]`")
        return False

    toutes_les_erreurs = []
    ids_vus = set()

    for idx, question in enumerate(donnees):
        if not isinstance(question, dict):
            toutes_les_erreurs.extend(valider_question(question, idx))
            continue
        qid = question.get("id")
        if qid:
            if qid in ids_vus:
                toutes_les_erreurs.append(f"[Index {idx + 1}] ID en double détecté : '{qid}'")
            ids_vus.add(qid)

        erreurs_q = valider_question(question, idx)
        toutes_les_erreurs.extend(erreurs_q)

    if toutes_les_erreurs:
        print(f"❌ {len(toutes_les_erreurs)} anomalie(s) détectée(s) :")
        for err in toutes_les_erreurs:
            print(f"   • {err}")
        return False
    else:
        print(f"✅ Succès : {len(donnees)} question(s) validée(s) sans aucune erreur !")
        return True

if __name__ == "__main__":
    # Test automatique sur un fichier exemple
    fichier_test = "test_questions.json"

    # Exemple de données conforme à la spécification
    exemple = [
        {
            "id": "FR_2027_001",
            "matiere": "francais",
            "categorie": "specialite",
            "type": "single",
            "question": "Parmi les propositions suivantes, laquelle contient un pléonasme ?",
            "options": [
                "Monter en haut de la colline",
                "Marcher d'un pas décidé",
                "Courir à perdre haleine",
                "Parler à voix basse"
            ],
            "reponses_correctes": [0],
            "explication": "« Monter en haut » est un pléonasme car le verbe monter implique déjà un déplacement vers le haut.",
            "version": 1,
            "date_creation": "2026-09-01",
            "date_derniere_modification": "2026-09-01"
        }
    ]

    # Création d'un fichier test s'il n'existe pas encore
    if not os.path.exists(fichier_test):
        with open(fichier_test, "w", encoding="utf-8") as f:
            json.dump(exemple, f, ensure_ascii=False, indent=2)
        print(f"Fichier d'exemple généré : {fichier_test}")

    # Lancement de la vérification
    valider_fichier_json(fichier_test)