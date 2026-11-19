/** Jobs that need the open Windows app: a PDF on disk, or the e-Boekhouden session. */
export const SERVER_SKIP_JOB_TYPES = new Set([
  'eboekhouden_payment_status_check',
  'eboekhouden_sync_verification',
  'eboekhouden_relation_verification',
]);

export function runsOnServer(jobType: string): boolean {
  return !SERVER_SKIP_JOB_TYPES.has(jobType);
}
