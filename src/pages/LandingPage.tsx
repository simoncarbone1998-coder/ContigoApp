import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../components/LanguageToggle'

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

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled,   setScrolled]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeTab,  setActiveTab]  = useState<'patient' | 'doctor'>('patient')
  const { t } = useTranslation()

  const NAV_LINKS = [
    { label: t('landing.navBenefits'), id: 'para-pacientes' },
    { label: t('landing.navAbout'),   id: 'nosotros' },
  ]

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
      <header
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}
        className={`transition-all duration-300 ${
          scrolled
            ? 'bg-white/96 backdrop-blur-md shadow-sm border-b border-slate-100'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4" style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>

          {/* Logo */}
          <Link to="/" className="relative flex items-center h-10 shrink-0" style={{ height: '40px' }}>
            <img
              src="/logo.png" alt="Contigo"
              style={{ height: '40px', width: 'auto', maxHeight: '40px' }}
              className={`absolute transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
            <LanguageToggle />
            <Link to="/login"
              className={`hidden md:inline-flex items-center px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                scrolled
                  ? 'border-blue-600 text-blue-600 hover:bg-blue-50'
                  : 'border-white/50 text-white hover:bg-white/10 hover:border-white/80'
              }`}>
              {t('landing.signIn')}
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${
                scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'
              }`}
              aria-label={mobileOpen ? t('landing.closeMenu') : t('landing.openMenu')}
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
                  {t('landing.signIn')}
                </Link>
                <Link to="/aplicar"
                  className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold text-center transition-colors">
                  {t('landing.startNow')}
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
                {t('landing.heroBadge')}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold text-white leading-[1.08] tracking-tight mb-6">
                {t('landing.heroTitle1')}<br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(to right, #86efac, #5eead4)' }}
                >
                  {t('landing.heroTitle2')}
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-white/78 leading-relaxed mb-10 max-w-xl"
                dangerouslySetInnerHTML={{ __html: t('landing.heroSubtitle') }}
              />
              <div className="flex flex-wrap gap-4">
                <Link to="/aplicar"
                  className="px-7 py-3.5 bg-white text-[#1e3a5f] font-bold rounded-2xl hover:scale-[1.03] hover:bg-blue-50 transition-all duration-200 shadow-xl shadow-black/25 text-sm">
                  {t('landing.startNow')}
                </Link>
                <button onClick={() => goTo('para-pacientes')}
                  className="px-7 py-3.5 border-2 border-white/40 text-white font-semibold rounded-2xl hover:bg-white/10 hover:border-white/70 transition-all duration-200 text-sm">
                  {t('landing.learnMore')}
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

      {/* ══════════════════════════ BENEFICIOS + CHAT ══════════════════════ */}
      <section id="para-pacientes" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-[3fr_2fr] gap-12 items-start">

            {/* LEFT — benefits content */}
            <div>
              {/* Header */}
              <div className="mb-10 fade-up">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">{t('landing.benefitsTitle')}</p>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-8">
                  {t('landing.benefitsHeading')}
                </h2>

                {/* Toggle pill */}
                <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setActiveTab('patient')}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                    style={activeTab === 'patient'
                      ? { background: '#1e3a5f', color: '#fff' }
                      : { background: 'transparent', color: '#64748b' }}
                  >
                    {t('landing.iAmPatient')}
                  </button>
                  <button
                    onClick={() => setActiveTab('doctor')}
                    className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                    style={activeTab === 'doctor'
                      ? { background: '#16a34a', color: '#fff' }
                      : { background: 'transparent', color: '#64748b' }}
                  >
                    {t('landing.iAmDoctor')}
                  </button>
                </div>
              </div>

              {/* ── Patient panel ── */}
              {activeTab === 'patient' && (
                <div key="patient" style={{ animation: 'modal-in 0.2s ease-out' }}>
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {[
                      { emoji: '🕐', titleKey: 'landing.benefitAppointment', descKey: 'landing.benefitAppointmentDesc' },
                      { emoji: '💊', titleKey: 'landing.benefitMeds',        descKey: 'landing.benefitMedsDesc' },
                      { emoji: '📋', titleKey: 'landing.benefitHistory',     descKey: 'landing.benefitHistoryDesc' },
                      { emoji: '📱', titleKey: 'landing.benefitTele',        descKey: 'landing.benefitTeleDesc' },
                    ].map((card) => (
                      <div
                        key={card.titleKey}
                        className="flex items-start gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow duration-200"
                      >
                        <span className="text-2xl shrink-0 mt-0.5">{card.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{t(card.titleKey)}</p>
                          <p className="text-[13px] text-slate-500 mt-0.5">{t(card.descKey)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price card */}
                  <div className="rounded-2xl p-8 text-center" style={{ background: '#f0f7ff' }}>
                    <p className="text-3xl font-extrabold text-blue-700 mb-1">{t('landing.priceTag')}</p>
                    <p className="text-sm text-slate-500 mb-6">{t('landing.priceDesc')}</p>
                    <Link to="/aplicar"
                      className="inline-flex items-center px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-blue-100">
                      {t('landing.startNow')}
                    </Link>
                  </div>
                </div>
              )}

              {/* ── Doctor panel ── */}
              {activeTab === 'doctor' && (
                <div key="doctor" style={{ animation: 'modal-in 0.2s ease-out' }}>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { emoji: '📅', titleKey: 'landing.doctorBenefitSchedule', descKey: 'landing.doctorBenefitScheduleDesc' },
                      { emoji: '💰', titleKey: 'landing.doctorBenefitPayment',  descKey: 'landing.doctorBenefitPaymentDesc' },
                      { emoji: '⚡', titleKey: 'landing.doctorBenefitAdmin',    descKey: 'landing.doctorBenefitAdminDesc' },
                    ].map((card) => (
                      <div
                        key={card.titleKey}
                        className="flex items-start gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow duration-200"
                      >
                        <span className="text-2xl shrink-0 mt-0.5">{card.emoji}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{t(card.titleKey)}</p>
                          <p className="text-[13px] text-slate-500 mt-0.5">{t(card.descKey)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT — chat widget */}
            <div className="fade-up lg:sticky lg:top-24">
              <p className="text-2xl font-extrabold text-slate-900 mb-2">{t('landing.chatTitle')}</p>
              <p className="text-sm text-slate-500 mb-5">{t('landing.chatSubtitle')}</p>
              <ChatWidget />
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
            {t('landing.missionBadge')}
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-10 fade-up">
            {t('landing.missionHeading1')}<br />
            {t('landing.missionHeading2')}
          </h2>

          <div className="max-w-2xl mx-auto space-y-6 mb-14 fade-up">
            <p className="text-lg text-white/78 leading-relaxed">
              {t('landing.missionP1')}
            </p>
            <p className="text-lg text-white/78 leading-relaxed">
              {t('landing.missionP2')}
            </p>
          </div>

          <p className="text-2xl sm:text-3xl font-bold italic mb-14 fade-up" style={{ color: '#86efac' }}>
            {t('landing.missionQuote')}
          </p>

          <div className="fade-up">
            <Link to="/aplicar"
              className="inline-flex items-center px-9 py-4 bg-white text-[#1e3a5f] font-bold rounded-2xl hover:scale-[1.03] transition-all duration-200 shadow-2xl text-sm">
              {t('landing.joinContigo')}
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
              <p className="text-white/40 text-sm">{t('landing.footerTagline')}</p>
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
              {t('landing.footerCopyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── ChatWidget ────────────────────────────────────────────────────────────────

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string; ts: Date }

const CHAT_LIMIT = 5

function ChatWidget() {
  const { t, i18n } = useTranslation()

  const initCount = (): number => {
    try { return Math.min(parseInt(sessionStorage.getItem('contigo_chat_count') ?? '0') || 0, CHAT_LIMIT) }
    catch { return 0 }
  }

  const [msgs, setMsgs] = useState<ChatMsg[]>([{
    id: 'welcome',
    role: 'assistant',
    content: t('landing.chat.welcome'),
    ts: new Date(),
  }])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [msgCount,    setMsgCount]    = useState(initCount)
  const [limitReached, setLimitReached] = useState(() => initCount() >= CHAT_LIMIT)

  // Lead form
  const [leadName,     setLeadName]     = useState('')
  const [leadEmail,    setLeadEmail]    = useState('')
  const [leadPhone,    setLeadPhone]    = useState('')
  const [leadSending,  setLeadSending]  = useState(false)
  const [leadDone,     setLeadDone]     = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Update welcome message when language changes
  useEffect(() => {
    setMsgs(prev => prev.map(m => m.id === 'welcome' ? { ...m, content: t('landing.chat.welcome') } : m))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading || limitReached) return

    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text, ts: new Date() }
    setMsgs(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const prevHistory = [...historyRef.current]

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { message: text, conversation_history: prevHistory.slice(-10) },
      })

      if (error || !data?.reply) throw new Error(error?.message ?? 'No response')

      const aiMsg: ChatMsg = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply, ts: new Date() }
      setMsgs(prev => [...prev, aiMsg])
      historyRef.current = [...prevHistory, { role: 'user', content: text }, { role: 'assistant', content: data.reply }]

    } catch {
      const errMsg: ChatMsg = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: t('landing.chat.error'), ts: new Date(),
      }
      setMsgs(prev => [...prev, errMsg])
      historyRef.current = [...prevHistory, { role: 'user', content: text }]
    } finally {
      setLoading(false)
      const newCount = msgCount + 1
      setMsgCount(newCount)
      try { sessionStorage.setItem('contigo_chat_count', String(newCount)) } catch { /* noop */ }
      if (newCount >= CHAT_LIMIT) setLimitReached(true)
    }
  }

  async function submitLead() {
    if (!leadName.trim() || !leadEmail.trim()) return
    setLeadSending(true)

    try {
      const conversation = historyRef.current.slice(-10)
      await supabase.from('chat_leads').insert({
        name: leadName.trim(), email: leadEmail.trim(),
        phone: leadPhone.trim() || null, conversation,
      })

      const summary = conversation.slice(-5)
        .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
        .join('\n')

      await supabase.functions.invoke('send-email', {
        body: {
          to: 'hola@contigomedicina.com',
          subject: '💬 Nuevo lead del chat — Contigo',
          html: `<h2>Nuevo lead del chat</h2>
<p><strong>Nombre:</strong> ${leadName.trim()}</p>
<p><strong>Email:</strong> ${leadEmail.trim()}</p>
<p><strong>Teléfono:</strong> ${leadPhone.trim() || '—'}</p>
<h3>Últimos mensajes:</h3>
<pre style="background:#f8f8f8;padding:12px;border-radius:8px;font-size:13px">${summary}</pre>`,
        },
      })
    } catch { /* non-critical */ }

    setLeadSending(false)
    setLeadDone(true)
  }

  const remaining = CHAT_LIMIT - msgCount

  return (
    <div className="flex flex-col rounded-2xl shadow-lg overflow-hidden bg-white border border-slate-200"
      style={{ height: '500px' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, #1e3a5f, #16a34a)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">{t('landing.chat.title')}</p>
          <p className="text-white/65 text-xs">{t('landing.chat.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/50 text-xs">{t('landing.chat.online')}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: '#f8fafc' }}>
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-white text-slate-800 shadow-sm rounded-bl-sm'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              <p className={`text-[10px] mt-1 ${m.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                {m.ts.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">{t('landing.chat.typing')}</span>
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area or limit/lead form */}
      {limitReached ? (
        <div className="p-4 border-t border-slate-100 shrink-0">
          {leadDone ? (
            <p className="text-center text-sm font-semibold text-emerald-600 py-2">✅ {t('landing.chat.thanks')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">{t('landing.chat.limitTitle')}</p>
              <p className="text-xs text-slate-500">{t('landing.chat.limitSub')}</p>
              <input value={leadName} onChange={(e) => setLeadName(e.target.value)}
                placeholder={t('landing.chat.namePh')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)}
                placeholder={t('landing.chat.emailPh')} type="email"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)}
                placeholder={t('landing.chat.phonePh')}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button onClick={submitLead}
                disabled={!leadName.trim() || !leadEmail.trim() || leadSending}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {leadSending ? t('landing.chat.submitting') : t('landing.chat.submit')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 border-t border-slate-100 bg-white shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={t('landing.chat.placeholder')}
              disabled={loading}
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {msgCount > 0 && (
            <p className={`text-[11px] mt-1.5 text-center ${remaining <= 2 ? 'text-amber-500 font-semibold' : 'text-slate-400'}`}>
              {t('landing.chat.remaining', { count: remaining })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function HeroCard() {
  const { t } = useTranslation()
  return (
    <div className="relative py-10 px-6">
      {/* Main appointment card */}
      <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-6 w-80">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">{t('landing.heroCardNextAppointment')}</p>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-bold">CM</span>
          </div>
          <div>
            <p className="font-bold text-slate-900">Dr. Carlos Méndez</p>
            <p className="text-xs text-slate-500">{t('landing.heroCardGeneralMedicine')}</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {[
            { labelKey: 'landing.heroCardDateLabel',     valueKey: 'landing.heroCardDateValue' },
            { labelKey: 'landing.heroCardDurationLabel', valueKey: 'landing.heroCardDurationValue' },
          ].map((row) => (
            <div key={row.labelKey} className="flex justify-between">
              <span className="text-xs text-slate-400">{t(row.labelKey)}</span>
              <span className="text-xs font-semibold text-slate-700">{t(row.valueKey)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-xl border border-green-100">
          <span className="text-sm font-semibold text-green-700">{t('landing.heroCardConfirmed')}</span>
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
            <p className="text-xs font-bold text-slate-800">{t('landing.heroCardMedsLabel')}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-xs text-green-600 font-semibold">{t('landing.heroCardMedsStatus')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

