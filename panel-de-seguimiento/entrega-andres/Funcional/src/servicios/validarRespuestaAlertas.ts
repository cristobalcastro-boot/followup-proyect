import type {
  EstadoAlerta,
  FiltrosAlertas,
  RespuestaAlertas,
  SeveridadAlerta,
  TipoAlerta,
} from "@/tipos/alertas";

// Comprobación en tiempo de ejecución de la respuesta de GET /api/v1/alerts y de sus filtros.
// TypeScript solo verifica tipos al compilar; lo que llega por la red puede ser cualquier cosa.
// Se comprueban todos los campos del contrato y sus relaciones; los campos adicionales se toleran,
// igual que en validarRespuestaServidores.
// Solo hay importaciones de tipos: las pruebas con node:test cargan este archivo directamente.

type Objeto = Record<string, unknown>;

/**
 * Severidad que corresponde a cada tipo (DP4 de la API). Al ser un Record sobre TipoAlerta,
 * el compilador exige que estén todos los tipos y ninguno más.
 */
const SEVERIDAD_POR_TIPO: Readonly<Record<TipoAlerta, SeveridadAlerta>> = {
  cpu_high: "warning",
  memory_high: "warning",
  disk_high: "warning",
  offline: "critical",
};

const ESTADOS: Readonly<Record<EstadoAlerta, true>> = { active: true, resolved: true };

/** ISO 8601 UTC estricto con "Z" y hasta 3 decimales: el mismo patrón que valida la API. */
const PATRON_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identificador de Daemon admitido por la API (DAEMON_ID_PATTERN). */
export const PATRON_DAEMON_ID = /^[A-Za-z0-9._-]{1,64}$/;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Fecha ISO UTC con "Z" que además corresponde a un instante real (rechaza, por ejemplo, el mes 13). */
export function esFechaIsoUtc(valor: unknown): valor is string {
  return typeof valor === "string" && PATRON_ISO_UTC.test(valor) && !Number.isNaN(Date.parse(valor));
}

function esPorcentaje(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= 100;
}

function esTipoAlerta(valor: unknown): valor is TipoAlerta {
  return typeof valor === "string" && Object.hasOwn(SEVERIDAD_POR_TIPO, valor);
}

function esEstadoAlerta(valor: unknown): valor is EstadoAlerta {
  return typeof valor === "string" && Object.hasOwn(ESTADOS, valor);
}

/** Devuelve la descripción del primer problema encontrado, o null si la alerta es válida. */
function problemaEnAlerta(alerta: unknown): string | null {
  if (!esObjeto(alerta)) return "no es un objeto";
  if (typeof alerta.id !== "string" || !PATRON_UUID.test(alerta.id)) return "id no es un UUID";
  if (typeof alerta.daemonId !== "string" || !PATRON_DAEMON_ID.test(alerta.daemonId)) return "daemonId inválido";

  if (!esTipoAlerta(alerta.kind)) return "kind distinto de cpu_high/memory_high/disk_high/offline";
  if (alerta.severity !== SEVERIDAD_POR_TIPO[alerta.kind]) {
    return `severity debe ser ${SEVERIDAD_POR_TIPO[alerta.kind]} para kind ${alerta.kind}`;
  }

  if (!esFechaIsoUtc(alerta.detectedAt)) return "detectedAt no es una fecha ISO UTC";
  if (!esEstadoAlerta(alerta.status)) return "status distinto de active/resolved";
  if (alerta.status === "active") {
    if (alerta.resolvedAt !== null) return "resolvedAt debe ser null en una alerta activa";
  } else {
    if (!esFechaIsoUtc(alerta.resolvedAt)) return "resolvedAt no es una fecha ISO UTC en una alerta resuelta";
    if (Date.parse(alerta.resolvedAt) < Date.parse(alerta.detectedAt)) return "resolvedAt es anterior a detectedAt";
  }

  if (alerta.kind === "offline") {
    if (alerta.observedValue !== null || alerta.threshold !== null) {
      return "observedValue y threshold deben ser null en una alerta offline";
    }
  } else {
    if (!esPorcentaje(alerta.observedValue)) return "observedValue no es un porcentaje entre 0 y 100";
    if (!esPorcentaje(alerta.threshold)) return "threshold no es un porcentaje entre 0 y 100";
  }
  return null;
}

export type ResultadoValidacionAlertas =
  | { readonly valida: true; readonly respuesta: RespuestaAlertas }
  | { readonly valida: false; readonly problema: string };

