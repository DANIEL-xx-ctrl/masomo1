/**
 * Bulletin Parser — Extrait la structure d'un fichier Excel bulletin RDC.
 *
 * Le fichier Excel contient 3 feuilles :
 *   - "BULLETIN" : le bulletin modèle d'un élève (en-tête + tableau de notes)
 *   - "LISTE"    : base de données de tous les élèves avec leurs notes
 *   - "Feuil1"   : liste simple des élèves (nom + numéro)
 *
 * La structure extraite est sérialisée en JSON pour stockage dans
 * BulletinTemplate.structure. Elle sert à :
 *   - Visualiser le bulletin dans l'application (HTML)
 *   - Régénérer un Excel/PDF/Word à la demande
 */

import * as XLSX from 'xlsx'

export interface BulletinHeader {
  pays: string
  ville: string
  commune: string
  ecole: string
  code: string
  eleveNom: string
  eleveId: string
  eleveDateNaiss: string
  eleveClasse: string
  elevePerm: string
  titre: string
}

export interface BulletinCourse {
  nom: string
  maxPer: number | string
  // Premier trimestre
  p1: number | string
  p2: number | string
  maxEX1: number | string
  ptsObt1: number | string
  maxTrim1: number | string
  trim1Pts: number | string
  // Deuxième trimestre
  p3: number | string
  p4: number | string
  maxEX2: number | string
  ptsObt2: number | string
  maxTrim2: number | string
  trim2Pts: number | string
  // Troisième trimestre (présent pour 3e-6e primaire)
  p5?: number | string
  p6?: number | string
  maxEX3?: number | string
  ptsObt3?: number | string
  maxTrim3?: number | string
  trim3Pts?: number | string
}

export interface BulletinDomain {
  nom: string
  sousDomaines: {
    nom: string
    courses: BulletinCourse[]
    sousTotal?: BulletinCourse | null
  }[]
  sousTotal?: BulletinCourse | null
}

export interface BulletinMaxima {
  row: BulletinCourse
  pourcentage?: {
    p1: string
    p2: string
    p3: string
    p4: string
    p5?: string
    p6?: string
  }
}

export interface BulletinStructure {
  header: BulletinHeader
  trimestres: string[] // ex: ["PREMIER TRIMESTRE", "DEUXIEME TRIMESTRE", "TROISIEME TRIMESTRE"]
  domaines: BulletinDomain[]
  maxima: BulletinMaxima | null
  meta: {
    fileName: string
    level: number
    levelLabel: string
    detectedAt: string
    trimesterCount: 2 | 3
  }
}

/**
 * Détecte le niveau (1-6) à partir du nom du fichier.
 * 1ère/1_re/1re → 1, 2ème/2_me → 2, etc.
 */
export function detectLevel(fileName: string): number {
  const base = fileName.toLowerCase()
  const m =
    base.match(/(\d)[èe]me/) ||
    base.match(/(\d)_?me/) ||
    base.match(/(\d)_?re/) ||
    base.match(/(\d)re/) ||
    base.match(/(\d)/)
  return m ? parseInt(m[1], 10) : 0
}

/**
 * Label joli pour un niveau numérique.
 */
export function levelLabel(level: number): string {
  const map: Record<number, string> = {
    1: "1ère PRIMAIRE",
    2: "2ème PRIMAIRE",
    3: "3ème PRIMAIRE",
    4: "4ème PRIMAIRE",
    5: "5ème PRIMAIRE",
    6: "6ème PRIMAIRE",
    7: "1ère SECONDAIRE",
    8: "2ème SECONDAIRE",
    9: "3ème SECONDAIRE",
    10: "4ème SECONDAIRE",
    11: "5ème SECONDAIRE",
    12: "6ème SECONDAIRE",
  }
  return map[level] || `Niveau ${level}`
}

/**
 * Convertit une valeur cellule en nombre si possible, sinon string.
 */
