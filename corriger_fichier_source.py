#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour corriger l'encodage du fichier source JSON
"""

import json
import sys
import ftfy

# Configurer l'encodage stdout pour Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def corriger_mojibake(texte):
    """Corrige les caractères mojibake en utilisant ftfy"""
    if texte is None:
        return ""
    return ftfy.fix_text(texte)

def corriger_objet(obj):
    """Corrige récursivement tous les strings dans un objet JSON"""
    if isinstance(obj, str):
        return corriger_mojibake(obj)
    elif isinstance(obj, dict):
        return {key: corriger_objet(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [corriger_objet(item) for item in obj]
    else:
        return obj

def main():
    # Essayer différentes méthodes de lecture
    print("Tentative de lecture du fichier source...")
    
    try:
        # Méthode: Lire comme latin-1 pour décodage initial, puis UTF-8
        with open(r'C:\Users\SAMBO\Downloads\questions_reponses_justifications.json', 'r', encoding='latin-1') as f:
            content = f.read()
        
        # Corriger avec ftfy
        content_corrige = corriger_mojibake(content)
        data = json.loads(content_corrige)
        
        print("Méthode réussie : Latin-1 avec ftfy")
        
    except Exception as e:
        print(f"Méthode échouée : {e}")
        print("Impossible de corriger le fichier automatiquement.")
        return
    
    # Corriger récursivement toutes les strings
    print("Correction de tous les champs texte...")
    data_corrige = corriger_objet(data)
    
    # Sauvegarder le fichier corrigé
    print("Sauvegarde du fichier corrigé...")
    with open(r'C:\Users\SAMBO\Downloads\questions_reponses_justifications_corrige.json', 'w', encoding='utf-8') as f:
        json.dump(data_corrige, f, ensure_ascii=False, indent=2)
    
    print("✅ Fichier corrigé sauvegardé : questions_reponses_justifications_corrige.json")
    
    # Afficher un exemple
    print("\nExemple de question corrigée :")
    print(data_corrige['questions'][0]['question'])
    print(data_corrige['questions'][0]['options'])

if __name__ == "__main__":
    main()
