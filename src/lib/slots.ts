function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Round a time string up to the next :00 or :30 boundary. */
export function roundUpToSlot(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const totalMins = h * 60 + m
  const rounded = Math.ceil(totalMins / 30) * 30
  return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}:00`
}

/** Round a time string down to the previous :00 or :30 boundary. */
export function roundDownToSlot(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const totalMins = h * 60 + m
  const rounded = Math.floor(totalMins / 30) * 30
  return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}:00`
}

/**
 * Generate 30-minute slots for a given date between start and end times.
 * Start is rounded UP to the next :00/:30 boundary.
 * End is rounded DOWN to the previous :00/:30 boundary.
 * Returns an empty array if the range doesn't fit at least one 30-min slot.
 */
export function generateSlots(date: string, start: string, end: string) {
  const roundedStart = roundUpToSlot(start)
  const roundedEnd   = roundDownToSlot(end)
  const [sh, sm] = roundedStart.split(':').map(Number)
  const [eh, em] = roundedEnd.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins   = eh * 60 + em
  const slots: { date: string; start_time: string; end_time: string }[] = []
  for (let t = startMins; t + 30 <= endMins; t += 30) {
    slots.push({
      date,
      start_time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}:00`,
      end_time:   `${pad(Math.floor((t + 30) / 60))}:${pad((t + 30) % 60)}:00`,
    })
  }
  return slots
}
