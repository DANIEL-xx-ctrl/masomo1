/**
 * Pre-seeded primary school subjects for the RDC education system.
 * Extracted from the official "Résumé Barémique et Synthèse des Cours
 * par Classe du Primaire" document.
 *
 * These are the Degré Terminal (5ème et 6ème Année) subjects — the most
 * complete set. They cover all 5 domains with their maxima.
 */

export interface PrimarySubject {
  name: string
  code: string
  coefficient: number
  maxTJ: number
  maxEX: number
  maxTRIM: number
  maxAnnuel: number
  domain: string
}

// Degré Terminal (5ème et 6ème Année) — the most complete curriculum
export const PRIMARY_SUBJECTS: PrimarySubject[] = [
  // DOMAINE DES LANGUES
  { name: 'Français - Expression Orale / Élocution', code: 'PRIM_FR_ORALE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'DOMAINE DES LANGUES' },
  { name: 'Français - Lecture expliquée & Compréhension', code: 'PRIM_FR_LECTURE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'DOMAINE DES LANGUES' },
  { name: 'Français - Grammaire & Analyse', code: 'PRIM_FR_GRAMMAIRE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES LANGUES' },
  { name: 'Français - Conjugaison', code: 'PRIM_FR_CONJUG', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES LANGUES' },
  { name: 'Français - Orthographe & Dictée', code: 'PRIM_FR_ORTHO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES LANGUES' },
  { name: 'Français - Vocabulaire', code: 'PRIM_FR_VOCAB', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES LANGUES' },
  { name: 'Français - Composition / Rédaction', code: 'PRIM_FR_REDACT', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES LANGUES' },

  // DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE
  { name: 'Arithmétique & Numération', code: 'PRIM_MATH_ARITH', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },
  { name: 'Système Métrique & Grandeurs', code: 'PRIM_MATH_METRIQ', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },
  { name: 'Géométrie & Formes', code: 'PRIM_MATH_GEOM', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },
  { name: 'Problèmes & Raisonnement', code: 'PRIM_MATH_PROB', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },
  { name: 'Sciences Naturelles & Hygiène', code: 'PRIM_SCI_NAT', coefficient: 1, maxTJ: 15, maxEX: 30, maxTRIM: 60, maxAnnuel: 180, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },
  { name: 'Notions de Physique / Chimie', code: 'PRIM_SCI_PHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },
  { name: 'Technologie & T.P.', code: 'PRIM_TECHNO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE' },

  // DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT
  { name: 'Histoire de la RDC et du Monde', code: 'PRIM_HIST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT' },
  { name: 'Géographie de la RDC et du Monde', code: 'PRIM_GEO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT' },
  { name: 'Éducation à la Citoyenneté & Morale', code: 'PRIM_CITOYEN', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT' },
  { name: 'Éducation Santé & Environnement', code: 'PRIM_SANTE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT' },

  // DOMAINE DES ARTS
  { name: 'Arts plastiques / Dessin', code: 'PRIM_ART_PLAST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES ARTS' },
  { name: 'Musicologie / Chant', code: 'PRIM_MUSIQUE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DES ARTS' },

  // DOMAINE DU DÉVELOPPEMENT PERSONNEL
  { name: 'Éducation physique & sports', code: 'PRIM_EDPHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL' },
  { name: 'Activités Agropastorales & Travaux Manuels', code: 'PRIM_AGROPAST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL' },
  { name: 'Religion', code: 'PRIM_RELIGION', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL' },
]
