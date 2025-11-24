// Tipos estándar de respuesta de la API
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
}

// Tipo para paginación
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// Tipo para query params de paginación
export interface PaginationQuery {
  page?: number;
  perPage?: number;
}
