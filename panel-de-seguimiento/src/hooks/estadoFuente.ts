import type { FalloConsulta, ResultadoConsulta } from "@/servicios/consultaApi";
import type { EstadoConexionApi } from "@/tipos/conexion";

/**
 * Estado de una fuente de datos (servidores, alertas activas o alertas resueltas).
 * Cada fuente se actualiza por separado: el fallo de una no afecta a las demás.
 * Solo hay importaciones de tipos: las pruebas con node:test cargan este archivo directamente.
 */

/** Durante cuánto tiempo se indica "Conexión restablecida" después de recuperarse de un fallo. */
export const DURACION_AVISO_RECONEXION_MS = 30_000;

export type FalloReal = Exclude<FalloConsulta, { tipo: "cancelada" }>;

export interface EstadoFuente<Datos> {
  /** Última respuesta válida; se conserva aunque consultas posteriores fallen. */
  readonly datos: Datos | null;
  /** Hora del navegador en que se recibió la última respuesta válida. */
  readonly ultimaConsultaExitosa: string | null;
  /** Fallo de la última consulta; null si fue exitosa o si aún no termina la primera. */
  readonly fallo: FalloReal | null;
  /** Hora en que una consulta exitosa siguió a un fallo. */
  readonly reconectadaEn: string | null;
}

export const ESTADO_FUENTE_INICIAL: EstadoFuente<never> = {
  datos: null,
  ultimaConsultaExitosa: null,
  fallo: null,
  reconectadaEn: null,
};

/** Calcula el siguiente estado a partir del anterior y del resultado de una consulta. */
export function aplicarResultadoFuente<Datos>(
  anterior: EstadoFuente<Datos>,
  resultado: ResultadoConsulta<Datos>,
  ahoraIso: string,
): EstadoFuente<Datos> {
  if (resultado.exito) {
    return {
      datos: resultado.respuesta,
      ultimaConsultaExitosa: ahoraIso,
      fallo: null,
      // Si la consulta anterior había fallado, esta es una reconexión.
      reconectadaEn: anterior.fallo !== null ? ahoraIso : anterior.reconectadaEn,
    };
  }
  if (resultado.fallo.tipo === "cancelada") {
    return anterior;
  }
  // Se conservan los datos anteriores: un fallo de consulta no cambia lo que se sabía.
  return { ...anterior, fallo: resultado.fallo, reconectadaEn: null };
}

/** Traduce el estado de una fuente al estado de conexión que entiende la interfaz. */
export function calcularConexionFuente(estado: EstadoFuente<unknown>): EstadoConexionApi {
  if (estado.fallo !== null) {
    const sinRespuesta = estado.fallo.tipo === "red" || estado.fallo.tipo === "tiempo-agotado";
    return {
      tipo: sinRespuesta ? "sin-conexion" : "error-consulta",
      mensaje: estado.fallo.mensaje,
      ultimaConsultaExitosa: estado.ultimaConsultaExitosa,
    };
  }
  if (estado.ultimaConsultaExitosa === null) {
    return { tipo: "cargando" };
  }
  const reconexionReciente =
    estado.reconectadaEn !== null &&
    Date.parse(estado.ultimaConsultaExitosa) - Date.parse(estado.reconectadaEn) < DURACION_AVISO_RECONEXION_MS;
  return reconexionReciente && estado.reconectadaEn !== null
    ? { tipo: "conectada", ultimaConsultaExitosa: estado.ultimaConsultaExitosa, reconectadaEn: estado.reconectadaEn }
    : { tipo: "conectada", ultimaConsultaExitosa: estado.ultimaConsultaExitosa };
}
