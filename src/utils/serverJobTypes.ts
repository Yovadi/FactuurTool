/** Every scheduled job can run from the hourly server task. */
export const SERVER_SKIP_JOB_TYPES = new Set<string>();

export function runsOnServer(jobType: string): boolean {
  return !SERVER_SKIP_JOB_TYPES.has(jobType);
}
