export type AssignmentType = 'eigen' | 'huurder' | 'spreekkamer';

export function asAssignmentType(value?: string | null): AssignmentType {
  if (value === 'huurder' || value === 'spreekkamer') return value;
  return 'eigen';
}
