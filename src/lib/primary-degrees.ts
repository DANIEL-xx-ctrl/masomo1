/**
 * Official RDC primary school curriculum from the MINEDUC bulletin document.
 * Organized by degree (Degré) with all subjects, domains, and maxima.
 *
 * Source: Bulletins_MINEDUC_2024_2025_Toutes_Classes.docx
 */

export interface PrimaryCourse {
  name: string
  maxTJ: number
  maxEX: number
  maxTRIM: number
  maxAnnuel: number
}

export interface PrimaryDomain {
  name: string
  courses: PrimaryCourse[]
}

export interface PrimaryDegree {
  id: string
  label: string
  reference: string
  maxGeneralAnnuel: number
  domains: PrimaryDomain[]
}

export const PRIMARY_DEGREES: PrimaryDegree[] = [
  {
    id: 'elementaire',
    label: '1ère et 2ème Année (Degré Élémentaire)',
    reference: 'FORMULAIRE IGEP/P.S./001 - DEGRÉ ÉLÉMENTAIRE',
    maxGeneralAnnuel: 3360,
    domains: [
      {
        name: 'DOMAINE DES LANGUES',
        courses: [
          { name: 'LANGUES CONGOLAISES — Expression Orale', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'LANGUES CONGOLAISES — Expression Écrite', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'FRANÇAIS — Vocabulaire', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Expression Orale', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'LECTURE - ÉCRITURE EN LANGUES CONGOLAISES', maxTJ: 30, maxEX: 60, maxTRIM: 120, maxAnnuel: 360 },
        ],
      },
      {
        name: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
        courses: [
          { name: 'MATHEMATIQUES — Mesures des grandeurs', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'MATHEMATIQUES — Formes géométriques', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'MATHEMATIQUES — Numération', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'MATHEMATIQUES — Opérations', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'MATHEMATIQUES — Problèmes', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'SCIENCES — Sciences d\'éveil', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'TECHNOLOGIE — Technologie', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT',
        courses: [
          { name: 'Éducation Civique & Morale', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Éducation Santé & Environnement', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DES ARTS',
        courses: [
          { name: 'ÉDUCATION ARTISTIQUE — Arts plastiques', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'ÉDUCATION ARTISTIQUE — Arts dramatiques', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
        courses: [
          { name: 'Éducation physique & sports', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Initiation au Travail Productif (ITP)', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Religion / Éducation Morale', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
    ],
  },
  {
    id: 'moyen',
    label: '3ème et 4ème Année (Degré Moyen)',
    reference: 'FORMULAIRE IGEP/P.S./001 - DEGRÉ MOYEN',
    maxGeneralAnnuel: 3240,
    domains: [
      {
        name: 'DOMAINE DES LANGUES',
        courses: [
          { name: 'LANGUES CONGOLAISES — Expression Orale', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'LANGUES CONGOLAISES — Expression Écrite', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'FRANÇAIS — Vocabulaire / Élocution', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Grammaire / Conjugaison', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Orthographe / Dictée', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Lecture / Compréhension', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'FRANÇAIS — Rédaction / Composition', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
        courses: [
          { name: 'MATHEMATIQUES — Arithmétique & Numération', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'MATHEMATIQUES — Mesures des grandeurs', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'MATHEMATIQUES — Formes géométriques', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'MATHEMATIQUES — Problèmes', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'SCIENCES — Sciences d\'éveil & Hygiène', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'TECHNOLOGIE — Technologie & T.P.', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT',
        courses: [
          { name: 'Éducation Civique & Morale', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Histoire & Géographie', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Éducation Santé & Environnement', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DES ARTS',
        courses: [
          { name: 'ÉDUCATION ARTISTIQUE — Arts plastiques / Dessin', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'ÉDUCATION ARTISTIQUE — Arts dramatiques / Musique', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
        courses: [
          { name: 'Éducation physique & sports', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Initiation au Travail Productif (EAT)', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Religion / Éducation Morale', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
    ],
  },
  {
    id: 'terminal',
    label: '5ème et 6ème Année (Degré Terminal / TENAFEP)',
    reference: 'FORMULAIRE EP/P.S.001 - DEGRÉ TERMINAL',
    maxGeneralAnnuel: 3180,
    domains: [
      {
        name: 'DOMAINE DES LANGUES',
        courses: [
          { name: 'FRANÇAIS — Expression Orale / Élocution', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'FRANÇAIS — Lecture expliquée & Compréhension', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'FRANÇAIS — Grammaire & Analyse', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Conjugaison', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Orthographe & Dictée', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Vocabulaire', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'FRANÇAIS — Composition / Rédaction', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DES MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',
        courses: [
          { name: 'MATHEMATIQUES — Arithmétique & Numération', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'MATHEMATIQUES — Système Métrique & Grandeurs', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'MATHEMATIQUES — Géométrie & Formes', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'MATHEMATIQUES — Problèmes & Raisonnement', maxTJ: 20, maxEX: 40, maxTRIM: 80, maxAnnuel: 240 },
          { name: 'SCIENCES — Sciences Naturelles & Hygiène', maxTJ: 15, maxEX: 30, maxTRIM: 60, maxAnnuel: 180 },
          { name: 'SCIENCES — Notions de Physique / Chimie', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'TECHNOLOGIE — Technologie & T.P.', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DE L\'UNIVERS SOCIAL ET ENVIRONNEMENT',
        courses: [
          { name: 'Histoire de la RDC et du Monde', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Géographie de la RDC et du Monde', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Éducation à la Citoyenneté & Morale', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Éducation Santé & Environnement', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DES ARTS',
        courses: [
          { name: 'ÉDUCATION ARTISTIQUE — Arts plastiques / Dessin', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'ÉDUCATION ARTISTIQUE — Musicologie / Chant', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
      {
        name: 'DOMAINE DU DÉVELOPPEMENT PERSONNEL',
        courses: [
          { name: 'Éducation physique & sports', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Activités Agropastorales & Travaux Manuels', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
          { name: 'Religion / Éducation Morale', maxTJ: 10, maxEX: 20, maxTRIM: 40, maxAnnuel: 120 },
        ],
      },
    ],
  },
]
