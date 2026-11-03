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

/** Prefijo público del seudónimo. El secreto aleatorio sigue sin derivarse del dato. */
export const PII_TOKEN_PREFIX: Record<PiiType, string> = {
  [PiiType.PersonName]: 'NAME',
  [PiiType.Email]: 'EMAIL',
  [PiiType.Phone]: 'PHONE',
};

export function formatPublicToken(piiType: PiiType, secret: string): string {
  return `${PII_TOKEN_PREFIX[piiType]}_${secret}`;
}

export function piiTypeForPrefix(prefix: string): PiiType | null {
  const match = (Object.keys(PII_TOKEN_PREFIX) as PiiType[]).find((type) => PII_TOKEN_PREFIX[type] === prefix);
  return match ?? null;
}
