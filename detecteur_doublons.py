"""
Script de détection de doublons (similarité textuelle > 85 %).
Compare les nouvelles questions arrivantes avec les questions déjà validées.
Aucune bibliothèque externe n'est requise (utilise les modules standards Python).
"""

import json
import os
import re
import sys
import argparse
from difflib import SequenceMatcher

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Seuil de déclenchement défini dans le cahier des charges (85%)
SEUIL_SIMILARITE = 0.85

def normaliser_texte(texte):
    """
    Nettoie le texte pour une comparaison objective :
    minuscules, suppression de la ponctuation et des espaces superflus.
    """
    texte = texte.lower()
    texte = re.sub(r"[^\w\s]", " ", texte)  # Remplace ponctuation par espace
    texte = re.sub(r"\s+", " ", texte).strip()  # Supprime espaces multiples
    return texte

def calculer_similarite(texte1, texte2):
    """Retourne un score entre 0.0 (totalement différent) et 1.0 (identique)"""
    t1_clean = normaliser_texte(texte1)
    t2_clean = normaliser_texte(texte2)
    return SequenceMatcher(None, t1_clean, t2_clean).ratio()

def charger_questions(chemin_fichier):
    """Charge un fichier JSON s'il existe et s'il est valide"""
    if not os.path.exists(chemin_fichier):
        return []
    try:
        with open(chemin_fichier, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️ Erreur lors de la lecture de {chemin_fichier} : {e}")
        return []

def analyser_doublons(fichier_nouvelles, fichier_existantes, fichier_quarantaine="a_verifier.json"):
    """
    Compare chaque nouvelle question aux questions existantes
    et signale les doublons potentiels.
    """
    print("\n==============================================")
    print("   DÉTECTION AUTOMATIQUE DE DOUBLONS (> 85%)")
    print("==============================================")

    nouvelles = charger_questions(fichier_nouvelles)
    existantes = charger_questions(fichier_existantes)

    if not nouvelles:
        print(f"❌ Aucune nouvelle question trouvée dans '{fichier_nouvelles}'.")
        return

    print(f"🔍 Comparaison de {len(nouvelles)} nouvelle(s) question(s) contre {len(existantes)} existante(s)...")

    doublons_detectes = []
    questions_uniques = []

    for nouvelle in nouvelles:
        suspect = False
        texte_nouvelle = nouvelle.get("question", "")

        for existante in existantes:
            texte_existante = existante.get("question", "")
            score = calculer_similarite(texte_nouvelle, texte_existante)

            if score >= SEUIL_SIMILARITE:
                suspect = True
                doublons_detectes.append({
                    "score_similarite": f"{round(score * 100, 2)}%",
                    "nouvelle_question": {
                        "id": nouvelle.get("id"),
                        "question": texte_nouvelle,
                        "options": nouvelle.get("options")
                    },
                    "question_existante": {
                        "id": existante.get("id"),
                        "question": texte_existante,
                        "options": existante.get("options")
                    }
                })
                # On arrête la comparaison dès qu'un doublon flagrant est trouvé
                break

        if not suspect:
            questions_uniques.append(nouvelle)

    # Bilan
    if doublons_detectes:
        print(f"\n⚠️  ALERTE : {len(doublons_detectes)} doublon(s) potentiel(s) détecté(s) !")
        # Sauvegarde dans le fichier de quarantaine pour arbitrage
        with open(fichier_quarantaine, "w", encoding="utf-8") as f:
            json.dump(doublons_detectes, f, ensure_ascii=False, indent=2)
        print(f"👉 Les détails sont exportés dans '{fichier_quarantaine}' pour votre arbitrage.")
    else:
        print("\n✅ Aucun doublon détecté. Toutes les questions semblent uniques !")

    print(f"📊 Bilan : {len(questions_uniques)} question(s) sans doublon / {len(doublons_detectes)} suspecte(s).")
    return questions_uniques, doublons_detectes


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Détecter les doublons entre deux fichiers JSON.")
    parser.add_argument("nouvelles", help="Fichier JSON du nouveau lot")
    parser.add_argument("existantes", help="Fichier JSON de la base validée")
    parser.add_argument("--quarantaine", default="a_verifier.json")
    args = parser.parse_args()
    analyser_doublons(args.nouvelles, args.existantes, args.quarantaine)