import { leerConfiguracionApi } from "@/configuracion/entorno";
import type { RespuestaServidores } from "@/tipos/servidores";
import { consultarApi, type ResultadoConsulta } from "./consultaApi";
import { validarRespuestaServidores } from "./validarRespuestaServidores";

// Se reexportan por compatibilidad con las importaciones anteriores a consultaApi.ts.
export { TIEMPO_MAXIMO_CONSULTA_MS, type FalloConsulta } from "./consultaApi";

export type ResultadoConsultaServidores = ResultadoConsulta<RespuestaServidores>;

/**
 * Consulta GET /api/v1/servers. Nunca lanza excepciones: devuelve un resultado
 * con los datos validados o con el motivo del fallo (ver consultarApi).
 *
 * @param senal permite cancelar la consulta con un AbortController.
 */
export function obtenerServidores(senal: AbortSignal): Promise<ResultadoConsultaServidores> {
  return consultarApi({
    configuracion: leerConfiguracionApi(),
    ruta: "/api/v1/servers",
    senal,
    validar: validarRespuestaServidores,
  });
}
