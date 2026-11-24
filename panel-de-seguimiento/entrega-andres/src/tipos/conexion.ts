/**
 * Estado de la comunicación entre el dashboard y la API.
 *
 * Es distinto del estado online/offline de los equipos: si la API no responde,
 * el dashboard no sabe en qué estado están los equipos y no debe suponer que están offline.
 */
export type EstadoConexionApi =
  /** Primera consulta en curso; todavía no hay datos. */
  | { readonly tipo: "cargando" }
  /** La última consulta respondió correctamente. */
  | {
      readonly tipo: "conectada";
      readonly ultimaConsultaExitosa: string;
      /** Presente durante unos segundos después de recuperarse de un fallo. */
      readonly reconectadaEn?: string;
    }
  /** La última consulta no obtuvo respuesta: API detenida, red caída, CORS o tiempo agotado. */
  | {
      readonly tipo: "sin-conexion";
      readonly mensaje: string;
      readonly ultimaConsultaExitosa: string | null;
    }
  /**
   * La API respondió, pero no entregó datos utilizables (503, 500, estructura
   * inesperada) o la configuración del dashboard es incorrecta.
   */
  | {
      readonly tipo: "error-consulta";
      readonly mensaje: string;
      readonly ultimaConsultaExitosa: string | null;
    };

/** Estados en los que la última consulta falló. */
export type EstadoConexionFallida = Extract<EstadoConexionApi, { tipo: "sin-conexion" | "error-consulta" }>;

export function esConexionFallida(conexion: EstadoConexionApi): conexion is EstadoConexionFallida {
  return conexion.tipo === "sin-conexion" || conexion.tipo === "error-consulta";
}

/**
 * Lo que la interfaz necesita de una fuente de datos (servidores, alertas activas o resueltas):
 * la última respuesta válida, si la hay, y el estado de la última consulta de esa fuente.
 * Si `conexion` es un fallo y `datos` no es null, los datos están desactualizados.
 */
export interface FuenteVista<Datos> {
  readonly datos: Datos | null;
  readonly conexion: EstadoConexionApi;
}

/** De dónde vienen los datos que se muestran: escenarios ficticios o la API real. */
export type OrigenDatos = "demostracion" | "api";
