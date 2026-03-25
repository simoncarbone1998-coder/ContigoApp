const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') ?? ''
const DAILY_BASE    = 'https://api.daily.co/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, appointmentId, roomName, isDoctor } = await req.json()

    if (action === 'create-room') {
      if (!appointmentId) return json({ error: 'appointmentId requerido' }, 400)

      const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60
      const res = await fetch(`${DAILY_BASE}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: `consulta-${appointmentId}`,
          privacy: 'private',
          properties: {
            enable_transcription: true,
            enable_recording: 'cloud',
            exp,
            max_participants: 2,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) return json({ error: data?.error ?? 'Error al crear sala' }, res.status)
      return json({ name: data.name, url: data.url })
    }

    if (action === 'create-token') {
      if (!roomName) return json({ error: 'roomName requerido' }, 400)

      const res = await fetch(`${DAILY_BASE}/meeting-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            is_owner: isDoctor === true,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) return json({ error: data?.error ?? 'Error al crear token' }, res.status)
      return json({ token: data.token })
    }

    return json({ error: 'Acción no válida' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
