#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de conversion des questions du fichier JSON vers le format de la plateforme PREPA_CONCOURS
"""

import json
import base64
import sys
import ftfy
from datetime import datetime

# Configurer l'encodage stdout pour Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Mapping des catégories vers les matières
CATEGORIE_TO_MATIERE = {
    # Maths
    "Maths - Analyse": "mathematiques",
    "Maths - Algèbre": "mathematiques",
    "Maths - Algebre": "mathematiques",
    "Maths - Algèbre Linéaire": "mathematiques",
    "Maths - Algebre Lineaire": "mathematiques",
    "Maths - Géométrie": "mathematiques",
    "Maths - Geometrie": "mathematiques",
    "Maths - Logique": "mathematiques",
    "Maths - Probabilités": "mathematiques",
    "Maths - Probabilites": "mathematiques",
    "Maths - Arithmétique": "mathematiques",
    "Maths - Arithmetique": "mathematiques",
    "Maths - Matrices": "mathematiques",
    "Maths - Intégration": "mathematiques",
    "Maths - Integration": "mathematiques",
    "Maths - Complexes": "mathematiques",
    "Maths - Topologie": "mathematiques",
    "Maths - Analyse Complexe": "mathematiques",
    "Maths - Séries": "mathematiques",
    "Maths - Series": "mathematiques",
    "Maths - Trigonométrie": "mathematiques",
    "Maths - Trigonometrie": "mathematiques",
    "Maths - Équa Diff": "mathematiques",
    "Maths - Equa Diff": "mathematiques",
    "Maths - Équations Diff": "mathematiques",
    "Maths - Equations Diff": "mathematiques",

    # Physique
    "Physique - Nucléaire": "physique",
    "Physique - Nucleaire": "physique",
    "Physique - Électricité": "physique",
    "Physique - Electricite": "physique",
    "Physique - Elec": "physique",
    "Physique - Élec": "physique",
    "Physique - Mécanique": "physique",
    "Physique - Mecanique": "physique",
    "Physique - Meca": "physique",
    "Physique - Méca": "physique",
    "Physique - Ondes": "physique",
    "Physique - Optique": "physique",
    "Physique - Optique Physique": "physique",
    "Physique - Thermo": "physique",
    "Physique - Thermodynamique": "physique",
    "Physique - Fluides": "physique",
    "Physique - Relativité": "physique",
    "Physique - Relativite": "physique",
    "Physique - Quantique": "physique",
    "Physique - Mécanique Quantique": "physique",
    "Physique - Mecanique Quantique": "physique",
    "Physique - Mécanique du point": "physique",
    "Physique - Mecanique du point": "physique",
    "Physique - Mécanique du solide": "physique",
    "Physique - Mecanique du solide": "physique",
    "Physique - Statique des fluides": "physique",
    "Physique - Cristallographie": "physique",
    "Physique - Acoustique": "physique",
    "Physique - Atomique": "physique",
    "Physique - Magnétisme": "physique",
    "Physique - Magnetisme": "physique",
    "Physique - Radioactivité": "physique",
    "Physique - Radioactivite": "physique",
    "Physique - Électromagnétisme": "physique",
    "Physique - Electromagnetisme": "physique",

    # Chimie
    "Chimie - Solutions": "chimie",
    "Chimie - Organique": "chimie",
    "Chimie - Électrochimie": "chimie",
    "Chimie - Electrochimie": "chimie",
    "Chimie - Electro": "chimie",
    "Chimie - Électro": "chimie",
    "Chimie - Cinétique": "chimie",
    "Chimie - Cinetique": "chimie",
    "Chimie - Atomistique": "chimie",
    "Chimie - Liaison": "chimie",
    "Chimie - Liaison Chimique": "chimie",
    "Chimie - Acide/Base": "chimie",
    "Chimie - Équilibre": "chimie",
    "Chimie - Equilibre": "chimie",
    "Chimie - Thermochimie": "chimie",
    "Chimie - Thermo": "chimie",
    "Chimie - Gaz": "chimie",
    "Chimie - Solubilité": "chimie",
    "Chimie - Solubilite": "chimie",
    "Chimie - Analytique": "chimie",
    "Chimie - Minérale": "chimie",
    "Chimie - Minerale": "chimie",
    "Chimie - Coordination": "chimie",
    "Chimie - Cristallographie": "chimie",
    "Chimie - Polymères": "chimie",
    "Chimie - Polymeres": "chimie",
    "Chimie - Redox": "chimie",
    "Chimie - Réactions": "chimie",
    "Chimie - Reactions": "chimie",
    "Chimie - Sécurité": "chimie",
    "Chimie - Securite": "chimie",
    "Chimie - Matériaux": "chimie",
    "Chimie - Materiaux": "chimie",

    # Biologie / SVT
    "Biologie - Cellule": "biologie",
    "Bio - Cellule": "biologie",
    "Bio - Cellulaire": "biologie",
    "SVT - Géologie": "svt",
    "SVT - Evolution": "svt",
    "SVT - Évolution": "svt",
    "Bio - Végétale": "biologie",
    "Bio - Vegetale": "biologie",
    "Bio - Humaine": "biologie",
    "Bio - Écologie": "biologie",
    "Bio - Ecologie": "biologie",
    "Bio - Zoologie": "biologie",
    "Bio - Animal": "biologie",
    "Bio - Botanique": "biologie",
    "Bio - Microbiologie": "biologie",
    "Bio - Neurologie": "biologie",
    "Bio - Endocrino": "biologie",
    "Bio - Endocrinologie": "biologie",
    "Bio - Biochimie": "biologie",
    "Bio - Moléculaire": "biologie",
    "Bio - Moleculaire": "biologie",
    "Bio - Génétique": "biologie",
    "Bio - Genetique": "biologie",
    "Génétique": "biologie",
    "Genetique": "biologie",

    # Pédologie (sciences du sol)
    "Pédologie": "svt",
    "Pedologie": "svt",
    "Étude du sol": "svt",
    "Etude du sol": "svt",
    "Géologie": "svt",
    "Geologie": "svt",

    # Culture générale / Burkina
    "Histoire BF": "burkinafaso",
    "Institutions BF": "burkinafaso",
    "Institutions": "burkinafaso",
    "Géo BF": "burkinafaso",
    "Geo BF": "burkinafaso",
    "AES": "culture_generale",
    "Actualité": "culture_generale",
    "Actualite": "culture_generale",
    "Histoire": "culture_generale",
    "Logic": "culture_generale",
    "Logique": "culture_generale",
    "Psychotech": "culture_generale",
    "Psychotechnique": "culture_generale",
}

# Mapping des catégories vers les sous-catégories
CATEGORIE_TO_CATEGORIE = {
    # Maths
    "Maths - Analyse": "analyse",
    "Maths - Algèbre": "algebre",
    "Maths - Algebre": "algebre",
    "Maths - Algèbre Linéaire": "algebre_lineaire",
    "Maths - Algebre Lineaire": "algebre_lineaire",
    "Maths - Géométrie": "geometrie",
    "Maths - Geometrie": "geometrie",
    "Maths - Logique": "logique",
    "Maths - Probabilités": "probabilites",
    "Maths - Probabilites": "probabilites",
    "Maths - Arithmétique": "arithmetique",
    "Maths - Arithmetique": "arithmetique",
    "Maths - Matrices": "matrices",
    "Maths - Intégration": "integration",
    "Maths - Integration": "integration",
    "Maths - Complexes": "complexes",
    "Maths - Topologie": "topologie",
    "Maths - Analyse Complexe": "analyse_complexe",
    "Maths - Séries": "series",
    "Maths - Series": "series",
    "Maths - Trigonométrie": "trigonometrie",
    "Maths - Trigonometrie": "trigonometrie",
    "Maths - Équa Diff": "equations_differentielles",
    "Maths - Equa Diff": "equations_differentielles",
    "Maths - Équations Diff": "equations_differentielles",
    "Maths - Equations Diff": "equations_differentielles",

    # Physique
    "Physique - Nucléaire": "nucleaire",
    "Physique - Nucleaire": "nucleaire",
    "Physique - Électricité": "electricite",
    "Physique - Electricite": "electricite",
    "Physique - Elec": "electricite",
    "Physique - Élec": "electricite",
    "Physique - Mécanique": "mecanique",
    "Physique - Mecanique": "mecanique",
    "Physique - Meca": "mecanique",
    "Physique - Méca": "mecanique",
    "Physique - Ondes": "ondes",
    "Physique - Optique": "optique",
    "Physique - Optique Physique": "optique",
    "Physique - Thermo": "thermodynamique",
    "Physique - Thermodynamique": "thermodynamique",
    "Physique - Fluides": "fluides",
    "Physique - Relativité": "relativite",
    "Physique - Relativite": "relativite",
    "Physique - Quantique": "quantique",
    "Physique - Mécanique Quantique": "mecanique_quantique",
    "Physique - Mecanique Quantique": "mecanique_quantique",
    "Physique - Mécanique du point": "mecanique_point",
    "Physique - Mecanique du point": "mecanique_point",
    "Physique - Mécanique du solide": "mecanique_solide",
    "Physique - Mecanique du solide": "mecanique_solide",
    "Physique - Statique des fluides": "statique_fluides",
    "Physique - Cristallographie": "cristallographie",
    "Physique - Acoustique": "acoustique",
    "Physique - Atomique": "atomique",
    "Physique - Magnétisme": "magnetisme",
    "Physique - Magnetisme": "magnetisme",
    "Physique - Radioactivité": "radioactivite",
    "Physique - Radioactivite": "radioactivite",
    "Physique - Électromagnétisme": "electromagnetisme",
    "Physique - Electromagnetisme": "electromagnetisme",

    # Chimie
    "Chimie - Solutions": "solutions",
    "Chimie - Organique": "organique",
    "Chimie - Électrochimie": "electrochimie",
    "Chimie - Electrochimie": "electrochimie",
    "Chimie - Electro": "electrochimie",
    "Chimie - Électro": "electrochimie",
    "Chimie - Cinétique": "cinetique",
    "Chimie - Cinetique": "cinetique",
    "Chimie - Atomistique": "atomistique",
    "Chimie - Liaison": "liaison",
    "Chimie - Liaison Chimique": "liaison",
    "Chimie - Acide/Base": "acide_base",
    "Chimie - Équilibre": "equilibre",
    "Chimie - Equilibre": "equilibre",
    "Chimie - Thermochimie": "thermochimie",
    "Chimie - Thermo": "thermochimie",
    "Chimie - Gaz": "gaz",
    "Chimie - Solubilité": "solubilite",
    "Chimie - Solubilite": "solubilite",
    "Chimie - Analytique": "analytique",
    "Chimie - Minérale": "minerale",
    "Chimie - Minerale": "minerale",
    "Chimie - Coordination": "coordination",
    "Chimie - Cristallographie": "cristallographie",
    "Chimie - Polymères": "polymeres",
    "Chimie - Polymeres": "polymeres",
    "Chimie - Redox": "redox",
    "Chimie - Réactions": "reactions",
    "Chimie - Reactions": "reactions",
    "Chimie - Sécurité": "securite",
    "Chimie - Securite": "securite",
    "Chimie - Matériaux": "materiaux",
    "Chimie - Materiaux": "materiaux",

    # Biologie / SVT
    "Biologie - Cellule": "cellule",
    "Bio - Cellule": "cellule",
    "Bio - Cellulaire": "cellulaire",
    "SVT - Géologie": "geologie",
    "SVT - Evolution": "evolution",
    "SVT - Évolution": "evolution",
    "Bio - Végétale": "vegetale",
    "Bio - Vegetale": "vegetale",
    "Bio - Humaine": "humaine",
    "Bio - Écologie": "ecologie",
    "Bio - Ecologie": "ecologie",
    "Bio - Zoologie": "zoologie",
    "Bio - Animal": "animal",
    "Bio - Botanique": "botanique",
    "Bio - Microbiologie": "microbiologie",
    "Bio - Neurologie": "neurologie",
    "Bio - Endocrino": "endocrinologie",
    "Bio - Endocrinologie": "endocrinologie",
    "Bio - Biochimie": "biochimie",
    "Bio - Moléculaire": "moleculaire",
    "Bio - Moleculaire": "moleculaire",
    "Bio - Génétique": "genetique",
    "Bio - Genetique": "genetique",
    "Génétique": "genetique",
    "Genetique": "genetique",

    # Pédologie
    "Pédologie": "pedologie",
    "Pedologie": "pedologie",
    "Étude du sol": "pedologie",
    "Etude du sol": "pedologie",
    "Géologie": "geologie",
    "Geologie": "geologie",

    # Culture générale
    "Histoire BF": "histoire_bf",
    "Institutions BF": "institutions_bf",
    "Institutions": "institutions",
    "Géo BF": "geographie_bf",
    "Geo BF": "geographie_bf",
    "AES": "aes",
    "Actualité": "actualite",
    "Actualite": "actualite",
    "Histoire": "histoire",
    "Logic": "logique",
    "Logique": "logique",
    "Psychotech": "psychotechnique",
    "Psychotechnique": "psychotechnique",
}

def encoder_base64(texte):
    """Encode un texte en Base64 UTF-8"""
    if texte is None:
        return ""
    return base64.b64encode(texte.encode('utf-8')).decode('ascii')

def convertir_lettre_en_index(lettre):
    """Convertit une lettre (A, B, C, D) en index (0, 1, 2, 3)"""
    mapping = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
    return mapping.get(lettre.upper(), 0)

def generer_id(index, categorie):
    """Génère un ID unique pour la question"""
    matiere_abbr = CATEGORIE_TO_MATIERE.get(categorie, "general")
    return f"NEW_{matiere_abbr[:3].upper()}_{index:04d}"

def corriger_encodage(texte):
    """Corrige l'encodage avec ftfy"""
    if texte is None:
        return ""
    return ftfy.fix_text(texte)

