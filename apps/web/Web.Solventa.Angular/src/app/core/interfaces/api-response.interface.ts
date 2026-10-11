export interface ApiResponse<T> {
  readonly data: T;
  readonly message?: string;
}

export interface ApiError {
  readonly status: number;
  /** Código de negocio del backend, por ejemplo `identificador_duplicado`. */
  readonly code?: string;
  readonly message: string;
  readonly details?: unknown;
}