function val(v: unknown): number | string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') return v
  const s = String(v).trim()
  const n = parseFloat(s)
  if (!isNaN(n) && /^\d/.test(s)) return n
  return s
}

/**
 * Parse un fichier Excel bulletin (Buffer) et retourne la structure structurée.
 */
export function parseBulletinExcel(buffer: Buffer, fileName: string): BulletinStructure {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames.includes('BULLETIN') ? 'BULLETIN' : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // ---- Header (lignes 1-7) ----
  const header: BulletinHeader = {
    pays: String(data[0]?.[0] || '').trim(),
    ville: String(data[2]?.[0] || '').trim(),
    commune: String(data[3]?.[0] || '').trim(),
    ecole: String(data[4]?.[0] || '').trim(),
    code: String(data[5]?.[0] || '').trim(),
    eleveNom: String(data[2]?.[8] || '').trim(),
    eleveId: String(data[3]?.[8] || '').trim(),
    eleveDateNaiss: String(data[4]?.[8] || '').trim(),
    eleveClasse: String(data[5]?.[8] || '').trim(),
    elevePerm: String(data[6]?.[8] || '').trim(),
    titre: String(data[6]?.[0] || '').trim(),
  }

  // ---- Detect trimestre count ----
  // Si on a "TROISIEME TRIMESTRE" dans la ligne 8 → 3 trimestres, sinon 2.
  const row8 = (data[7] || []).map((c) => String(c || '').toUpperCase())
  const hasThirdTrim = row8.some((c) => c.includes('TROISIEME') || c.includes('TROIS'))
  const trimesterCount: 2 | 3 = hasThirdTrim ? 3 : 2
  const trimestres = hasThirdTrim
    ? ['PREMIER TRIMESTRE', 'DEUXIEME TRIMESTRE', 'TROISIEME TRIMESTRE']
    : ['PREMIER TRIMESTRE', 'DEUXIEME TRIMESTRE']

  // ---- Domaines + Courses (à partir de la ligne 11) ----
  const domaines: BulletinDomain[] = []
  let currentDomaine: BulletinDomain | null = null
  let currentSousDomaine: BulletinDomain['sousDomaines'][number] | null = null

  // Index max pour la boucle (on s'arrête à "MAXIMA GENERAUX")
  const startRow = 10
  for (let i = startRow; i < data.length; i++) {
    const row = data[i] || []
    const col0 = String(row[0] || '').trim()
    if (!col0) continue

    const upper = col0.toUpperCase()

    // Fin du tableau
    if (upper.includes('MAXIMA GENERAUX') || upper.includes('MAXIMA GENERAL')) {
      const maximaRow: BulletinCourse = parseCourseRow(row, trimesterCount)
      const pourcentage =
        i + 1 < data.length
          ? parsePourcentageRow(data[i + 1] || [], trimesterCount)
          : undefined
      return {
        header,
        trimestres,
        domaines,
        maxima: { row: maximaRow, pourcentage },
        meta: {
          fileName,
          level: detectLevel(fileName),
          levelLabel: levelLabel(detectLevel(fileName)),
          detectedAt: new Date().toISOString(),
          trimesterCount,
        },
      }
    }

    // Domaine : commence par "DOMAINE"
    if (upper.startsWith('DOMAINE')) {
      currentDomaine = { nom: col0, sousDomaines: [] }
      domaines.push(currentDomaine)
      currentSousDomaine = null
      continue
    }

    // Sous-total
    if (upper === 'SOUS-TOTAL' || upper === 'SOUS TOTAL' || upper === 'SOUSTOTAL') {
      const st = parseCourseRow(row, trimesterCount)
      if (currentSousDomaine) {
        currentSousDomaine.sousTotal = st
      } else if (currentDomaine) {
        currentDomaine.sousTotal = st
      } else {
        // orphan sous-total — attach to last domain
        if (domaines.length > 0) {
          const last = domaines[domaines.length - 1]
          if (last.sousDomaines.length === 0) {
            last.sousTotal = st
          } else {
            last.sousDomaines[last.sousDomaines.length - 1].sousTotal = st
          }
        }
      }
      continue
    }

    // Course row : col0 non vide ET col1 contient un nombre (maxPer)
    const maxPer = val(row[1])
    const looksLikeCourse =
      typeof maxPer === 'number' || (typeof maxPer === 'string' && maxPer !== '' && /^\d/.test(maxPer))

    if (looksLikeCourse) {
      const course = parseCourseRow(row, trimesterCount)
      // Detect sous-domaine : si la cellule suivante (col0) contient un nom
      // sans nombre et pas "DOMAINE", et qu'on est juste après un domaine → c'est un sous-domaine
      if (currentDomaine) {
        if (!currentSousDomaine) {
          // Première matière dans le domaine → créer un sous-domaine "default"
          currentSousDomaine = { nom: currentDomaine.nom, courses: [] }
          currentDomaine.sousDomaines.push(currentSousDomaine)
        }
        currentSousDomaine.courses.push(course)
      }
      continue
    }

    // Sous-domaine : col0 non vide sans nombre (ex: "LANGUES CONGOLAISES", "FRANCAIS", "MATHEMATIQUE")
    if (currentDomaine) {
      // Nouveau sous-domaine
      currentSousDomaine = { nom: col0, courses: [] }
      currentDomaine.sousDomaines.push(currentSousDomaine)
    }
  }

  // Si on n'a pas trouvé MAXIMA GENERAUX
  return {
    header,
    trimestres,
    domaines,
    maxima: null,
    meta: {
      fileName,
      level: detectLevel(fileName),
      levelLabel: levelLabel(detectLevel(fileName)),
      detectedAt: new Date().toISOString(),
      trimesterCount,
    },
  }
}