def convertir_question(q_data, index):
    """Convertit une question du format source vers le format de la plateforme"""
    # Corriger l'encodage de la catégorie
    categorie = corriger_encodage(q_data.get('category', ''))
    matiere = CATEGORIE_TO_MATIERE.get(categorie, 'culture_generale')
    sous_categorie = CATEGORIE_TO_CATEGORIE.get(categorie, categorie.lower().replace(' ', '_').replace('-', '_'))

    # Corriger l'encodage de tous les champs texte
    question = corriger_encodage(q_data.get('question', ''))
    justification = corriger_encodage(q_data.get('justification', ''))

    # Récupérer les options et corriger leur encodage
    options_dict = q_data.get('options', {})
    options = [
        corriger_encodage(options_dict.get('A', '')),
        corriger_encodage(options_dict.get('B', '')),
        corriger_encodage(options_dict.get('C', '')),
        corriger_encodage(options_dict.get('D', ''))
    ]

    # Récupérer la bonne réponse
    answer = q_data.get('answer', {})
    reponse_lettre = answer.get('letter', 'A')
    reponse_index = convertir_lettre_en_index(reponse_lettre)

    # Encoder la réponse correcte en Base64 (format array JSON)
    reponses_correctes_array = [reponse_index]
    reponses_correctes = encoder_base64(json.dumps(reponses_correctes_array))

    # Encoder l'explication en Base64
    explication = encoder_base64(justification)

    return {
        "id": generer_id(index, categorie),
        "matiere": matiere,
        "categorie": sous_categorie,
        "type": "single",
        "question": question,
        "options": options,
        "reponses_correctes": reponses_correctes,
        "explication": explication,
        "version": 1,
        "date_creation": datetime.now().strftime("%Y-%m-%d"),
        "date_derniere_modification": datetime.now().strftime("%Y-%m-%d")
    }

