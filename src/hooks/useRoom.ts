'use client'

// Stub — implemented in the room feature plan.
// Returns the full room state and event handlers for the room page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useRoom(_roomId: string) {
  return {
    room: null,
    isLoading: true,
    myRole: null as 'host' | 'guest' | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pick: (_athleteId: string) => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    substitute: (_removeAthleteId: string, _addAthleteId: string) => {},
    abandon: () => {},
  }
}
