/**
 * Pre-seeded primary school subjects for the RDC education system.
 *
 * This file contains subjects for THREE degrees, aligned with the official
 * MINEDUC bulletin document (Bulletins_MINEDUC_2024_2025_Toutes_Classes.docx).
 * Each subject has a `degree` field ('elementaire' | 'moyen' | 'terminal')
 * so the UI can filter by degree.
 *
 * Hiérarchie à 3 niveaux (stockée explicitement dans la DB) :
 *   - title    : TITRE  (ex: "DOMAINE DES LANGUES")
 *   - subtitle : SOUS-TITRE (ex: "Français", "Langues Congolaises")
 *   - name     : MATIÈRE (ex: "Vocabulaire", "Expression Orale")
 *
 * Le champ `domain` (legacy) est conservé pour compatibilité arrière mais
 * n'est plus utilisé par l'UI — celle-ci lit `title` et `subtitle` directement.
 */

export interface PrimarySubject {
  name: string       // MATIÈRE (ex: "Expression Orale")
  code: string
  coefficient: number
  maxTJ: number
  maxEX: number
  maxTRIM: number
  maxAnnuel: number
  title: string      // TITRE (ex: "DOMAINE DES LANGUES")
  subtitle: string   // SOUS-TITRE (ex: "Français")
  domain: string     // legacy = title (pour compatibilité arrière)
  degree: string     // 'elementaire' | 'moyen' | 'terminal'
}

// Helpers pour construire les entrées de manière concise
const T = {
  LANGUES: 'DOMAINE DES LANGUES',
  MATH_SCI_TECH: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
  UNIVERS_SOCIAL: "DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT",
  ARTS: 'DOMAINE DES ARTS',
  DEV_PERSO: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
}

