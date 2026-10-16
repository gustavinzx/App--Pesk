export interface UsuarioAutenticado {
  uid: string;
  email: string;
  nome?: string;
}

export interface VerificadorToken {
  verificar(token: string): Promise<UsuarioAutenticado>;
}
