import { supabase } from '../lib/supabase'

async function callProxy(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('daily-proxy', { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export async function createDailyRoom(appointmentId: string): Promise<{ name: string; url: string }> {
  const data = await callProxy({ action: 'create-room', appointmentId }) as { name: string; url: string }
  return { name: data.name, url: data.url }
}

export async function createDailyToken(roomName: string, isDoctor: boolean): Promise<string> {
  const data = await callProxy({ action: 'create-token', roomName, isDoctor }) as { token: string }
  return data.token
}
