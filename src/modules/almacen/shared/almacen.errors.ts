export class AlmacenError extends Error {
  constructor(message: string, public statusCode: number = 400, public code?: string) {
    super(message);
    this.name = 'AlmacenError';
  }
}
