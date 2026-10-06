import { api } from './api';
import { getAuthValue } from './authSession';

export interface WorkGrindRtcConfiguration extends RTCConfiguration {
  turnConfigured: boolean;
  credentialExpiresIn?: number;
}

interface CachedRtcConfiguration {
  accessToken: string;
  configuration: WorkGrindRtcConfiguration;
  expiresAt: number;
}

const ICE_CREDENTIAL_REFRESH_SKEW_MS = 5 * 60 * 1000;
let cachedRtcConfiguration: CachedRtcConfiguration | null = null;
let pendingRtcConfiguration: { accessToken: string; request: Promise<WorkGrindRtcConfiguration> } | null = null;

const cloneRtcConfiguration = (configuration: WorkGrindRtcConfiguration): WorkGrindRtcConfiguration => ({
  ...configuration,
  iceServers: configuration.iceServers?.map((server) => ({
    ...server,
    urls: Array.isArray(server.urls) ? [...server.urls] : server.urls,
  })),
});

interface IceCandidateReport {
  type: string;
  candidateType?: string;
  protocol?: string;
  state?: string;
  nominated?: boolean;
  selected?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
}

export async function logRtcIceDiagnostics(peer: RTCPeerConnection, label: string): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    const stats = await peer.getStats();
    const reports = new Map<string, IceCandidateReport>();
    stats.forEach((report) => reports.set(report.id, report as IceCandidateReport));
    const selectedPair = Array.from(reports.values()).find((report) =>
      report.type === 'candidate-pair' &&
      (report.selected || (report.nominated && report.state === 'succeeded')),
    );
    const localCandidate = selectedPair?.localCandidateId
      ? reports.get(selectedPair.localCandidateId)
      : undefined;
    const remoteCandidate = selectedPair?.remoteCandidateId
      ? reports.get(selectedPair.remoteCandidateId)
      : undefined;
    const gatheredCandidateTypes = Array.from(reports.values())
      .filter((report) => report.type === 'local-candidate')
      .map((report) => report.candidateType)
      .filter((candidateType): candidateType is string => Boolean(candidateType));

    console.info(`[${label}] ICE diagnostics`, {
      gatheringState: peer.iceGatheringState,
      iceConnectionState: peer.iceConnectionState,
      connectionState: peer.connectionState,
      gatheredCandidateTypes: Array.from(new Set(gatheredCandidateTypes)),
      selectedLocalCandidateType: localCandidate?.candidateType ?? null,
      selectedRemoteCandidateType: remoteCandidate?.candidateType ?? null,
      selectedProtocol: localCandidate?.protocol ?? null,
      relaySelected: localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay',
    });
  } catch (error) {
    console.warn(`[${label}] Could not read ICE connection statistics:`, error);
  }
}

export async function getRtcConfiguration(): Promise<WorkGrindRtcConfiguration> {
  const accessToken = getAuthValue('workgrind_access_token');
  if (!accessToken) {
    throw new Error('An authenticated session is required to load WebRTC ICE configuration.');
  }

  const now = Date.now();
  if (
    cachedRtcConfiguration?.accessToken === accessToken &&
    now < cachedRtcConfiguration.expiresAt - ICE_CREDENTIAL_REFRESH_SKEW_MS
  ) {
    return cloneRtcConfiguration(cachedRtcConfiguration.configuration);
  }

  if (pendingRtcConfiguration?.accessToken === accessToken) {
    return pendingRtcConfiguration.request.then(cloneRtcConfiguration);
  }

  const request = api.get('/rtc/ice-servers').then((response) => {
    const iceServers = response.data?.iceServers as RTCIceServer[] | undefined;
    if (!response.data?.success || !Array.isArray(iceServers) || iceServers.length === 0) {
      throw new Error('The server did not return a valid WebRTC ICE configuration.');
    }
    if (getAuthValue('workgrind_access_token') !== accessToken) {
      throw new Error('The authentication session changed while loading WebRTC ICE configuration.');
    }

    const configuration: WorkGrindRtcConfiguration = {
      iceServers,
      turnConfigured: response.data.turnConfigured === true,
      credentialExpiresIn: typeof response.data.credentialExpiresIn === 'number'
        ? response.data.credentialExpiresIn
        : undefined,
    };
    const credentialTtlMs = (configuration.credentialExpiresIn ?? 0) * 1000;
    if (credentialTtlMs > 0) {
      cachedRtcConfiguration = {
        accessToken,
        configuration,
        expiresAt: Date.now() + credentialTtlMs,
      };
    } else {
      cachedRtcConfiguration = null;
    }
    return configuration;
  }).finally(() => {
    if (pendingRtcConfiguration?.request === request) pendingRtcConfiguration = null;
  });

  pendingRtcConfiguration = { accessToken, request };
  return request.then(cloneRtcConfiguration);
}
