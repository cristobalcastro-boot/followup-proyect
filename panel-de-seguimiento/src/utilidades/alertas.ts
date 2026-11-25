import type { Alerta, EstadoAlerta, SeveridadAlerta, TipoAlerta } from "@/tipos/alertas";

// Funciones puras de presentación de alertas. Las alertas las abre y resuelve la API:
// aquí solo se nombran y se cuentan, nunca se recalculan con umbrales locales.

export const ETIQUETA_TIPO_ALERTA: Readonly<Record<TipoAlerta, string>> = {
  cpu_high: "CPU alta",
  memory_high: "RAM alta",
  disk_high: "Disco alto",
  offline: "Sin conexión",
};

export const ETIQUETA_SEVERIDAD: Readonly<Record<SeveridadAlerta, string>> = {
  warning: "Advertencia",
  critical: "Crítica",
};

export const ETIQUETA_ESTADO_ALERTA: Readonly<Record<EstadoAlerta, string>> = {
  active: "Activa",
  resolved: "Resuelta",
};

/** Conectividad (offline) frente a rendimiento (CPU, RAM o disco). */
export function esAlertaConectividad(alerta: Pick<Alerta, "kind">): boolean {
  return alerta.kind === "offline";
}

export interface ResumenAlertas {
  readonly total: number;
  /** Alertas offline. */
  readonly conectividad: number;
  /** Alertas de CPU, RAM o disco. */
  readonly rendimiento: number;
}

/** Cuenta las alertas recibidas. Se usa solo con la respuesta de alertas activas. */
export function resumirAlertas(alertas: readonly Pick<Alerta, "kind">[]): ResumenAlertas {
  const conectividad = alertas.filter(esAlertaConectividad).length;
  return { total: alertas.length, conectividad, rendimiento: alertas.length - conectividad };
}

// ---------------------------------------------------------------------------------------------
// Relación entre alertas activas y dispositivos del inventario (por daemonId).
// Solo usa las alertas que entrega la API: nunca deduce anomalías de los porcentajes, ni cambia
// el status online/offline de /servers. Una alerta offline y el status pueden diferir un momento
// (la API los calcula en instantes distintos): se muestran ambos tal como llegan.

/** Alertas activas de un dispositivo. */
export interface AlertasDispositivo {
  readonly total: number;
  /** Alerta activa de conectividad (offline). */
  readonly offline: boolean;
  /** Anomalía activa de CPU (cpu_high). */
  readonly cpu: boolean;
  /** Anomalía activa de RAM (memory_high). */
  readonly ram: boolean;
  /** Anomalía activa de disco (disk_high). */
  readonly disco: boolean;
}

export const SIN_ALERTAS_DISPOSITIVO: AlertasDispositivo = {
  total: 0,
  offline: false,
  cpu: false,
  ram: false,
  disco: false,
};

/**
 * Agrupa las alertas activas por daemonId. Ignora las resueltas aunque lleguen mezcladas.
 * No modifica la lista recibida.
 */
export function agruparAlertasActivas(
  alertas: readonly Pick<Alerta, "daemonId" | "kind" | "status">[],
): ReadonlyMap<string, AlertasDispositivo> {
  const porDispositivo = new Map<string, AlertasDispositivo>();
  for (const alerta of alertas) {
    if (alerta.status !== "active") continue;
    const anterior = porDispositivo.get(alerta.daemonId) ?? SIN_ALERTAS_DISPOSITIVO;
    porDispositivo.set(alerta.daemonId, {
      total: anterior.total + 1,
      offline: anterior.offline || alerta.kind === "offline",
      cpu: anterior.cpu || alerta.kind === "cpu_high",
      ram: anterior.ram || alerta.kind === "memory_high",
      disco: anterior.disco || alerta.kind === "disk_high",
    });
  }
  return porDispositivo;
}

/** Alertas activas de un dispositivo; sin alertas si no figura en el mapa. */
export function alertasDeDispositivo(
  porDispositivo: ReadonlyMap<string, AlertasDispositivo>,
  daemonId: string,
): AlertasDispositivo {
  return porDispositivo.get(daemonId) ?? SIN_ALERTAS_DISPOSITIVO;
}

/**
 * Alertas cuyo daemonId no está en el inventario recibido. Se siguen mostrando en el panel de
 * alertas; aquí solo se identifican, sin inventar un dispositivo.
 */
export function alertasSinDispositivo<T extends Pick<Alerta, "daemonId">>(
  alertas: readonly T[],
  daemonIdsInventario: Iterable<string>,
): T[] {
  const conocidos = new Set(daemonIdsInventario);
  return alertas.filter((alerta) => !conocidos.has(alerta.daemonId));
}

/**
 * Qué se sabe de las alertas activas:
 * - disponible: la última consulta respondió bien.
 * - desactualizada: hay datos válidos anteriores, pero la última consulta falló.
 * - desconocida: nunca se obtuvieron (cargando o con error); no equivale a "sin alertas".
 */
export type DisponibilidadAlertas = "disponible" | "desactualizada" | "desconocida";

export function disponibilidadAlertas(tieneDatos: boolean, ultimaConsultaFallida: boolean): DisponibilidadAlertas {
  if (!tieneDatos) return "desconocida";
  return ultimaConsultaFallida ? "desactualizada" : "disponible";
}

// ---------------------------------------------------------------------------------------------
// Filtros locales del panel de alertas. No generan consultas: trabajan con lo ya recibido
// (todas las activas y las últimas 20 resueltas).

/** Qué grupos mostrar. "todas": activas y las últimas resueltas disponibles, no el historial completo. */
export type FiltroEstadoAlertas = "activas" | "resueltas" | "todas";
export type FiltroCategoriaAlertas = "todas" | "conectividad" | "rendimiento";

export interface FiltrosAlertasPanel {
  readonly estado: FiltroEstadoAlertas;
  readonly categoria: FiltroCategoriaAlertas;
}

export const FILTROS_ALERTAS_INICIALES: FiltrosAlertasPanel = { estado: "todas", categoria: "todas" };

export function gruposAlertasVisibles(estado: FiltroEstadoAlertas): { readonly activas: boolean; readonly resueltas: boolean } {
  return { activas: estado !== "resueltas", resueltas: estado !== "activas" };
}

/** Filtra por categoría sin modificar la lista recibida (devuelve una nueva). */
export function filtrarAlertasPorCategoria<T extends Pick<Alerta, "kind">>(
  alertas: readonly T[],
  categoria: FiltroCategoriaAlertas,
): T[] {
  if (categoria === "todas") return [...alertas];
  const conectividad = categoria === "conectividad";
  return alertas.filter((alerta) => esAlertaConectividad(alerta) === conectividad);
}
