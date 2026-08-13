import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

// ============================================================================
// POST /api/auth/signup
//
// Self-service registration for a brand-new institution administrator.
//
// Flow:
//   1. A first-time visitor fills in the signup form on the login page
//      (name, email, username, password).
//   2. This endpoint validates the inputs (email + username uniqueness,
//      password length) and creates:
//        a) a NEW, BLANK Institution (no demo data — no teachers, no
//           students, no classes, no grades…). Its name is a placeholder
//           ("Mon Établissement") and its password is a random token; the
//           new admin will set the real institution name + password from
//           Settings > Institution once logged in.
//        b) a NEW User with role 'admin', linked to that institution. The
//           user's email + username + password are exactly what they
//           entered, so they can log in immediately afterwards.
//   3. The endpoint returns the public user fields (no password). The login
//      page then logs the user in client-side (same shape as /api/auth/login)
//      OR the user can manually log in via the login form.
//
// Data isolation:
//   The new institution is COMPLETELY SEPARATE from every other institution.
//   It starts empty (no seed data) — the admin builds it from scratch via
//   the Teachers / Students / Parents / Staff modules.
//
// The signup user effectively becomes the "super admin" of their own
// institution: they can create accounts for their teachers, students,
// parents and staff, each with their own login password.
// ============================================================================

interface SignupBody {
  name?: string
  institutionName?: string
  email?: string
  username?: string
  password?: string
}

function generateInstitutionPassword(): string {
  // 12-char random token — unique enough to satisfy the @unique constraint
  // on Institution.password. The admin will replace it from Settings.
  return 'inst-' + randomBytes(8).toString('hex')
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody
    const name = body.name?.trim()
    const institutionName = body.institutionName?.trim()
    const email = body.email?.trim().toLowerCase()
    const username = body.username?.trim()
    const password = body.password

    // ---- Validation ----
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nom, email et mot de passe sont requis.' },
        { status: 400 }
      )
    }
    if (!institutionName) {
      return NextResponse.json(
        { error: 'Le nom de l\'établissement est requis.' },
        { status: 400 }
      )
    }
    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Le nom doit contenir au moins 2 caractères.' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      )
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide.' },
        { status: 400 }
      )
    }
    // Username format (if provided): 3-30 chars, alnum + dot/underscore/hyphen
    if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Le nom d'utilisateur doit contenir 3 à 30 caractères (lettres, chiffres, . _ -).",
        },
        { status: 400 }
      )
    }

    // ---- Uniqueness checks ----
    const existingByEmail = await db.user.findUnique({ where: { email } })
    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cette adresse email.' },
        { status: 409 }
      )
    }
    if (username) {
      const existingByUsername = await db.user.findUnique({
        where: { username },
      })
      if (existingByUsername) {
        return NextResponse.json(
          { error: "Ce nom d'utilisateur est déjà pris." },
          { status: 409 }
        )
      }
    }

    // ---- Create the blank Institution ----
    // The Institution.password field has a @unique constraint, so we generate
    // a random placeholder. The admin will set the real password from
    // Settings > Institution.
    let institutionPassword = generateInstitutionPassword()
    // Guard against the (astronomically unlikely) case of a collision
    while (await db.institution.findUnique({ where: { password: institutionPassword } })) {
      institutionPassword = generateInstitutionPassword()
    }

    const institution = await db.institution.create({
      data: {
        name: institutionName,
        password: institutionPassword,
        currentYear: '2024-2025',
        active: true,
      },
    })

    // ---- Create the admin User linked to the new institution ----
    // userCode is a short human-friendly identifier for the admin.
    const userCode = `ADM-${institution.id.slice(-6).toUpperCase()}`
    const user = await db.user.create({
      data: {
        email,
        username: username || null,
        password,
        name,
        role: 'admin',
        userCode,
        institutionId: institution.id,
        active: true,
      },
      include: {
        institution: {
          select: { id: true, name: true, active: true, currentYear: true },
        },
      },
    })

    // ---- Build the public user object (no password) ----
    // Shape matches /api/auth/login so the client can log in directly.
    const { password: _omit, institution: _inst, ...userWithoutPassword } = user

    return NextResponse.json(
      {
        user: {
          ...userWithoutPassword,
          institutionName: user.institution?.name || null,
        },
        institution: {
          id: institution.id,
          name: institution.name,
          currentYear: institution.currentYear,
        },
        message:
          'Compte créé. Votre institution est vide — configurez-la dans les Paramètres, puis créez vos enseignants et élèves.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création du compte." },
      { status: 500 }
    )
  }
}
