/**
 * CONSTANTES ET LIBELLÉS CENTRALISÉS - DUC CONCOURS
 * Conforme au cahier des charges UX/UI (gemini-code)
 */

window.DUC_CONSTANTS = {
  // Mapping officiel des matières (clé technique en base -> Libellé propre affiché)
  MATIERES: {
    'biologie': 'Biologie',
    'burkinafaso': 'Burkina Faso',
    'chimie': 'Chimie',
    'culture_generale': 'Culture générale',
    'general': 'Questions mixtes',
    'technologie_generale': 'Technologie générale',
    'electrotechnique': 'Électrotechnique',
    'electronique': 'Électronique',
    'energies_renouvelables': 'Énergies renouvelables',
    'energie_photovoltaique': 'Énergie photovoltaïque',
    'machines_industrielles': 'Moteurs et machines industrielles',
    'transformateurs': 'Transformateurs',
    'mathematiques': 'Mathématiques',
    'physique': 'Physique',
    'svt': 'SVT'
  },

  // Parcours de concours et disciplines prévues. Les domaines restent verrouillés
  // dans les menus tant que leur banque de questions n'a pas été préparée.
  SPECIALITES_CONCOURS: {
    ingenieur_application_energie: {
      nom: "Ingénieur en application de l'énergie",
      domaines: [
        'technologie_generale',
        'electrotechnique',
        'electronique',
        'energies_renouvelables',
        'energie_photovoltaique',
        'machines_industrielles',
        'transformateurs'
      ]
    }
  },

  // Les 3 modes officiels unifiés
  MODES: {
    CONCOURS_BLANC: {
      id: 'concours_blanc',
      titre: 'Concours blanc',
      sousTitre: 'Simulation complète',
      description: 'Mise en situation réelle avec chronomètre.',
      details: '60 questions · 60 minutes',
      btnTexte: 'Commencer le concours blanc',
      chrono: true
    },
    ENTRAINEMENT_MATIERE: {
      id: 'cible',
      titre: 'Entraînement par matière',
      sousTitre: 'Focus disciplinaire',
      description: 'Progressez sur une matière ciblée avec chronomètre.',
      details: 'Chronométré · Au choix',
      btnTexte: 'Démarrer l’entraînement',
      chrono: true
    },
    REVISION_LIBRE: {
      id: 'libre',
      titre: 'Révision libre',
      sousTitre: 'À votre rythme',
      description: 'Révisez sans stress avec explication immédiate après chaque question.',
      details: 'Sans chronomètre · Explications directes',
      btnTexte: 'Commencer la révision',
      chrono: false
    }
  },

  // Options de longueur de révision avec estimation de temps
  LONGUEURS_REVISION: [
    { valeur: '10', label: 'Rapide · 10 questions (~10 min)' },
    { valeur: '20', label: 'Standard · 20 questions (~20 min)', defaut: true },
    { valeur: '30', label: 'Approfondie · 30 questions (~30 min)' },
    { valeur: '40', label: 'Complète · 40 questions (~40 min)' }
  ],

  // Infobulles et explications
  AIDE_ETATS: {
    EN_LIGNE: 'En ligne : vos séances sont sauvegardées localement et synchronisées sur votre compte Cloud.',
    HORS_LIGNE: 'Mode hors-ligne : vous pouvez continuer à réviser. Vos réponses sont conservées sur cet appareil et seront synchronisées dès le retour du réseau.'
  }
};

/**
 * Fonction utilitaire universelle pour formater le nom d'une matière
 */
window.formaterMatiere = function(cle) {
  if (!cle) return 'Toutes matières';
  const normalisee = String(cle).trim().toLowerCase();
  return window.DUC_CONSTANTS.MATIERES[normalisee] || (cle.charAt(0).toUpperCase() + cle.slice(1));
};
