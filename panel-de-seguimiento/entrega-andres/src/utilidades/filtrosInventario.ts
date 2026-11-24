import type { Servidor } from "@/tipos/servidores";
import type { AlertasDispositivo } from "./alertas";
import type { TipoDispositivo } from "./tipoDispositivo";

/**
 * Filtros locales del inventario. No generan consultas ni cambian los datos recibidos: devuelven
 * una lista nueva con los equipos visibles. Los conteos globales del resumen no los usan.
 *
 * Solo hay importaciones de tipos (las pruebas con node:test cargan este archivo directamente):
 * por eso la clasificación y las alertas por dispositivo se reciben en `contexto`.
 */

export type FiltroEstadoEquipo = "todos" | "online" | "offline";
export type FiltroTipoEquipo = "todos" | TipoDispositivo;
export type FiltroAlertasEquipo = "todos" | "con-alertas";

export interface FiltrosInventario {
  readonly estado: FiltroEstadoEquipo;
  readonly tipo: FiltroTipoEquipo;
  readonly alertas: FiltroAlertasEquipo;
}

export const FILTROS_INVENTARIO_INICIALES: FiltrosInventario = { estado: "todos", tipo: "todos", alertas: "todos" };

export function hayFiltrosInventario(filtros: FiltrosInventario): boolean {
  return filtros.estado !== "todos" || filtros.tipo !== "todos" || filtros.alertas !== "todos";
}

export interface ContextoFiltroInventario {
  /** Clasificación visual del dispositivo (clasificarDispositivo). */
  readonly tipoDe: (daemonId: string) => TipoDispositivo;
  /**
   * Alertas activas por daemonId (agruparAlertasActivas), o null si se desconocen.
   * Con null, "con-alertas" no deja ningún equipo: no se puede afirmar que alguno tenga alertas.
   */
  readonly alertasActivas: ReadonlyMap<string, AlertasDispositivo> | null;
}

/** Aplica los tres filtros combinados (Y lógico). El estado es el status que entregó la API. */
export function filtrarInventario<T extends Pick<Servidor, "daemonId" | "status">>(
  servidores: readonly T[],
  filtros: FiltrosInventario,
  contexto: ContextoFiltroInventario,
): T[] {
  return servidores.filter((servidor) => {
    if (filtros.estado !== "todos" && servidor.status !== filtros.estado) return false;
    if (filtros.tipo !== "todos" && contexto.tipoDe(servidor.daemonId) !== filtros.tipo) return false;
    if (filtros.alertas === "con-alertas") {
      if (contexto.alertasActivas === null) return false;
      const alertas = contexto.alertasActivas.get(servidor.daemonId);
      if (alertas === undefined || alertas.total === 0) return false;
    }
    return true;
  });
}
