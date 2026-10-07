"""
GÉNÉRATEUR DE PRODUCTION (Obfuscation Base64)
Compile tous les fichiers validés en un seul fichier 'questions_prod.json'
sécurisé contre la triche F12.
"""

import os
import json
import base64
import sys
import tempfile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DOSSIER_SOURCE = "donnees_validees"
FICHIER_PROD = "questions_prod.json"

def encoder_base64(texte_ou_liste):
    """Encode une chaîne ou une liste JSON en Base64 UTF-8"""
    if isinstance(texte_ou_liste, (list, dict)):
        texte = json.dumps(texte_ou_liste, ensure_ascii=False)
    else:
        texte = str(texte_ou_liste)
    return base64.b64encode(texte.encode("utf-8")).decode("utf-8")

def compiler_pour_production():
    print("\n==============================================")
    print("   GÉNÉRATION DU FICHIER PRODUCTION (BASE64)  ")
    print("==============================================")

    if not os.path.exists(DOSSIER_SOURCE):
        print(f"❌ Dossier '{DOSSIER_SOURCE}' introuvable.")
        return

    toutes_les_questions = []

    # Parcourir tous les fichiers JSON validés (ex: burkinafaso.json, francais.json, etc.)
    erreurs = []
    ids_vus = set()
    for nom_fichier in sorted(os.listdir(DOSSIER_SOURCE)):
        if nom_fichier.endswith(".json") and nom_fichier != "questions_validees.json":
            chemin = os.path.join(DOSSIER_SOURCE, nom_fichier)
            try:
                with open(chemin, "r", encoding="utf-8") as f:
                    questions = json.load(f)
                    if not isinstance(questions, list):
                        raise ValueError("le fichier doit contenir une liste")
                    print(f"📄 Lecture de {nom_fichier} : {len(questions)} question(s)")

                    for q in questions:
                        if q.get("id") in ids_vus:
                            raise ValueError(f"ID en double : {q.get('id')}")
                        ids_vus.add(q.get("id"))
                        # On clone la question pour ne pas altérer le fichier source
                        q_prod = dict(q)
                        # Obfuscation Base64 des champs sensibles
                        q_prod["reponses_correctes"] = encoder_base64(q["reponses_correctes"])
                        q_prod["explication"] = encoder_base64(q["explication"])
                        toutes_les_questions.append(q_prod)
            except (OSError, json.JSONDecodeError, TypeError, ValueError) as e:
                erreurs.append(f"{nom_fichier}: {e}")

    if erreurs:
        print("❌ Génération interrompue :")
        for erreur in erreurs:
            print(f"   • {erreur}")
        return False

    dossier = os.path.dirname(FICHIER_PROD) or "."
    fd, fichier_temporaire = tempfile.mkstemp(
        prefix=".questions_prod_", suffix=".json", dir=dossier
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(toutes_les_questions, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(fichier_temporaire, FICHIER_PROD)
    except OSError:
        if os.path.exists(fichier_temporaire):
            os.remove(fichier_temporaire)
        raise

    print(f"\n🎉 Succès : {len(toutes_les_questions)} question(s) compilée(s) et obfusquée(s) dans '{FICHIER_PROD}' !")
    return True

if __name__ == "__main__":
    compiler_pour_production()