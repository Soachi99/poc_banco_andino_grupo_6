export interface LanguageModelCompletion {
  instructions: string;
  input: string;
}

/**
 * Puerto del modelo de lenguaje.
 * El caso de uso depende de este contrato, no del SDK de un proveedor.
 */
export interface LanguageModelProvider {
  complete(request: LanguageModelCompletion): Promise<string>;
}
