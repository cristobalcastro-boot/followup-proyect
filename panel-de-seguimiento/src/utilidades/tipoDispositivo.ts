/**
 * Tipo visual de un dispositivo, deducido de su daemonId.
 *
 * La API no entrega el tipo de equipo (verificado en D0.1). followup-daemon deriva los
 * identificadores de sus dispositivos simulados con un sufijo: "<prefijo>-pc-NN" para los
 * computadores y "<prefijo>-cam-NN" para las cámaras IP. Esta función reconoce solo ese sufijo
 * completo, con cualquier prefijo no vacío; todo lo demás (por ejemplo, el registro histórico
 * "followup-local-01") queda "sin clasificar".
 *
 * Es solo presentación: no interviene en la conectividad, las métricas ni las alertas,
 * que siempre decide la API.
 */
export type TipoDispositivo = "computador" | "camara" | "sin-clasificar";

/** Prefijo no vacío, "-pc-" o "-cam-" y exactamente dos dígitos al final. Sensible a mayúsculas. */
const PATRON_SUFIJO = /^.+-(pc|cam)-[0-9]{2}$/;

export function clasificarDispositivo(daemonId: string): TipoDispositivo {
  const coincidencia = PATRON_SUFIJO.exec(daemonId);
  if (coincidencia === null) {
    return "sin-clasificar";
  }
  return coincidencia[1] === "pc" ? "computador" : "camara";
}

export interface ConteoPorTipo {
  readonly computadores: number;
  readonly camaras: number;
  readonly sinClasificar: number;
}

/** Cuenta los registros de cada tipo; la suma siempre es igual al total recibido. */
export function contarPorTipo(servidores: readonly { readonly daemonId: string }[]): ConteoPorTipo {
  let computadores = 0;
  let camaras = 0;
  for (const { daemonId } of servidores) {
    const tipo = clasificarDispositivo(daemonId);
    if (tipo === "computador") computadores += 1;
    else if (tipo === "camara") camaras += 1;
  }
  return { computadores, camaras, sinClasificar: servidores.length - computadores - camaras };
}

/** Texto visible de cada tipo. */
export const NOMBRE_TIPO_DISPOSITIVO: Readonly<Record<TipoDispositivo, string>> = {
  computador: "Computador",
  camara: "Cámara IP",
  "sin-clasificar": "Sin clasificar",
};

/** Explicación breve de cada tipo (title y textos de ayuda). */
export const DESCRIPCION_TIPO_DISPOSITIVO: Readonly<Record<TipoDispositivo, string>> = {
  computador: "Identificador terminado en -pc-NN: computador simulado por followup-daemon.",
  camara: "Identificador terminado en -cam-NN: cámara IP simulada por followup-daemon.",
  "sin-clasificar":
    "El identificador no termina en -pc-NN ni en -cam-NN, por ejemplo un registro histórico. Su estado y sus métricas son los que entrega la API.",
};
