export const PiiType = {
  PersonName: 'PERSON_NAME',
  Email: 'EMAIL',
  Phone: 'PHONE',
} as const;

export type PiiType = (typeof PiiType)[keyof typeof PiiType];

const PII_TYPE_PRIORITY: Record<PiiType, number> = {
  [PiiType.Email]: 3,
  [PiiType.Phone]: 2,
  [PiiType.PersonName]: 1,
};

export function isPiiType(value: string): value is PiiType {
  return Object.values(PiiType).includes(value as PiiType);
}

export function piiTypePriority(type: PiiType): number {
  return PII_TYPE_PRIORITY[type];
}
