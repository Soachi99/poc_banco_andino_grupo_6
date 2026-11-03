import { Schema } from 'mongoose';

import { PiiType } from '../../../domain/value-objects/PiiType.js';

/**
 * Pareja dato-token del PoC.
 * originalValue es el texto recuperable. normalizedValue solo sirve para reutilizar el token.
 * No hay tenant: el token y el dato son únicos en todo el vault.
 */
export interface TokenMappingRecord {
  token: string;
  piiType: string;
  originalValue: string;
  normalizedValue: string;
  createdAt: Date;
}

export const tokenMappingSchema = new Schema<TokenMappingRecord>(
  {
    token: { type: String, required: true },
    piiType: { type: String, required: true, enum: Object.values(PiiType) },
    originalValue: { type: String, required: true },
    normalizedValue: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  {
    collection: 'token_mappings',
    versionKey: false,
  },
);

tokenMappingSchema.index({ token: 1 }, { unique: true });
tokenMappingSchema.index({ piiType: 1, normalizedValue: 1 }, { unique: true });
tokenMappingSchema.index({ createdAt: 1 });
