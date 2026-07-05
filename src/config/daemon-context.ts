let daemonMode = false;

export function setDaemonMode(enabled: boolean): void {
  daemonMode = enabled;
}

export function isDaemonMode(): boolean {
  return daemonMode;
}
