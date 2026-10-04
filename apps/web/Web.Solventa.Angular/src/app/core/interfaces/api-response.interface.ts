export interface ApiResponse<T> {
  readonly data: T;
  readonly message?: string;
}

export interface ApiError {
  readonly status: number;
  readonly message: string;
  readonly details?: unknown;
}
