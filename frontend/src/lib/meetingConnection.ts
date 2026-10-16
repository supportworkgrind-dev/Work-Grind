export function shouldInitiateMeetingOffer(localSocketId: string, remoteSocketId: string): boolean {
  return localSocketId.length > 0 && remoteSocketId.length > 0 && localSocketId < remoteSocketId;
}
