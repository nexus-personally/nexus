export const ROOM_RECONNECT_DELAY_MS = 800

type WritableSocket = { readyState: number; send: (value: string) => void }

export function sendSocketMessage(socket: WritableSocket | null, message: Record<string, unknown>): boolean {
  if (!socket || socket.readyState !== 1) return false
  try {
    socket.send(JSON.stringify(message))
    return true
  } catch {
    return false
  }
}