export const PRIMARY_SUBJECTS: PrimarySubject[] = [
  // ===== DEGRÉ ÉLÉMENTAIRE (1ère et 2ème Année) =====
  // Max Annuel Général: 3360 pts

  // DOMAINE DES LANGUES
  { name: 'Expression Orale', code: 'PRIM_DE_LN_ORALE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Langues Congolaises', domain: T.LANGUES, degree: 'elementaire' },
  { name: 'Expression Écrite', code: 'PRIM_DE_LN_ECRITE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Langues Congolaises', domain: T.LANGUES, degree: 'elementaire' },
  { name: 'Vocabulaire', code: 'PRIM_DE_FR_VOCAB', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'elementaire' },
  { name: 'Expression Orale', code: 'PRIM_DE_FR_ORALE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'elementaire' },
  { name: 'Lecture - Écriture', code: 'PRIM_DE_LECTURE_LN', coefficient: 1, maxTJ: 30, maxEX: 60, maxTRIM: 120, maxAnnuel: 360, title: T.LANGUES, subtitle: 'Langues Congolaises', domain: T.LANGUES, degree: 'elementaire' },

  // DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE
  { name: 'Mesures des grandeurs', code: 'PRIM_DE_MATH_MESURES', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'elementaire' },
  { name: 'Formes géométriques', code: 'PRIM_DE_MATH_FORMES', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'elementaire' },
  { name: 'Numération', code: 'PRIM_DE_MATH_NUMER', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'elementaire' },
  { name: 'Opérations', code: 'PRIM_DE_MATH_OPERAT', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'elementaire' },
  { name: 'Problèmes', code: 'PRIM_DE_MATH_PROB', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'elementaire' },
  { name: "Sciences d'éveil", code: 'PRIM_DE_SCI_EVEIL', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Sciences', domain: T.MATH_SCI_TECH, degree: 'elementaire' },
  { name: 'Technologie', code: 'PRIM_DE_TECHNO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Technologie', domain: T.MATH_SCI_TECH, degree: 'elementaire' },

  // DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT
  { name: 'Éducation Civique & Morale', code: 'PRIM_DE_CIVIQUE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'elementaire' },
  { name: 'Éducation Santé & Environnement', code: 'PRIM_DE_SANTE_ENV', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'elementaire' },

  // DOMAINE DES ARTS
  { name: 'Arts plastiques', code: 'PRIM_DE_ART_PLAST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.ARTS, subtitle: 'Arts', domain: T.ARTS, degree: 'elementaire' },
  { name: 'Arts dramatiques', code: 'PRIM_DE_ART_DRAM', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.ARTS, subtitle: 'Arts', domain: T.ARTS, degree: 'elementaire' },

  // DOMAINE DU DÉVELOPPEMENT PERSONNEL
  { name: 'Éducation physique & sports', code: 'PRIM_DE_EDPHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'elementaire' },
  { name: 'Initiation au Travail Productif (ITP)', code: 'PRIM_DE_ITP', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'elementaire' },
  { name: 'Religion / Éducation Morale', code: 'PRIM_DE_RELIGION', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'elementaire' },

  // ===== DEGRÉ MOYEN (3ème et 4ème Année) =====
  // Max Annuel Général: 3240 pts

  // DOMAINE DES LANGUES
  { name: 'Expression Orale', code: 'PRIM_MO_LN_ORALE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Langues Congolaises', domain: T.LANGUES, degree: 'moyen' },
  { name: 'Expression Écrite', code: 'PRIM_MO_LN_ECRITE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Langues Congolaises', domain: T.LANGUES, degree: 'moyen' },
  { name: 'Vocabulaire / Élocution', code: 'PRIM_MO_FR_VOCAB', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'moyen' },
  { name: 'Grammaire / Conjugaison', code: 'PRIM_MO_FR_GRAMM', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'moyen' },
  { name: 'Orthographe / Dictée', code: 'PRIM_MO_FR_ORTHO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'moyen' },
  { name: 'Lecture / Compréhension', code: 'PRIM_MO_FR_LECTURE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'moyen' },
  { name: 'Rédaction / Composition', code: 'PRIM_MO_FR_REDACT', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'moyen' },

  // DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE
  { name: 'Arithmétique & Numération', code: 'PRIM_MO_MATH_ARITH', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'moyen' },
  { name: 'Mesures des grandeurs', code: 'PRIM_MO_MATH_MESURES', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'moyen' },
  { name: 'Formes géométriques', code: 'PRIM_MO_MATH_FORMES', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'moyen' },
  { name: 'Problèmes', code: 'PRIM_MO_MATH_PROB', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'moyen' },
  { name: "Sciences d'éveil & Hygiène", code: 'PRIM_MO_SCI_EVEIL', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Sciences', domain: T.MATH_SCI_TECH, degree: 'moyen' },
  { name: 'Technologie & T.P.', code: 'PRIM_MO_TECHNO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Technologie', domain: T.MATH_SCI_TECH, degree: 'moyen' },

  // DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT
  { name: 'Éducation Civique & Morale', code: 'PRIM_MO_CIVIQUE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'moyen' },
  { name: 'Histoire & Géographie', code: 'PRIM_MO_HIST_GEO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'moyen' },
  { name: 'Éducation Santé & Environnement', code: 'PRIM_MO_SANTE_ENV', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'moyen' },

  // DOMAINE DES ARTS
  { name: 'Arts plastiques / Dessin', code: 'PRIM_MO_ART_PLAST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.ARTS, subtitle: 'Arts', domain: T.ARTS, degree: 'moyen' },
  { name: 'Arts dramatiques / Musique', code: 'PRIM_MO_ART_MUSIQUE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.ARTS, subtitle: 'Arts', domain: T.ARTS, degree: 'moyen' },

  // DOMAINE DU DÉVELOPPEMENT PERSONNEL
  { name: 'Éducation physique & sports', code: 'PRIM_MO_EDPHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'moyen' },
  { name: 'Initiation au Travail Productif (EAT)', code: 'PRIM_MO_ITP', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'moyen' },
  { name: 'Religion / Éducation Morale', code: 'PRIM_MO_RELIGION', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'moyen' },

  // ===== DEGRÉ TERMINAL (5ème et 6ème Année / TENAFEP) =====
  // Max Annuel Général: 3180 pts

  // DOMAINE DES LANGUES
  { name: 'Expression Orale / Élocution', code: 'PRIM_TE_FR_ORALE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },
  { name: 'Lecture expliquée & Compréhension', code: 'PRIM_TE_FR_LECTURE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },
  { name: 'Grammaire & Analyse', code: 'PRIM_TE_FR_GRAMM', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },
  { name: 'Conjugaison', code: 'PRIM_TE_FR_CONJUG', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },
  { name: 'Orthographe & Dictée', code: 'PRIM_TE_FR_ORTHO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },
  { name: 'Vocabulaire', code: 'PRIM_TE_FR_VOCAB', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },
  { name: 'Composition / Rédaction', code: 'PRIM_TE_FR_REDACT', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.LANGUES, subtitle: 'Français', domain: T.LANGUES, degree: 'terminal' },

  // DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE
  { name: 'Arithmétique & Numération', code: 'PRIM_TE_MATH_ARITH', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'terminal' },
  { name: 'Système Métrique & Grandeurs', code: 'PRIM_TE_MATH_METRIQ', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'terminal' },
  { name: 'Géométrie & Formes', code: 'PRIM_TE_MATH_GEOM', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'terminal' },
  { name: 'Problèmes & Raisonnement', code: 'PRIM_TE_MATH_PROB', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, title: T.MATH_SCI_TECH, subtitle: 'Mathématiques', domain: T.MATH_SCI_TECH, degree: 'terminal' },
  { name: 'Sciences Naturelles & Hygiène', code: 'PRIM_TE_SCI_NAT', coefficient: 1, maxTJ: 15, maxEX: 30, maxTRIM: 60, maxAnnuel: 180, title: T.MATH_SCI_TECH, subtitle: 'Sciences', domain: T.MATH_SCI_TECH, degree: 'terminal' },
  { name: 'Notions de Physique / Chimie', code: 'PRIM_TE_SCI_PHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Sciences', domain: T.MATH_SCI_TECH, degree: 'terminal' },
  { name: 'Technologie & T.P.', code: 'PRIM_TE_TECHNO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.MATH_SCI_TECH, subtitle: 'Technologie', domain: T.MATH_SCI_TECH, degree: 'terminal' },

  // DOMAINE DE L'UNIVERS SOCIAL ET ENVIRONNEMENT
  { name: 'Histoire de la RDC et du Monde', code: 'PRIM_TE_HIST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'terminal' },
  { name: 'Géographie de la RDC et du Monde', code: 'PRIM_TE_GEO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'terminal' },
  { name: 'Éducation à la Citoyenneté & Morale', code: 'PRIM_TE_CITOYEN', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'terminal' },
  { name: 'Éducation Santé & Environnement', code: 'PRIM_TE_SANTE_ENV', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.UNIVERS_SOCIAL, subtitle: 'Univers social', domain: T.UNIVERS_SOCIAL, degree: 'terminal' },

  // DOMAINE DES ARTS
  { name: 'Arts plastiques / Dessin', code: 'PRIM_TE_ART_PLAST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.ARTS, subtitle: 'Arts', domain: T.ARTS, degree: 'terminal' },
  { name: 'Musicologie / Chant', code: 'PRIM_TE_MUSIQUE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.ARTS, subtitle: 'Arts', domain: T.ARTS, degree: 'terminal' },

  // DOMAINE DU DÉVELOPPEMENT PERSONNEL
  { name: 'Éducation physique & sports', code: 'PRIM_TE_EDPHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'terminal' },
  { name: 'Activités Agropastorales & Travaux Manuels', code: 'PRIM_TE_AGROPAST', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'terminal' },
  { name: 'Religion / Éducation Morale', code: 'PRIM_TE_RELIGION', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, title: T.DEV_PERSO, subtitle: 'Développement personnel', domain: T.DEV_PERSO, degree: 'terminal' },
]
