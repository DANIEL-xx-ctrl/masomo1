// ============================================================
// MASOMO — Rain-style confetti (no external dependency)
// ------------------------------------------------------------
// Drops fall from the top of the viewport like SEPARATE raindrops:
//   - spawned continuously across the full width
//   - fall straight down under gentle gravity
//   - each drop is a colored "head" with a motion-streak trail
//   - slight horizontal drift (wind), no chaotic explosion
//   - new drops keep spawning for ~55% of `duration`, then
//     existing drops finish falling and the canvas cleans up.
// Safe to call multiple times — a single canvas is reused.
// ============================================================

interface ConfettiOptions {
  duration?: number // ms, default 2500 — total rain time (spawn + tail)
  count?: number // total drops to spawn, default 160
  // Kept for API compatibility with the old burst API. Ignored in rain mode.
  originX?: number
  originY?: number
  colors?: string[]
}

const DEFAULT_COLORS = [
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
]

interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  shape: 'drop' | 'shard' // 80% drops, 20% thin slivers for variety
  rot: number
  vrot: number
}

let activeCanvas: HTMLCanvasElement | null = null
let activeRAF: number | null = null
let activeUntil = 0

export function fireConfetti(opts: ConfettiOptions = {}): void {
  if (typeof document === 'undefined') return

  const {
    duration = 2500,
    count = 160,
    colors = DEFAULT_COLORS,
  } = opts

  // Reuse a single canvas across multiple bursts
  let canvas = activeCanvas
  const isFreshCanvas = !canvas
  if (!canvas) {
    canvas = document.createElement('canvas')
    // CSS opacity transition gives a smooth fade-in/out at the element level
    // on top of the per-frame draw-alpha below. Belt and suspenders.
    canvas.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9999;width:100vw;height:100vh;opacity:0;transition:opacity 350ms ease-out;'
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    document.body.appendChild(canvas)
    activeCanvas = canvas

    const onResize = () => {
      if (activeCanvas) {
        activeCanvas.width = window.innerWidth
        activeCanvas.height = window.innerHeight
      }
    }
    window.addEventListener('resize', onResize, { once: true })
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const now = performance.now()
  const startTime = now
  // Spawn over the first ~55% of duration, then let drops finish falling.
  const spawnUntil = startTime + duration * 0.55
  // Hard cap: spawn window + tail time for the last drops to exit the bottom.
  activeUntil = Math.max(activeUntil, now + duration + 1400)
  // Fade-in over the first 350ms, fade-out over the last 450ms.
  const fadeInMs = 350
  const fadeOutMs = 450

  // Trigger the CSS opacity transition to 1 on the next frame so the
  // browser actually animates it (setting opacity:1 synchronously right
  // after append would skip the transition).
  if (isFreshCanvas) {
    requestAnimationFrame(() => {
      if (activeCanvas) activeCanvas.style.opacity = '1'
    })
  } else {
    // Reusing an existing canvas — make sure it's visible.
    canvas.style.opacity = '1'
  }

  const drops: Drop[] = []
  let spawned = 0
  // Per-frame global alpha multiplier used for the draw-level fade-in/out.
  let currentAlpha = 0

  function spawnDrop() {
    if (!canvas) return
    const shape: Drop['shape'] = Math.random() < 0.8 ? 'drop' : 'shard'
    drops.push({
      // Spread across the full viewport width
      x: Math.random() * canvas.width,
      // Stagger just above the viewport so they don't appear all at once
      y: -20 - Math.random() * 120,
      // Very slight horizontal drift (wind)
      vx: (Math.random() - 0.5) * 0.8,
      // Gentle initial downward velocity — gravity does the rest
      vy: 2 + Math.random() * 3,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape,
      rot: shape === 'shard' ? Math.random() * Math.PI * 2 : 0,
      vrot: shape === 'shard' ? (Math.random() - 0.5) * 0.08 : 0,
    })
    spawned++
  }

  // Cancel any previous RAF
  if (activeRAF !== null) {
    cancelAnimationFrame(activeRAF)
  }

  function drawDrop(p: Drop) {
    if (!ctx) return
    ctx.save()
    if (p.shape === 'drop') {
      // Motion-streak trail: a fading triangle behind the drop head,
      // length scaled with velocity — looks like a real falling raindrop.
      const len = Math.min(34, Math.max(10, p.vy * 2.6))
      const grad = ctx.createLinearGradient(p.x, p.y - len, p.x, p.y)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, p.color)
      ctx.fillStyle = grad
      ctx.globalAlpha = currentAlpha
      ctx.beginPath()
      ctx.moveTo(p.x - p.size * 0.45, p.y)
      ctx.lineTo(p.x + p.size * 0.45, p.y)
      ctx.lineTo(p.x, p.y - len)
      ctx.closePath()
      ctx.fill()
      // Drop head — a small crisp circle
      ctx.fillStyle = p.color
      ctx.globalAlpha = 0.95 * currentAlpha
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * 0.55, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Thin vertical sliver — a small confetti shard tumbling slowly
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = 0.9 * currentAlpha
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size * 0.3, -p.size, p.size * 0.6, p.size * 1.8)
    }
    ctx.restore()
  }

  function tick() {
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const t = performance.now()

    // ---- Per-frame fade envelope ----
    // Fade IN over [startTime, startTime + fadeInMs], hold at 1,
    // then fade OUT over the last fadeOutMs before activeUntil.
    const elapsedSinceStart = t - startTime
    const remaining = activeUntil - t
    let alpha = 1
    if (elapsedSinceStart < fadeInMs) {
      alpha = Math.max(0, elapsedSinceStart / fadeInMs)
    } else if (remaining < fadeOutMs) {
      alpha = Math.max(0, remaining / fadeOutMs)
    }
    currentAlpha = alpha

    // Spawn new drops over the spawn window — a couple per frame
    // so they appear as separate, staggered drops (not a wall).
    if (t < spawnUntil && spawned < count) {
      const want = Math.min(2, count - spawned)
      for (let i = 0; i < want; i++) spawnDrop()
    }

    const remainingDrops: Drop[] = []
    for (const p of drops) {
      p.vy += 0.16 // gentle gravity — rain, not explosion
      p.vx *= 0.995 // mild air drag on horizontal drift
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vrot
      // Keep drawing until the drop exits the bottom of the viewport
      if (p.y < canvas.height + 40) {
        drawDrop(p)
        remainingDrops.push(p)
      }
    }
    drops.length = 0
    drops.push(...remainingDrops)

    if (t < activeUntil && (drops.length > 0 || spawned < count)) {
      activeRAF = requestAnimationFrame(tick)
    } else {
      // Done — the per-frame draw-level fade-out has already made the
      // drops invisible over the last fadeOutMs, so we just need to
      // remove the canvas. A tiny deferral avoids a flash if the last
      // frame hadn't been painted yet.
      const toRemove = activeCanvas
      window.setTimeout(() => {
        if (toRemove && toRemove.parentNode && activeCanvas === toRemove) {
          if (ctx) ctx.clearRect(0, 0, toRemove.width, toRemove.height)
          toRemove.parentNode.removeChild(toRemove)
          activeCanvas = null
          activeRAF = null
          activeUntil = 0
        }
      }, 50)
      activeRAF = null
    }
  }

  activeRAF = requestAnimationFrame(tick)
}
