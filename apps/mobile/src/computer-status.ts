import { tr } from "./i18n/translate";

/** The agent computer's status, shown in the header and read out by its button label. */
export function computerStatus(available: boolean, activeSessions: number) {
  return !available
    ? tr("computer.statusOffline")
    : activeSessions > 0
      ? tr("computer.statusTakeControl")
      : tr("computer.statusReady");
}
