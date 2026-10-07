"""
Script d'ajout automatique INTELLIGENT (avec auto-réparation des étourderies de l'IA).
"""

import os
import json
from validateur import valider_question
from detecteur_doublons import calculer_similarite, SEUIL_SIMILARITE

DOSSIER_DESTINATION = "donnees_validees"
FICHIER_ARRIVEE = "nouvelles_questions.json"

def reparer_question_automatiquement(q):
    """Corrige automatiquement les petites étourderies fréquentes générées par l'IA"""
    # 1. Normalisation de la catégorie (espaces, accents)
    if "categorie" in q and isinstance(q["categorie"], str):
        cat = q["categorie"].lower().strip()
        if "culture" in cat:
            q["categorie"] = "culture_generale"
        elif "spe" in cat:
            q["categorie"] = "specialite"

    # 2. Correction automatique du type en fonction des réponses
    reponses = q.get("reponses_correctes", [])
    if isinstance(reponses, list):
        if len(reponses) > 1 and q.get("type") == "single":
            q["type"] = "multiple"
        elif len(reponses) == 1 and q.get("type") == "multiple":
            q["type"] = "single"

    return q

def ajouter_lot():
    os.makedirs(DOSSIER_DESTINATION, exist_ok=True)

    if not os.path.exists(FICHIER_ARRIVEE):
        print(f"❌ Le fichier '{FICHIER_ARRIVEE}' n'existe pas.")
        return

    try:
        with open(FICHIER_ARRIVEE, "r", encoding="utf-8") as f:
            nouveau_lot = json.load(f)
    except Exception as e:
        print(f"❌ Erreur de lecture du JSON : {e}")
        return

    if not isinstance(nouveau_lot, list) or len(nouveau_lot) == 0:
        print("❌ Le fichier doit contenir une liste de questions non vide.")
        return

    print(f"\n📦 Analyse et auto-nettoyage de {len(nouveau_lot)} nouvelle(s) question(s)...")

    # Étape 1 : Nettoyage et validation globale
    questions_valides = []
    toutes_les_erreurs = []

    for idx, q in enumerate(nouveau_lot):
        # Auto-réparation
        q = reparer_question_automatiquement(q)
        
        # Validation
        erreurs = valider_question(q, idx)
        if erreurs:
            toutes_les_erreurs.extend(erreurs)
        else:
            questions_valides.append(q)

    # Si des erreurs graves subsistent (ex: manque d'options, champ absent)
    if toutes_les_erreurs:
        print(f"\n⛔ {len(toutes_les_erreurs)} erreur(s) non réparable(s) détectée(s) :")
        for err in toutes_les_erreurs:
            print(f"   • {err}")
        print("\nCorrigez ces points dans le fichier avant d'importer.")
        return

    # Étape 2 : Regroupement par matière et intégration
    questions_par_matiere = {}
    for q in questions_valides:
        mat = q.get("matiere", "divers").strip().lower()
        questions_par_matiere.setdefault(mat, []).append(q)

    for matiere, questions in questions_par_matiere.items():
        fichier_matiere = os.path.join(DOSSIER_DESTINATION, f"{matiere}.json")

        base_existante = []
        if os.path.exists(fichier_matiere):
            try:
                with open(fichier_matiere, "r", encoding="utf-8") as f:
                    base_existante = json.load(f)
            except Exception:
                base_existante = []

        ids_existants = {item["id"] for item in base_existante}

        questions_a_ajouter = []
        doublons_ignores = 0

        for q in questions:
            # Sécurité 1 : ID déjà existant
            if q["id"] in ids_existants:
                continue

            # Sécurité 2 : Doublon textuel
            est_doublon = False
            for existante in base_existante:
                if calculer_similarite(q["question"], existante["question"]) >= SEUIL_SIMILARITE:
                    est_doublon = True
                    doublons_ignores += 1
                    break

            if not est_doublon:
                questions_a_ajouter.append(q)
                ids_existants.add(q["id"])

        if questions_a_ajouter:
            base_existante.extend(questions_a_ajouter)
            with open(fichier_matiere, "w", encoding="utf-8") as f:
                json.dump(base_existante, f, ensure_ascii=False, indent=2)

            print(f"✅ {len(questions_a_ajouter)} question(s) collée(s) avec succès dans : {fichier_matiere}")
            print(f"   📊 Total actuel pour '{matiere}' : {len(base_existante)} questions.")
            if doublons_ignores > 0:
                print(f"   ℹ️ {doublons_ignores} doublon(s) similaire(s) écarté(s).")
        else:
            print(f"ℹ️ Aucune nouvelle question à ajouter pour '{matiere}' (déjà présentes ou doublons).")

if __name__ == "__main__":
    ajouter_lot()