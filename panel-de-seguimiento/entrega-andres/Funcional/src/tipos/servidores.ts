/**
 * Contrato de GET /api/v1/servers (followup-api, ruta /api/v1).
 *
 * Vigente tras las etapas B1–B5 de la API: su forma no cambió (verificado en D0.1).
 * El tipo de equipo (computador o cámara IP) no forma parte del contrato.
 *
 * Los nombres de los tipos están en español; los nombres de los campos se
 * conservan tal como los entrega la API, porque son el contrato HTTP.
 * Fuente: followup-api/src/servers/servers.service.ts y dto/server-list.dto.ts.
 * Todas las fechas son texto ISO 8601 UTC con "Z" (por ejemplo "2026-11-03T15:30:05.000Z").
 */

/**
 * Conectividad de los reportes: indica si el Daemon sigue comunicándose con la API,
 * no la salud física del equipo. La calcula la API en cada consulta.
 */
export type EstadoServidor = "online" | "offline";

/** Métricas de una muestra (contrato SystemMetrics del Daemon). Porcentajes de 0 a 100. */
export interface RecursosSistema {
  readonly cpuUsagePercent: number;
  readonly memoryUsagePercent: number;
  readonly diskUsagePercent: number;
  /** Momento de la muestra según el reloj del Daemon. */
  readonly timestamp: string;
}

/** Reporte con la muestra más reciente del equipo. */
export interface UltimoReporte {
  /** Envío según el reloj del Daemon. */
  readonly sentAt: string;
  /** Recepción según el reloj de la API. */
  readonly receivedAt: string;
  /** receivedAt − sentAt, en milisegundos: desfase de reloj más latencia de red. */
  readonly clockSkewMs: number;
  readonly resources: RecursosSistema;
}

/** Un equipo (servidor) que ha enviado al menos un reporte aceptado. */
export interface Servidor {
  readonly daemonId: string;
  readonly status: EstadoServidor;
  /** Recepción del primer reporte aceptado (reloj de la API). */
  readonly firstSeenAt: string;
  /** Última comunicación (reloj de la API). */
  readonly lastContactAt: string;
  /** Intervalo de reporte declarado por el Daemon, en milisegundos. */
  readonly intervalMs: number;
  /** Momento en que el equipo pasa (o pasó) a offline si no vuelve a comunicarse. */
  readonly offlineAt: string;
  readonly latestReport: UltimoReporte;
}

/** Cuerpo completo de la respuesta 200 de GET /api/v1/servers. */
export interface RespuestaServidores {
  /** Instante del reloj de la API con el que se calcularon los estados. */
  readonly generatedAt: string;
  /** Intervalos sin comunicación tolerados antes de pasar a offline (hoy, 3). */
  readonly offlineAfterMissedIntervals: number;
  /** Ordenados por daemonId. Lista vacía si ningún equipo ha reportado. */
  readonly servers: readonly Servidor[];
}
