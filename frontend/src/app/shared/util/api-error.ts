import { HttpErrorResponse } from '@angular/common/http';

export const API_CONNECTION_ERROR =
  'Não foi possível conectar à API local. Verifique se o backend está rodando.';

export function apiErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return API_CONNECTION_ERROR;
    }

    if (typeof error.error?.message === 'string') {
      return error.error.message;
    }
  }

  return 'Não foi possível concluir a ação.';
}
