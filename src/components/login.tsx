'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  GraduationCap, Lock, Loader2, Database, AlertCircle,
  Eye, EyeOff, Shield, Sun, Moon, Mail, User, Building2, AtSign, ArrowLeft, Sparkles,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useTheme } from 'next-themes'
import { fireConfetti } from '@/lib/confetti'

// ---------- Floating-label input ----------
// The placeholder sits inside the input as a regular placeholder until the
// field receives focus OR has a value — then it animates UP and shrinks,
// becoming a small uppercase label above the input.
//
// Implementation: a wrapper <div class="relative"> contains the input and
// a <label> absolutely positioned. The label uses Tailwind transitions
// driven by the `active` boolean (focus OR has-value).
function FloatingInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon: Icon,
  autoComplete,
  disabled,
  required,
  rightSlot,
  onToggleRight,
  'aria-label': ariaLabel,
}: {
  id: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  icon: React.ComponentType<{ className?: string }>
  autoComplete?: string
  disabled?: boolean
  required?: boolean
  rightSlot?: React.ReactNode
  onToggleRight?: () => void
  'aria-label'?: string
}) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0

  return (
    <div className="relative">
      {/* Leading icon */}
      <Icon
        className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none ${
          active ? 'text-emerald-400' : 'text-white/25'
        }`}
      />

      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        // No native placeholder — the floating <label> below is the sole
        // source of placeholder text. Using both at once produces a blurry
        // double-image because they don't pixel-align perfectly.
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={ariaLabel ?? placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        // Mobile overlap fix:
        // - h-14: fixed 56px height → consistent rendering across devices
        // - text-base sm:text-sm: 16px on mobile prevents iOS Safari from
        //   auto-zooming on focus (zoom shifts viewport scale and makes the
        //   absolutely-positioned label overlap the typed text). 14px on sm+.
        // - pt-6 pb-2 leading-tight: reserves 24px of top space for the
        //   floating label so typed text sits clearly below it, with a tight
        //   line-height so the text fits cleanly in the content area.
        className="w-full h-14 pl-11 pr-11 pt-6 pb-2 leading-tight rounded-xl bg-[#1a2525] border border-white/5 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
      />

      {/* Floating label — animates up & shrinks on focus/value.
          This is the ONLY placeholder; the input has no native placeholder.
          Active position top-2 (8px) + text-[10px] leaves a clear gap above
          the typed text (which starts at pt-6 = 24px). */}
      <label
        htmlFor={id}
        className={`absolute left-11 pointer-events-none select-none transition-all duration-200 ease-out
          ${active
            ? 'top-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90'
            : 'top-1/2 -translate-y-1/2 text-sm text-white/35'}
        `}
      >
        {placeholder}
      </label>

      {rightSlot && (
        <button
          type="button"
          onClick={onToggleRight}
          tabIndex={-1}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
        >
          {rightSlot}
        </button>
      )}
    </div>
  )
}

export default function Login() {
  // ---- Login mode state ----
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbEmpty, setDbEmpty] = useState(false)
  const login = useAppStore((s) => s.login)
  const setSchoolYear = useAppStore((s) => s.setSchoolYear)
  const { theme, setTheme } = useTheme()

  // ---- Signup mode state ----
  // mode: 'login' | 'signup' — toggles between the connection form and the
  // new-institution registration form.
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [suInstitutionName, setSuInstitutionName] = useState('')
  const [suName, setSuName] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suUsername, setSuUsername] = useState('')
  const [suPassword, setSuPassword] = useState('')
  const [suShowPassword, setSuShowPassword] = useState(false)
  const [suLoading, setSuLoading] = useState(false)
  const [suSuccess, setSuSuccess] = useState<string | null>(null)

  // Check if database is empty on mount
  useEffect(() => {
    async function checkDb() {
      try {
        const res = await fetch('/api/dashboard')
        if (res.ok) {
          const data = await res.json()
          if (data.stats?.totalStudents === 0 && data.stats?.totalTeachers === 0) {
            setDbEmpty(true)
          }
        }
      } catch {
        setDbEmpty(true)
      }
    }
    checkDb()
  }, [])

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (email === 'superadmin@edugest.com' || email === 'superadmin@masomo.com') {
          try {
            await fetch('/api/ensure-superadmin')
            const retryRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            })
            const retryData = await retryRes.json()
            if (retryRes.ok && retryData.user) {
              login(retryData.user)
              return
            }
          } catch {
            // fall through to the original error
          }
        }

        if (data.error?.includes('non trouvé') || data.error?.includes('incorrect')) {
          const saRes = await fetch('/api/super-admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const saData = await saRes.json()

          if (saRes.ok && saData.superAdmin) {
            login({
              ...saData.superAdmin,
              role: 'super_admin',
              password: '',
              phone: saData.superAdmin.phone || null,
              avatar: saData.superAdmin.avatar || null,
              userCode: null,
              institutionId: null,
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            setTimeout(() => fireConfetti({ duration: 2400, count: 140, originY: 0.4 }), 80)
            return
          }
        }
        throw new Error(data.error || `Erreur serveur (${res.status})`)
      }

      if (data.user) {
        login(data.user)
        const instCurrentYear = (data.user as { institution?: { currentYear?: string } })?.institution?.currentYear
        if (instCurrentYear) setSchoolYear(instCurrentYear)
        // Celebrate! Fire confetti BEFORE the component unmounts —
        // the canvas is appended to document.body and persists after
        // the Login component is replaced by the AppShell.
        setTimeout(() => fireConfetti({ duration: 2400, count: 140, originY: 0.4 }), 80)
      } else {
        setError('Réponse inattendue du serveur')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [email, password, login, setSchoolYear])

  const handleSeed = useCallback(async () => {
    setSeeding(true)
    setError(null)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erreur lors de l'initialisation")
      }
      setDbEmpty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'initialisation")
    } finally {
      setSeeding(false)
    }
  }, [])

  // ---- Reset error/message when switching modes ----
  const switchMode = useCallback((next: 'login' | 'signup') => {
    setMode(next)
    setError(null)
    setSuSuccess(null)
  }, [])

  // ---- Handle self-service institution signup ----
  // POSTs to /api/auth/signup which creates:
  //   1) a brand-new BLANK Institution (no demo data — zero students,
  //      zero teachers, zero classes, zero grades…)
  //   2) an admin User linked to that institution
  // The returned user object has the same shape as /api/auth/login, so we
  // can pass it straight to store.login() and land on the dashboard.
  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuSuccess(null)

    const institutionName = suInstitutionName.trim()
    const name = suName.trim()
    const emailVal = suEmail.trim().toLowerCase()
    const username = suUsername.trim()
    const passwordVal = suPassword

    if (!institutionName || !name || !emailVal || !passwordVal) {
      setError('Tous les champs marqués d\'un * sont obligatoires.')
      return
    }
    if (passwordVal.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setError('Adresse email invalide.')
      return
    }
    if (username && !/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
      setError("Le nom d'utilisateur doit contenir 3 à 30 caractères (lettres, chiffres, . _ -).")
      return
    }

    setSuLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionName,
          name,
          email: emailVal,
          username: username || undefined,
          password: passwordVal,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création du compte.")
      }

      // Auto-login the freshly created admin
      if (data.user) {
        login(data.user)
        if (data.institution?.currentYear) {
          setSchoolYear(data.institution.currentYear)
        }
        setTimeout(() => fireConfetti({ duration: 2400, count: 140, originY: 0.4 }), 80)
      } else {
        // Fallback: ask the user to log in manually
        setSuSuccess(
          'Compte créé avec succès. Vous pouvez maintenant vous connecter avec vos identifiants.'
        )
        setMode('login')
        setEmail(emailVal)
        setPassword('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur')
    } finally {
      setSuLoading(false)
    }
  }, [suInstitutionName, suName, suEmail, suUsername, suPassword, login, setSchoolYear])

  const handleSuperAdminLogin = useCallback(async () => {
    setError(null)
    setLoading(true)
    setEmail('superadmin@edugest.com')
    setPassword('super123')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@edugest.com', password: 'super123' }),
      })
      const data = await res.json()

      if (!res.ok || !data.user) {
        try {
          await fetch('/api/ensure-superadmin')
          const retryRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'superadmin@edugest.com', password: 'super123' }),
          })
          const retryData = await retryRes.json()
          if (retryRes.ok && retryData.user) {
            login(retryData.user)
            setTimeout(() => fireConfetti({ duration: 2400, count: 140, originY: 0.4 }), 80)
            return
          }
          throw new Error(retryData.error || 'Identifiants super admin incorrects')
        } catch (retryErr) {
          throw new Error(
            retryErr instanceof Error
              ? `Échec de la connexion Super Admin: ${retryErr.message}`
              : 'Échec de la connexion Super Admin'
          )
        }
      }

      login(data.user)
      setTimeout(() => fireConfetti({ duration: 2400, count: 140, originY: 0.4 }), 80)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [login])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#070b11] relative overflow-hidden">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all"
        aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute top-2 left-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </button>

      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-teal-500/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/5 bg-[#0d1a1a]">
          {/* ====== HEADER (single panel — no multi-institution sidebar) ====== */}
          <div className="flex flex-col items-center justify-center pt-10 pb-6 px-8 relative">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-teal-500/8 blur-[80px]" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-[80px]" />
            </div>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20 relative z-10">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 relative z-10">MASOMO</h1>
            <p className="text-xs text-white/50 relative z-10">Système de Gestion Scolaire</p>
          </div>

          {/* ====== FORM ====== */}
          <div className="flex-1 flex flex-col justify-center px-8 pb-8">
            {mode === 'login' ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">Connexion au compte</h2>
                  <p className="text-sm text-white/40">Entrez vos identifiants pour continuer</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {suSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm"
                    >
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>{suSuccess}</span>
                    </motion.div>
                  )}

                  {/* Email / username / full name — floating label */}
                  <FloatingInput
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email, ID, code utilisateur ou nom complet"
                    icon={Mail}
                    autoComplete="username"
                    disabled={loading}
                    required
                  />

                  {/* Password — floating label + show/hide */}
                  <FloatingInput
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    icon={Lock}
                    autoComplete="current-password"
                    disabled={loading}
                    required
                    rightSlot={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    onToggleRight={() => setShowPassword(!showPassword)}
                  />

                  {/* Submit */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connexion...
                        </>
                      ) : (
                        'Se connecter'
                      )}
                    </button>
                  </div>

                  {dbEmpty && (
                    <button
                      type="button"
                      onClick={handleSeed}
                      disabled={seeding}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-emerald-500/30 text-emerald-400/70 text-sm hover:bg-emerald-500/5 transition-all disabled:opacity-50"
                    >
                      {seeding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Initialisation...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
                          Initialiser la base de données
                        </>
                      )}
                    </button>
                  )}
                </form>

                {/* Login hint — explain that users can log in with ID, email, or name */}
                <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-white/40 text-xs leading-relaxed">
                  <AtSign className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400/60" />
                  <span>
                    Vous pouvez vous connecter avec votre <strong className="text-white/60">identifiant (ID)</strong> (ex. ELV-001, TCH-001, STF-001),
                    votre <strong className="text-white/60">email</strong>, votre nom d&apos;utilisateur, ou votre <strong className="text-white/60">nom complet</strong>.
                    <br />
                    <span className="text-white/30">Les identifiants sont visibles dans Paramètres → Comptes & Mots de passe.</span>
                  </span>
                </div>

                {/* Super Admin quick-login (kept — internal use only) */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleSuperAdminLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/15 hover:border-orange-500/30 transition-all disabled:opacity-50"
                  >
                    <Shield className="w-4 h-4" />
                    Super Admin
                  </button>
                </div>

                {/* ---- Switch to signup mode ---- */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-white/40 mb-3">Pas encore d'établissement ?</p>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all disabled:opacity-50"
                  >
                    <Building2 className="w-4 h-4" />
                    Créer mon établissement
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ====== SIGNUP PANEL ====== */}
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-3"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Retour à la connexion
                  </button>
                  <h2 className="text-xl font-bold text-white mb-1">Créer mon établissement</h2>
                  <p className="text-sm text-white/40">
                    Votre institution sera créée vide — vous pourrez ensuite ajouter vos enseignants et élèves.
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {/* Institution name */}
                  <FloatingInput
                    id="su-institution"
                    type="text"
                    value={suInstitutionName}
                    onChange={(e) => setSuInstitutionName(e.target.value)}
                    placeholder="Nom de l'établissement *"
                    icon={Building2}
                    autoComplete="organization"
                    disabled={suLoading}
                    required
                  />

                  {/* Admin full name */}
                  <FloatingInput
                    id="su-name"
                    type="text"
                    value={suName}
                    onChange={(e) => setSuName(e.target.value)}
                    placeholder="Votre nom complet *"
                    icon={User}
                    autoComplete="name"
                    disabled={suLoading}
                    required
                  />

                  {/* Admin email */}
                  <FloatingInput
                    id="su-email"
                    type="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="Email de connexion *"
                    icon={Mail}
                    autoComplete="email"
                    disabled={suLoading}
                    required
                  />

                  {/* Username (optional) */}
                  <FloatingInput
                    id="su-username"
                    type="text"
                    value={suUsername}
                    onChange={(e) => setSuUsername(e.target.value)}
                    placeholder="Nom d'utilisateur (optionnel)"
                    icon={AtSign}
                    autoComplete="username"
                    disabled={suLoading}
                  />

                  {/* Password */}
                  <FloatingInput
                    id="su-password"
                    type={suShowPassword ? 'text' : 'password'}
                    value={suPassword}
                    onChange={(e) => setSuPassword(e.target.value)}
                    placeholder="Mot de passe (min. 6 caractères) *"
                    icon={Lock}
                    autoComplete="new-password"
                    disabled={suLoading}
                    required
                    rightSlot={suShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    onToggleRight={() => setSuShowPassword(!suShowPassword)}
                  />

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={suLoading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {suLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Création...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Créer mon établissement
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-white/30 text-center leading-relaxed">
                    En créant votre établissement, vous devenez son administrateur.
                    Vos données sont isolées et privées — personne d'autre n'y a accès.
                  </p>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-white/5">
            <p className="text-[11px] text-white/20 text-center">© 2024 MASOMO — Système de Gestion Scolaire</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
