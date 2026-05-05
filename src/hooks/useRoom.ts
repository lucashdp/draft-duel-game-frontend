'use client'

// Stub — implemented in the room feature plan.
// Returns the full room state and event handlers for the room page.
export function useRoom(_roomId: string) {
  return {
    room: null,
    isLoading: true,
    myRole: null as 'host' | 'guest' | null,
    pick: (_athleteId: string) => {},
    substitute: (_removeAthleteId: string, _addAthleteId: string) => {},
    abandon: () => {},
  }
}
