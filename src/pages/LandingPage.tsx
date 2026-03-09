import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// ── Scroll animation hook ─────────────────────────────────────────────────────
function useScrollAnimations() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-visible') }),
      { threshold: 0.07, rootMargin: '0px 0px -50px 0px' },
    )
    const timer = setTimeout(() => {
      document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el))
    }, 60)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [])
}

const NAV_LINKS = [
  { label: 'Para Pacientes', id: 'para-pacientes' },
  { label: 'Para Médicos',   id: 'para-medicos' },
  { label: 'Cómo Funciona',  id: 'como-funciona' },
  { label: 'Nosotros',       id: 'nosotros' },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useScrollAnimations()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen font-sans">

      {/* ══════════════════════════════ NAVBAR ══════════════════════════════ */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/96 backdrop-blur-md shadow-sm border-b border-slate-100'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="relative flex items-center h-9 shrink-0">
            <img
              src="/logo.png" alt="Contigo"
              className={`h-9 w-auto absolute transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            />
            <span className={`text-xl font-extrabold transition-opacity duration-300 ${scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <span style={{ color: '#86efac' }}>con</span><span className="text-white">tigo</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <button key={link.id} onClick={() => goTo(link.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  scrolled
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}>
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <Link to="/login"
              className={`hidden md:inline-flex items-center px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                scrolled
                  ? 'border-blue-600 text-blue-600 hover:bg-blue-50'
                  : 'border-white/50 text-white hover:bg-white/10 hover:border-white/80'
              }`}>
              Iniciar sesión
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
              }`}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-lg px-4 pb-5 pt-3">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <button key={link.id} onClick={() => goTo(link.id)}
                  className="text-left px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  {link.label}
                </button>
              ))}
              <div className="border-t border-slate-100 mt-2 pt-2 flex flex-col gap-2">
                <Link to="/login"
                  className="px-4 py-3 rounded-xl border-2 border-blue-600 text-blue-600 text-sm font-semibold text-center hover:bg-blue-50 transition-colors">
                  Iniciar sesión
                </Link>
                <Link to="/registro"
                  className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold text-center transition-colors">
                  Comenzar ahora
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ══════════════════════════════ HERO ════════════════════════════════ */}
      <section
        className="relative min-h-[100svh] flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a4f7a 45%, #16a34a 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full bg-white/4 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-green-400/8 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-24 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Copy */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: '#86efac' }}>
                Salud Primaria · Colombia
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold text-white leading-[1.08] tracking-tight mb-6">
                Recupera el control<br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(to right, #86efac, #5eead4)' }}
                >
                  de tu salud.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-white/78 leading-relaxed mb-10 max-w-xl">
                Un médico en menos de 36 horas y tus medicamentos en la puerta.
                Por{' '}
                <strong className="text-white font-bold">$80.000 COP al mes</strong>
                {' '}— menos de lo que ya gastas navegando un sistema que no funciona.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/registro"
                  className="px-7 py-3.5 bg-white text-[#1e3a5f] font-bold rounded-2xl hover:scale-[1.03] hover:bg-blue-50 transition-all duration-200 shadow-xl shadow-black/25 text-sm">
                  Comenzar ahora
                </Link>
                <button onClick={() => goTo('para-pacientes')}
                  className="px-7 py-3.5 border-2 border-white/40 text-white font-semibold rounded-2xl hover:bg-white/10 hover:border-white/70 transition-all duration-200 text-sm">
                  Conoce más
                </button>
              </div>
            </div>

            {/* App card */}
            <div className="hidden lg:flex justify-center items-center">
              <HeroCard />
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/30" aria-hidden="true">
          <span className="text-[10px] font-bold tracking-widest uppercase">Scroll</span>
          <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════ PARA PACIENTES ══════════════════════════ */}
      <section id="para-pacientes" className="bg-white py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          <div className="text-center max-w-2xl mx-auto mb-24 fade-up">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Para Pacientes</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-4">
              Todo lo que necesitas para cuidar tu salud
            </h2>
            <p className="text-lg text-slate-500">
              Diseñado para que tú tengas el control, sin filas ni burocracia.
            </p>
          </div>

          {/* Alternating feature rows */}
          <div className="space-y-28">

            {/* 1 — icon left · text right */}
            <div className="fade-up grid md:grid-cols-2 gap-12 lg:gap-24 items-center">
              <div className="flex justify-center">
                <IconCircle emoji="🕐" color="blue" />
              </div>
              <FeatureText
                title="Cita médica en menos de 36 horas"
                text="Olvídate de esperar semanas para ver a un médico. Con Contigo tienes un médico general o especialista disponible en menos de 36 horas — desde tu celular."
                stat="vs. 36 días de espera promedio en el sistema actual"
                statType="warning"
              />
            </div>

            {/* 2 — text left · icon right */}
            <div className="fade-up grid md:grid-cols-2 gap-12 lg:gap-24 items-center">
              <FeatureText
                title="Tus medicamentos llegan a tu puerta"
                text="Después de tu consulta, tu médico receta digitalmente y tus medicamentos son enviados directamente a tu casa. Sin filas en dispensarios, sin desplazamientos."
                stat="Cierra el ciclo completo de atención primaria"
                statType="success"
              />
              <div className="flex justify-center md:order-last">
                <IconCircle emoji="💊" color="green" />
              </div>
            </div>

            {/* 3 — icon left · text right */}
            <div className="fade-up grid md:grid-cols-2 gap-12 lg:gap-24 items-center">
              <div className="flex justify-center">
                <IconCircle emoji="📋" color="blue" />
              </div>
              <FeatureText
                title="Tu historia médica, siempre contigo"
                text="Cada consulta, diagnóstico y medicamento recetado queda guardado en tu perfil digital. Accede a tu historial completo en cualquier momento, desde cualquier lugar."
                stat="100% digital — cero papeles, cero carpetas perdidas"
                statType="success"
              />
            </div>

            {/* 4 — text left · icon right */}
            <div className="fade-up grid md:grid-cols-2 gap-12 lg:gap-24 items-center">
              <FeatureText
                title="Telemedicina cuando no necesitas salir"
                text="La mayoría de consultas de atención primaria no requieren presencia física. Ahorra tiempo y dinero consultando desde casa cuando tu situación lo permite."
                stat="La mayoría de consultas de atención primaria pueden resolverse por telemedicina"
                statType="info"
              />
              <div className="flex justify-center md:order-last">
                <IconCircle emoji="📱" color="green" />
              </div>
            </div>
          </div>

          {/* Price CTA card */}
          <div className="mt-28 fade-up flex justify-center">
            <div className="w-full max-w-md text-center p-10 rounded-3xl border border-slate-100 shadow-xl bg-white">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Todo esto por solo</p>
              <p className="text-7xl font-extrabold text-blue-600 leading-none mb-1">$80.000</p>
              <p className="text-xl font-semibold text-slate-600 mb-2">COP / mes</p>
              <p className="text-sm text-slate-400 mb-8">Menos de lo que ya gastas en soluciones informales</p>
              <Link to="/registro"
                className="inline-flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all duration-200 shadow-lg shadow-blue-100 text-sm hover:scale-[1.03]">
                Comenzar ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ CÓMO FUNCIONA ═══════════════════════════ */}
      <section id="como-funciona" className="py-28" style={{ backgroundColor: '#f8fafc' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">

          <div className="text-center max-w-xl mx-auto mb-20 fade-up">
            <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3">Cómo Funciona</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              Un pago simple. Todo incluido.
            </h2>
            <p className="text-lg text-slate-500">
              En menos de 5 minutos estás listo para acceder a toda la atención que necesitas.
            </p>
          </div>

          {/* Steps grid */}
          <div className="relative grid md:grid-cols-3 gap-10 mb-16">
            {/* Gradient connector */}
            <div
              className="hidden md:block absolute h-px top-10 z-0"
              style={{
                left:       'calc(16.67% + 2.75rem)',
                right:      'calc(16.67% + 2.75rem)',
                background: 'linear-gradient(to right, #bfdbfe, #bbf7d0)',
              }}
              aria-hidden="true"
            />

            {[
              { n: '1', emoji: '👤', title: 'Crea tu cuenta',           desc: 'Regístrate con tu email en menos de 2 minutos. Sin papeles, sin trámites, sin EPS.',                                                                               color: 'bg-blue-600',  ring: 'shadow-blue-200' },
              { n: '2', emoji: '📅', title: 'Agenda tu cita',           desc: 'Elige la especialidad, selecciona un horario disponible y cuéntale a tu médico el motivo de tu consulta.',                                                          color: 'bg-green-600', ring: 'shadow-green-200' },
              { n: '3', emoji: '🏠', title: 'Recibe atención completa', desc: 'Tu médico te atiende, escribe sus conclusiones y receta tus medicamentos. Todo llega a tu historial y a tu puerta.',                                                color: 'bg-blue-600',  ring: 'shadow-blue-200' },
            ].map((step, i) => (
              <div key={step.n} className="fade-up relative z-10 text-center px-2" style={{ transitionDelay: `${i * 110}ms` }}>
                <div className={`relative w-20 h-20 ${step.color} rounded-full flex flex-col items-center justify-center mx-auto mb-6 shadow-xl ${step.ring}`}>
                  <span className="text-white text-[10px] font-extrabold opacity-70 leading-none mb-0.5">{step.n}</span>
                  <span className="text-2xl leading-none">{step.emoji}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Gradient pricing card */}
          <div
            className="fade-up rounded-3xl p-10 sm:p-14 text-center text-white"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a5276 55%, #16a34a 100%)' }}
          >
            <p className="text-3xl sm:text-4xl font-extrabold text-white mb-2">$80.000 COP al mes</p>
            <p className="text-white/60 text-base mb-8">
              Sin contratos de largo plazo · Cancela cuando quieras
            </p>
            <Link to="/registro"
              className="inline-flex items-center px-8 py-4 bg-white text-[#1e3a5f] font-bold rounded-2xl hover:scale-[1.03] transition-all duration-200 shadow-lg text-sm">
              Comenzar ahora
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ PARA MÉDICOS ════════════════════════════ */}
      <section id="para-medicos" className="bg-white py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          <div className="text-center max-w-2xl mx-auto mb-16 fade-up">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Para Médicos</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
              La plataforma que pone tu práctica en tus manos
            </h2>
            <p className="text-lg text-slate-500">
              Enfócate en tus pacientes. Nosotros manejamos el resto.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">

            {/* Card 1 */}
            <div className="fade-up rounded-2xl border border-slate-100 p-8 hover:shadow-xl transition-all duration-300 overflow-hidden relative"
              style={{ borderTop: '4px solid #2563eb' }}>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-5">
                <span className="text-2xl">📅</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Agenda predecible</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Define tus horarios disponibles y recibe pacientes que ya están pagando.
                Sin esperar referencias del sistema que nunca llegan. Sin horas muertas.
              </p>
            </div>

            {/* Card 2 — highlighted */}
            <div className="fade-up rounded-2xl border border-green-200 p-8 hover:shadow-xl transition-all duration-300 relative bg-green-50/40"
              style={{ borderTop: '4px solid #16a34a' }}>
              <span className="absolute top-5 right-5 bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                Sin contratos OPS
              </span>
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-5">
                <span className="text-2xl">💰</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Pago garantizado y puntual</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Olvídate de contratos OPS y esperas de 3 meses para cobrar.
                Con Contigo recibes tu pago por cada consulta completada — sin burocracia, sin demoras.
              </p>
            </div>

            {/* Card 3 */}
            <div className="fade-up rounded-2xl border border-slate-100 p-8 hover:shadow-xl transition-all duration-300"
              style={{ borderTop: '4px solid #2563eb' }}>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-5">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Menos admin, más medicina</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Consultas digitales, recetas electrónicas y notas clínicas en la app.
                Dedica tu tiempo a tus pacientes, no a papeleo ni autorizaciones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════ NOSOTROS ════════════════════════════════ */}
      <section
        id="nosotros"
        className="py-32 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e3a5f 45%, #1a4731 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-green-400/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-blue-400/5 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-white/45 mb-6 fade-up">
            Nuestra Misión
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-10 fade-up">
            Obsesionados con cambiar<br />
            la salud en Colombia.
          </h2>

          <div className="max-w-2xl mx-auto space-y-6 mb-14 fade-up">
            <p className="text-lg text-white/78 leading-relaxed">
              El sistema de salud colombiano dejó de funcionar para las personas que más lo necesitan.
              52 millones de colombianos están nominalmente asegurados — pero efectivamente desatendidos.
            </p>
            <p className="text-lg text-white/78 leading-relaxed">
              Contigo nació para cerrar esa brecha. Creemos que acceder a un médico de calidad no
              debería requerir madrugar a las 2am a hacer fila, pagar sobornos informales, ni litigar
              contra tu propia aseguradora.
            </p>
          </div>

          <p className="text-2xl sm:text-3xl font-bold italic mb-14 fade-up" style={{ color: '#86efac' }}>
            "Tu salud merece mejor que el sistema que tienes hoy."
          </p>

          <div className="fade-up">
            <Link to="/registro"
              className="inline-flex items-center px-9 py-4 bg-white text-[#1e3a5f] font-bold rounded-2xl hover:scale-[1.03] transition-all duration-200 shadow-2xl text-sm">
              Únete a Contigo
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════ FOOTER ══════════════════════════════ */}
      <footer style={{ backgroundColor: '#0f172a' }} className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
            <div className="text-center sm:text-left">
              <p className="font-extrabold text-2xl mb-1.5">
                <span style={{ color: '#4ade80' }}>con</span><span className="text-white">tigo</span>
              </p>
              <p className="text-white/40 text-sm">Recupera el control de tu salud.</p>
            </div>

            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2">
              {NAV_LINKS.map((link) => (
                <button key={link.id} onClick={() => goTo(link.id)}
                  className="text-white/40 hover:text-white/80 text-sm transition-colors">
                  {link.label}
                </button>
              ))}
              <Link to="/login" className="text-white/40 hover:text-white/80 text-sm transition-colors">
                Iniciar sesión
              </Link>
            </nav>
          </div>

          <div className="mt-10 pt-6 border-t border-white/8 text-center">
            <p className="text-white/25 text-sm">
              © 2026 Contigo. Todos los derechos reservados. Colombia 🇨🇴
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroCard() {
  return (
    <div className="relative py-10 px-6">
      {/* Main appointment card */}
      <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-6 w-80">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Próxima cita</p>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-bold">CM</span>
          </div>
          <div>
            <p className="font-bold text-slate-900">Dr. Carlos Méndez</p>
            <p className="text-xs text-slate-500">Medicina General</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {[
            { label: 'Fecha',    value: 'Hoy, 3:30 PM' },
            { label: 'Duración', value: '30 minutos' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-xs text-slate-400">{row.label}</span>
              <span className="text-xs font-semibold text-slate-700">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-xl border border-green-100">
          <span className="text-sm font-semibold text-green-700">Confirmada</span>
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      {/* Floating medicine card */}
      <div className="absolute -bottom-2 -left-4 z-20 bg-white rounded-2xl shadow-xl p-4 w-52">
        <div className="flex items-center gap-2.5">
          <span className="text-xl shrink-0">💊</span>
          <div>
            <p className="text-xs font-bold text-slate-800">Medicamentos en camino</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-xs text-green-600 font-semibold">En camino</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconCircle({ emoji, color }: { emoji: string; color: 'blue' | 'green' }) {
  const bg = color === 'blue' ? 'bg-blue-100' : 'bg-green-100'
  return (
    <div className={`w-40 h-40 sm:w-48 sm:h-48 ${bg} rounded-full flex items-center justify-center shadow-2xl`}>
      <span className="text-6xl sm:text-7xl">{emoji}</span>
    </div>
  )
}

function FeatureText({
  title, text, stat, statType,
}: {
  title: string
  text: string
  stat: string
  statType: 'warning' | 'success' | 'info'
}) {
  const styles = {
    warning: 'border-l-4 border-red-400    bg-red-50   text-red-700',
    success: 'border-l-4 border-green-500  bg-green-50 text-green-700',
    info:    'border-l-4 border-blue-400   bg-blue-50  text-blue-700',
  }[statType]

  return (
    <div>
      <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-4">{title}</h3>
      <p className="text-lg text-slate-500 leading-relaxed mb-6">{text}</p>
      <div className={`pl-4 py-2.5 pr-4 rounded-r-xl text-sm font-medium leading-snug ${styles}`}>
        {stat}
      </div>
    </div>
  )
}