function parseCourseRow(row: unknown[], trimesterCount: 2 | 3): BulletinCourse {
  const r = row || []
  if (trimesterCount === 3) {
    return {
      nom: String(r[0] || '').trim(),
      maxPer: val(r[1]),
      p1: val(r[2]),
      p2: val(r[3]),
      maxEX1: val(r[4]),
      ptsObt1: val(r[5]),
      maxTrim1: val(r[6]),
      trim1Pts: val(r[7]),
      p3: val(r[8]),
      p4: val(r[9]),
      maxEX2: val(r[10]),
      ptsObt2: val(r[11]),
      maxTrim2: val(r[12]),
      trim2Pts: val(r[13]),
      p5: val(r[14]),
      p6: val(r[15]),
      maxEX3: val(r[16]),
      ptsObt3: val(r[17]),
      maxTrim3: val(r[18]),
      trim3Pts: val(r[19]),
    }
  }
  return {
    nom: String(r[0] || '').trim(),
    maxPer: val(r[1]),
    p1: val(r[2]),
    p2: val(r[3]),
    maxEX1: val(r[4]),
    ptsObt1: val(r[5]),
    maxTrim1: val(r[6]),
    trim1Pts: val(r[7]),
    p3: val(r[8]),
    p4: val(r[9]),
    maxEX2: val(r[10]),
    ptsObt2: val(r[11]),
    maxTrim2: val(r[12]),
    trim2Pts: val(r[13]),
  }
}

function parsePourcentageRow(
  row: unknown[],
  trimesterCount: 2 | 3
): BulletinMaxima['pourcentage'] {
  const r = row || []
  if (trimesterCount === 3) {
    return {
      p1: String(r[2] || '').trim(),
      p2: String(r[3] || '').trim(),
      p3: String(r[8] || '').trim(),
      p4: String(r[9] || '').trim(),
      p5: String(r[14] || '').trim(),
      p6: String(r[15] || '').trim(),
    }
  }
  return {
    p1: String(r[2] || '').trim(),
    p2: String(r[3] || '').trim(),
    p3: String(r[8] || '').trim(),
    p4: String(r[9] || '').trim(),
  }
}
