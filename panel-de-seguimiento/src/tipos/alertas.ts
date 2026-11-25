/**
 * Contrato de GET /api/v1/alerts (followup-api, etapas B1–B5).
 *
 * Los nombres de los tipos están en español; los nombres de los campos y sus valores se
 * conservan tal como los entrega la API, porque son el contrato HTTP.
 * Fuente: followup-api/src/alerts/alerts.service.ts (AlertView, AlertListView),
 * dto/alert-list.dto.ts, dto/alert-query.dto.ts y storage/alert-store.ts.
 * Todas las fechas son texto ISO 8601 UTC con "Z" (por ejemplo "2026-11-20T19:55:00.000Z").
 *
 * Las alertas las abre y resuelve la API (umbrales, rachas de muestras y regla de
 * conectividad). El dashboard solo las muestra: nunca las calcula.
 */

/** Anomalías de rendimiento: una por métrica. */
export type TipoAnomalia = "cpu_high" | "memory_high" | "disk_high";

/** Tipo de alerta: anomalía de rendimiento o pérdida de conectividad ("offline"). */
export type TipoAlerta = TipoAnomalia | "offline";

/** Severidad fija por tipo (decisión DP4 de la API): warning en rendimiento, critical en offline. */
export type SeveridadAlerta = "warning" | "critical";

/** active: vigente. resolved: historial ya resuelto. */
export type EstadoAlerta = "active" | "resolved";

interface AlertaBase {
  /** UUID generado por la API. */
  readonly id: string;
  readonly daemonId: string;
  /**
   * Rendimiento: recepción de la muestra que completó la racha elevada.
   * Offline: lastContactAt + intervalMs × 3.
   */
  readonly detectedAt: string;
}

/** Anomalía de CPU, RAM o disco: siempre warning, con valor y umbral en porcentaje (0–100). */
export interface AlertaAnomalia extends AlertaBase {
  readonly kind: TipoAnomalia;
  readonly severity: "warning";
  /** Valor (%) de la muestra que abrió la alerta. */
  readonly observedValue: number;
  /** Umbral (%) aplicado por la API al abrirla. */
  readonly threshold: number;
}

/** Pérdida de conectividad: siempre critical, sin valor ni umbral. */
export interface AlertaConectividad extends AlertaBase {
  readonly kind: "offline";
  readonly severity: "critical";
  readonly observedValue: null;
  readonly threshold: null;
}

/** resolvedAt es null mientras está activa y nunca es anterior a detectedAt. */
export type ResolucionAlerta =
  | { readonly status: "active"; readonly resolvedAt: null }
  | { readonly status: "resolved"; readonly resolvedAt: string };

export type Alerta = (AlertaAnomalia | AlertaConectividad) & ResolucionAlerta;

/** Cuerpo completo de la respuesta 200 de GET /api/v1/alerts. */
export interface RespuestaAlertas {
  /** Instante del reloj de la API en que se generó la respuesta. */
  readonly generatedAt: string;
  /**
   * Alertas que cumplen los filtros, de la detección más reciente a la más antigua
   * (y por id, descendente, ante empates). Lista vacía si ninguna cumple los filtros.
   */
  readonly alerts: readonly Alerta[];
}

/**
 * Filtros de la consulta. Todos son opcionales y la API los combina (Y lógico).
 * `limit`: entero de 1 a 500; la API devuelve las de detección más reciente. No hay cursor:
 * una respuesta con `limit` alertas puede no contener todo el historial.
 */
export interface FiltrosAlertas {
  readonly status?: EstadoAlerta;
  readonly daemonId?: string;
  readonly kind?: TipoAlerta;
  readonly severity?: SeveridadAlerta;
  /** Límite inferior inclusivo de detectedAt (ISO 8601 UTC con "Z"). */
  readonly from?: string;
  /** Límite superior inclusivo de detectedAt (ISO 8601 UTC con "Z"). No puede ser anterior a from. */
  readonly to?: string;
  readonly limit?: number;
}
