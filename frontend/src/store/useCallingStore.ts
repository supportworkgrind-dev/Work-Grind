import { create } from 'zustand';

export type CallingPeer = { callingId: string; displayName: string; avatar: string | null };
export type IncomingCall = { sessionId: string; caller: CallingPeer; expiresAt: string };
export type ActiveCall = {
  sessionId: string;
  sessionToken: string;
  direction: 'incoming' | 'outgoing';
  peer: CallingPeer;
  status: 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'ended' | 'missed';
};

type CallingState = {
  incomingCall: IncomingCall | null;
  activeCall: ActiveCall | null;
  terminatedCallIds: Set<string>;
  setIncomingCall: (incomingCall: IncomingCall | null) => void;
  setActiveCall: (activeCall: ActiveCall | null) => void;
  updateActiveCall: (sessionId: string, status: ActiveCall['status']) => void;
  clearCall: (sessionId: string) => void;
};

export const useCallingStore = create<CallingState>((set) => ({
  incomingCall: null,
  activeCall: null,
  terminatedCallIds: new Set(),
  setIncomingCall: (incomingCall) => set((state) => (
    incomingCall && state.terminatedCallIds.has(incomingCall.sessionId) ? {} : { incomingCall }
  )),
  setActiveCall: (activeCall) => set((state) => (
    activeCall && state.terminatedCallIds.has(activeCall.sessionId) ? {} : { activeCall }
  )),
  updateActiveCall: (sessionId, status) => set((state) => state.activeCall?.sessionId === sessionId
    ? { activeCall: { ...state.activeCall, status } }
    : state),
  clearCall: (sessionId) => set((state) => {
    const terminatedCallIds = new Set(state.terminatedCallIds);
    terminatedCallIds.add(sessionId);
    if (terminatedCallIds.size > 100) {
      const oldestSessionId = terminatedCallIds.values().next().value;
      if (oldestSessionId) terminatedCallIds.delete(oldestSessionId);
    }
    return {
      activeCall: state.activeCall?.sessionId === sessionId ? null : state.activeCall,
      incomingCall: state.incomingCall?.sessionId === sessionId ? null : state.incomingCall,
      terminatedCallIds,
    };
  }),
}));
