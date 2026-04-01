const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Convert YYYY-MM-DD + HH:MM(:SS) to ICS UTC datetime string (20260401T140000Z) */
function icsDatetime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}`)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Escape special characters for ICS property values */
function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export interface ICSAppointment {
  id: string
  reason: string | null
  patientName: string
  specialty: string
  slotDate: string
  slotStart: string
  slotEnd: string
}

export function generateICS(appointments: ICSAppointment[]): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

  const events = appointments.map((a) => {
    const dtStart = icsDatetime(a.slotDate, a.slotStart)
    const dtEnd   = icsDatetime(a.slotDate, a.slotEnd)
    const descRaw = `Paciente: ${a.patientName}\nEspecialidad: ${a.specialty}\nMotivo: ${a.reason ?? 'No especificado'}`
    return [
      'BEGIN:VEVENT',
      `UID:${a.id}@contigomedicina.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Consulta - ${esc(a.patientName)}`,
      `DESCRIPTION:${esc(descRaw)}`,
      'LOCATION:Videollamada - contigomedicina.com',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Contigo Medicina//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadICS(content: string, month: number, year: number): void {
  const filename = `agenda-contigo-${MONTHS_ES[month]}-${year}.ics`
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildGoogleCalendarUrl(opts: {
  patientName: string
  specialty: string
  reason: string | null
  slotDate: string
  slotStart: string
  slotEnd: string
}): string {
  const start   = icsDatetime(opts.slotDate, opts.slotStart)
  const end     = icsDatetime(opts.slotDate, opts.slotEnd)
  const text    = encodeURIComponent(`Consulta - ${opts.patientName}`)
  const details = encodeURIComponent(
    `Paciente: ${opts.patientName} | Especialidad: ${opts.specialty} | Motivo: ${opts.reason ?? 'No especificado'}`
  )
  const loc = encodeURIComponent('Videollamada - contigomedicina.com')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${loc}`
}
