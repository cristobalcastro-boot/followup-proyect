import type { Servidor } from "@/tipos/servidores";

export interface ResumenServidores {
  /** Todos los registros que entrega la API, clasificados o no. */
  readonly registrados: number;
  readonly online: number;
  readonly offline: number;
}

/**
 * Cuenta los equipos por estado. El estado lo calculó la API; aquí solo se suma,
 * nunca se recalcula con el reloj del navegador. El conteo por tipo está en tipoDispositivo.ts.
 */
export function resumirServidores(servidores: readonly Pick<Servidor, "status">[]): ResumenServidores {
  const online = servidores.filter((servidor) => servidor.status === "online").length;
  return {
    registrados: servidores.length,
    online,
    offline: servidores.length - online,
  };
}