def main():
    # Lire le fichier source original et corriger avec ftfy
    print("Lecture du fichier source original...")
    with open(r'C:\Users\SAMBO\Downloads\questions_reponses_justifications.json', 'r', encoding='latin-1') as f:
        content = f.read()
    
    # Corriger le contenu avec ftfy
    content_corrige = ftfy.fix_text(content)
    data_source = json.loads(content_corrige)

    questions_source = data_source.get('questions', [])
    print(f"Nombre de questions trouvées : {len(questions_source)}")

    # Convertir chaque question
    questions_converted = []
    categories_trouvees = set()

    for i, q in enumerate(questions_source, start=1):
        categorie = q.get('category', '')
        categories_trouvees.add(categorie)

        if categorie not in CATEGORIE_TO_MATIERE:
            print(f"ATTENTION: Categorie non mappee : {categorie}")

        question_converted = convertir_question(q, i)
        questions_converted.append(question_converted)

    print(f"\nCatégories trouvées : {len(categories_trouvees)}")
    for cat in sorted(categories_trouvees):
        print(f"  - {cat}")

    # Lire les questions existantes et fusionner
    print(f"\nLecture des questions existantes...")
    try:
        with open('questions_prod.json', 'r', encoding='utf-8') as f:
            questions_existantes = json.load(f)
        print(f"Questions existantes : {len(questions_existantes)}")
        # Fusionner : garder les existantes + ajouter les nouvelles
        questions_finales = questions_existantes + questions_converted
    except FileNotFoundError:
        print("Aucun fichier existant, création d'un nouveau fichier")
        questions_finales = questions_converted

    # Écrire le fichier de sortie
    print(f"\nÉcriture du fichier questions_prod.json...")
    with open('questions_prod.json', 'w', encoding='utf-8') as f:
        json.dump(questions_finales, f, ensure_ascii=False, indent=2)

    print(f"Conversion terminee !")
    print(f"   - Questions converties : {len(questions_converted)}")
    print(f"   - Total questions dans questions_prod.json : {len(questions_finales)}")

if __name__ == "__main__":
    main()
