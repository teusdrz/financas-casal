/** Erro de aplicacao com status HTTP, tratado pelo middleware de erros. */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: string[]) {
    super(message);
    this.name = "HttpError";
  }
}
