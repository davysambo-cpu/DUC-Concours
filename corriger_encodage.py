#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour corriger l'encodage des caractères dans questions_prod.json
"""

import json
import sys

# Configurer l'encodage stdout pour Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def corriger_caracteres(texte):
    """Corrige les caractères mal encodés (mojibake)"""
    if texte is None:
        return ""
    
    # Tableau de remplacement des caractères mal encodés
    corrections = {
        'Ã©': 'é',
        'Ã¨': 'è',
        'Ãª': 'ê',
        'Ã«': 'ë',
        'Ã ': 'à',
        'Ã¢': 'â',
        'Ã¤': 'ä',
        'Ã®': 'î',
        'Ã¯': 'ï',
        'Ã´': 'ô',
        'Ã¶': 'ö',
        'Ã¹': 'ù',
        'Ã¼': 'ü',
        'Ã»': 'û',
        'Ã§': 'ç',
        'Å': 'œ',
        'â€™': "'",
        'â€˜': "'",
        'â€': '"',
        'â€œ': '"',
        'â€“': '–',
        'â€”': '—',
        'Â': '',
    }
    
    texte_corrige = texte
    for mal, bien in corrections.items():
        texte_corrige = texte_corrige.replace(mal, bien)
    
    return texte_corrige

def corriger_question(question):
    """Corrige tous les champs texte d'une question"""
    if 'question' in question:
        question['question'] = corriger_caracteres(question['question'])
    
    if 'options' in question:
        question['options'] = [corriger_caracteres(opt) for opt in question['options']]
    
    if 'explication' in question:
        # L'explication est en Base64, on la décode, corrige, et réencode
        try:
            import base64
            decoded = base64.b64decode(question['explication']).decode('utf-8')
            decoded_corrige = corriger_caracteres(decoded)
            question['explication'] = base64.b64encode(decoded_corrige.encode('utf-8')).decode('ascii')
        except:
            pass
    
    return question

def main():
    print("Lecture du fichier questions_prod.json...")
    with open('questions_prod.json', 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    print(f"Nombre de questions : {len(questions)}")
    
    corrections_count = 0
    for i, question in enumerate(questions):
        original = json.dumps(question, ensure_ascii=False)
        question_corrige = corriger_question(question)
        if json.dumps(question_corrige, ensure_ascii=False) != original:
            corrections_count += 1
    
    print(f"Questions corrigées : {corrections_count}")
    
    print("Écriture du fichier corrigé...")
    with open('questions_prod.json', 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    
    print("✅ Correction terminée !")

if __name__ == "__main__":
    main()