export function validarRespuestaAlertas(cuerpo: unknown): ResultadoValidacionAlertas {
  if (!esObjeto(cuerpo)) {
    return { valida: false, problema: "el cuerpo no es un objeto JSON" };
  }
  if (!esFechaIsoUtc(cuerpo.generatedAt)) {
    return { valida: false, problema: "generatedAt ausente o inválido" };
  }
  if (!Array.isArray(cuerpo.alerts)) {
    return { valida: false, problema: "alerts no es una lista" };
  }

  const identificadoresVistos = new Set<string>();
  // La API garantiza como máximo una alerta activa por equipo y tipo (índice alerts_one_active).
  const activasVistas = new Set<string>();
  for (const [posicion, alerta] of cuerpo.alerts.entries()) {
    const problema = problemaEnAlerta(alerta);
    if (problema !== null) {
      return { valida: false, problema: `alerts[${posicion}]: ${problema}` };
    }
    const { id, daemonId, kind, status } = alerta as { id: string; daemonId: string; kind: string; status: string };
    // id identifica la alerta (y será la key de React): no puede repetirse.
    const idNormalizado = id.toLowerCase();
    if (identificadoresVistos.has(idNormalizado)) {
      return { valida: false, problema: `alerts[${posicion}]: id "${id}" repetido` };
    }
    identificadoresVistos.add(idNormalizado);
    if (status === "active") {
      const clave = `${daemonId}\u0000${kind}`;
      if (activasVistas.has(clave)) {
        return {
          valida: false,
          problema: `alerts[${posicion}]: más de una alerta activa ${kind} para "${daemonId}"`,
        };
      }
      activasVistas.add(clave);
    }
  }
  // Tras las comprobaciones anteriores, la forma coincide con el contrato.
  return { valida: true, respuesta: cuerpo as unknown as RespuestaAlertas };
}

// ---------------------------------------------------------------------------------------------
// Filtros de la consulta (AlertQueryDto de la API). Se validan antes de enviar la consulta:
// la API respondería 400 ante cualquier valor inválido.

/** Máximo que admite la API por consulta (MAX_ALERTS_LIMIT). No hay cursor ni paginación. */
export const LIMITE_MAXIMO_ALERTAS = 500;
/** Límite que aplica la API si no se indica (DEFAULT_ALERTS_LIMIT); el dashboard siempre lo envía explícito. */
export const LIMITE_PREDETERMINADO_ALERTAS = 100;

/**
 * Consulta inicial del dashboard: todas las alertas activas. La API garantiza como máximo una
 * activa por equipo y tipo (4 tipos), así que 500 cubre holgadamente el escenario actual.
 */
export const FILTROS_ALERTAS_ACTIVAS: FiltrosAlertas = { status: "active", limit: LIMITE_MAXIMO_ALERTAS };

/** Cantidad de alertas resueltas que muestra el dashboard: las de detección más reciente. */
export const LIMITE_ALERTAS_RESUELTAS = 20;

/** Historial reciente: las últimas 20 alertas resueltas por detectedAt. No es el historial completo. */
export const FILTROS_ALERTAS_RESUELTAS: FiltrosAlertas = { status: "resolved", limit: LIMITE_ALERTAS_RESUELTAS };

const RUTA_ALERTAS = "/api/v1/alerts";

export type ResultadoRutaAlertas =
  | { readonly valida: true; readonly ruta: string; readonly limite: number }
  | { readonly valida: false; readonly problema: string };

/**
 * Valida los filtros y construye la ruta con parámetros, en un orden fijo.
 * `limit` se envía siempre (por defecto 100, igual que la API) para saber cuántas alertas
 * como máximo puede traer la respuesta.
 */
export function construirRutaAlertas(filtros: FiltrosAlertas = {}): ResultadoRutaAlertas {
  const { status, daemonId, kind, severity, from, to } = filtros;
  const limite = filtros.limit ?? LIMITE_PREDETERMINADO_ALERTAS;

  if (status !== undefined && !esEstadoAlerta(status)) return { valida: false, problema: "status inválido" };
  if (kind !== undefined && !esTipoAlerta(kind)) return { valida: false, problema: "kind inválido" };
  if (severity !== undefined && severity !== "warning" && severity !== "critical") {
    return { valida: false, problema: "severity inválida" };
  }
  if (daemonId !== undefined && !PATRON_DAEMON_ID.test(daemonId)) {
    return { valida: false, problema: "daemonId inválido" };
  }
  if (from !== undefined && !esFechaIsoUtc(from)) return { valida: false, problema: "from no es una fecha ISO UTC" };
  if (to !== undefined && !esFechaIsoUtc(to)) return { valida: false, problema: "to no es una fecha ISO UTC" };
  if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) {
    return { valida: false, problema: "from no puede ser posterior a to" };
  }
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO_ALERTAS) {
    return { valida: false, problema: `limit debe ser un entero entre 1 y ${LIMITE_MAXIMO_ALERTAS}` };
  }

  const parametros = new URLSearchParams();
  if (status !== undefined) parametros.set("status", status);
  if (daemonId !== undefined) parametros.set("daemonId", daemonId);
  if (kind !== undefined) parametros.set("kind", kind);
  if (severity !== undefined) parametros.set("severity", severity);
  if (from !== undefined) parametros.set("from", from);
  if (to !== undefined) parametros.set("to", to);
  parametros.set("limit", String(limite));
  return { valida: true, ruta: `${RUTA_ALERTAS}?${parametros.toString()}`, limite };
}

/**
 * true si la respuesta alcanzó el límite pedido: puede haber más alertas que cumplan los filtros
 * y no vinieron (la API devuelve las de detección más reciente). Para recorrer el historial
 * hay que acotar con from/to.
 */
export function puedeHaberMasAlertas(respuesta: RespuestaAlertas, limite: number): boolean {
  return respuesta.alerts.length >= limite;
}
