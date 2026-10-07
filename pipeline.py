"""
PIPELINE DE TRAITEMENT (Usine à données)
Orchestre la validation du schéma et la détection de doublons en un seul clic.
"""

import os
import sys
import json
from validateur import valider_fichier_json
from detecteur_doublons import analyser_doublons

DOSSIER_BRUT = "donnees_brutes"
DOSSIER_VALIDE = "donnees_validees"
FICHIER_BASE = os.path.join(DOSSIER_VALIDE, "questions_validees.json")

def construire_base_officielle():
    """Construit une copie de référence à partir des fichiers validés par matière."""
    toutes_les_questions = []
    for nom_fichier in sorted(os.listdir(DOSSIER_VALIDE)):
        if not nom_fichier.endswith(".json") or nom_fichier == os.path.basename(FICHIER_BASE):
            continue
        chemin = os.path.join(DOSSIER_VALIDE, nom_fichier)
        with open(chemin, "r", encoding="utf-8") as f:
            questions = json.load(f)
        if not isinstance(questions, list):
            raise ValueError(f"{chemin} doit contenir une liste de questions")
        toutes_les_questions.extend(questions)

    with open(FICHIER_BASE, "w", encoding="utf-8") as f:
        json.dump(toutes_les_questions, f, ensure_ascii=False, indent=2)

def executer_pipeline(nom_fichier_brut):
    chemin_lot = os.path.join(DOSSIER_BRUT, nom_fichier_brut)

    print("\n" + "="*60)
    print(f"🚀 DÉMARRAGE DU PIPELINE SUR : {nom_fichier_brut}")
    print("="*60)

    # 1. ÉTAPE DE VALIDATION DU SCHÉMA JSON
    print("\n[ÉTAPE 1/2] Validation du format et de l'intégrité...")
    est_valide = valider_fichier_json(chemin_lot)

    if not est_valide:
        print("\n⛔ ARRÊT : Corrigez d'abord les erreurs de format ci-dessus.")
        return

    # 2. ÉTAPE DE DÉTECTION DE DOUBLONS
    print("\n[ÉTAPE 2/2] Détection des doublons avec la base officielle...")
    construire_base_officielle()

    uniques, suspects = analyser_doublons(chemin_lot, FICHIER_BASE)

    # 3. VERDICT
    print("\n" + "="*60)
    print("📋 RAPPORT FINAL :")
    if suspects:
        print(f"⚠️  Attention : {len(suspects)} question(s) suspecte(s) trouvée(s).")
        print("👉 Ouvrez 'a_verifier.json' pour vérifier avant validation définitive.")
    else:
        print("🎉 PARFAIT : Toutes les questions sont conformes et sans doublon !")
        print("Prêt pour l'étape de validation humaine.")
    print("="*60 + "\n")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage : python pipeline.py <nom_du_fichier_dans_donnees_brutes>")
        raise SystemExit(2)
    executer_pipeline(sys.argv[1])