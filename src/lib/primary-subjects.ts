/**
 * Pre-seeded primary school subjects for the RDC education system.
 *
 * This file contains subjects for TWO degrees:
 * - Degré Élémentaire (1ère et 2ème Année) — from "PREMIERE ET DEUXIEME.docx"
 * - Degré Terminal (5ème et 6ème Année) — from "Resume_Bulletins_Cours_et_Maxima_RDC.docx"
 *
 * When the institution type is set to "primaire", these subjects are
 * pre-seeded into the database with their maxima.
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

// Combined list: Degré Élémentaire (1ère & 2ème) + Degré Terminal (5ème & 6ème)
// We use the Degré Élémentaire subjects from the Word document, and
// the Degré Terminal subjects from the previous file.
export const PRIMARY_SUBJECTS: PrimarySubject[] = [
  // ===== DEGRÉ ÉLÉMENTAIRE (1ère et 2ème Année) =====
  // Source: PREMIEREET DEUXIEME.docx

  // 1. ÉDUCATION MORALE ET CIVIQUE
  { name: 'Religion', code: 'PRIM_DE_RELIGION', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ÉDUCATION MORALE ET CIVIQUE' },
  { name: 'Éducation Civique & Morale', code: 'PRIM_DE_CIVIQUE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ÉDUCATION MORALE ET CIVIQUE' },
  { name: 'Éducation à la Vie', code: 'PRIM_DE_VIE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ÉDUCATION MORALE ET CIVIQUE' },

  // 2.A. LANGUES NATIONALES
  { name: 'Langues Nationales (Expression Orale & Écrite)', code: 'PRIM_DE_LN_ORALE', coefficient: 1, maxTJ: 25, maxEX: 50, maxTRIM: 100, maxAnnuel: 300, domain: 'ACTIVITÉS INSTRUMENTALES — Langues Nationales' },
  { name: 'Graphisme', code: 'PRIM_DE_GRAPHISME', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS INSTRUMENTALES — Langues Nationales' },
  { name: 'Lecture (Langues Nationales)', code: 'PRIM_DE_LECTURE_LN', coefficient: 1, maxTJ: 15, maxEX: 30, maxTRIM: 60, maxAnnuel: 180, domain: 'ACTIVITÉS INSTRUMENTALES — Langues Nationales' },

  // 2.B. FRANÇAIS
  { name: 'Français - Expression Orale', code: 'PRIM_DE_FR_ORALE', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'ACTIVITÉS INSTRUMENTALES — Français' },
  { name: 'Français - Lecture', code: 'PRIM_DE_FR_LECTURE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS INSTRUMENTALES — Français' },
  { name: 'Français - Conjugaison', code: 'PRIM_DE_FR_CONJUG', coefficient: 1, maxTJ: 5, maxEX: 10, maxTRIM: 20, maxAnnuel: 60, domain: 'ACTIVITÉS INSTRUMENTALES — Français' },
  { name: 'Français - Orthographe', code: 'PRIM_DE_FR_ORTHO', coefficient: 1, maxTJ: 5, maxEX: 10, maxTRIM: 20, maxAnnuel: 60, domain: 'ACTIVITÉS INSTRUMENTALES — Français' },

  // 2.C. MATHÉMATIQUE
  { name: 'Arithmétique', code: 'PRIM_DE_ARITH', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'ACTIVITÉS INSTRUMENTALES — Mathématique' },
  { name: 'Géométrie', code: 'PRIM_DE_GEOM', coefficient: 1, maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240, domain: 'ACTIVITÉS INSTRUMENTALES — Mathématique' },
  { name: 'Problèmes', code: 'PRIM_DE_PROB', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS INSTRUMENTALES — Mathématique' },

  // 3. ACTIVITÉS D'ÉVEIL SCIENTIFIQUE
  { name: 'Éducation à la Santé & Environnement', code: 'PRIM_DE_SANTE', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL SCIENTIFIQUE' },
  { name: 'Étude du Milieu', code: 'PRIM_DE_MILIEU', coefficient: 1, maxTJ: 50, maxEX: 100, maxTRIM: 200, maxAnnuel: 600, domain: 'ACTIVITÉS D\'ÉVEIL SCIENTIFIQUE' },
  { name: 'Informatique', code: 'PRIM_DE_INFO', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL SCIENTIFIQUE' },

  // 4. ACTIVITÉS D'ÉVEIL ESTHÉTIQUE
  { name: 'Dessin', code: 'PRIM_DE_DESSIN', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL ESTHÉTIQUE' },
  { name: 'Calligraphie', code: 'PRIM_DE_CALLIGRAPH', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL ESTHÉTIQUE' },
  { name: 'Chant / Musique', code: 'PRIM_DE_CHANT', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL ESTHÉTIQUE' },
  { name: 'Éducation Physique & Sports', code: 'PRIM_DE_EDPHYS', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL ESTHÉTIQUE' },
  { name: 'Travail Manuel', code: 'PRIM_DE_TRAVMAN', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'ACTIVITÉS D\'ÉVEIL ESTHÉTIQUE' },

  // ===== DEGRÉ TERMINAL (5ème et 6ème Année) =====
  // Source: Resume_Bulletins_Cours_et_Maxima_RDC.docx

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
  { name: 'Religion (Terminal)', code: 'PRIM_RELIGION', coefficient: 1, maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120, domain: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL' },
]
