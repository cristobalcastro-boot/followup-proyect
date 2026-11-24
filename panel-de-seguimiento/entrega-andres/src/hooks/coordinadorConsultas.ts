/**
 * Consulta coordinada de varias fuentes (servidores, alertas activas, alertas resueltas)
 * dentro de un único ciclo de polling.
 *
 * crearCicloConsultas sigue siendo el único temporizador: llama a la función que devuelve
 * crearConsultaCoordinada en cada ciclo. Esa función decide qué fuentes tocan según su
 * periodicidad, las consulta en paralelo y espera a que terminen todas antes de devolver;
 * así el ciclo nunca inicia otra ronda mientras queda alguna consulta en curso.
 *
 *   ciclo (cada intervaloMs) ─> consulta coordinada ─┬─> servidores       (cadaMs 0: siempre)
 *                                                   ├─> alertas activas   (cadaMs 0: siempre)
 *                                                   └─> alertas resueltas (cadaMs 30 000)
 *
 * Cada fuente entrega su resultado por su cuenta (alRecibir), en cuanto llega: una fuente
 * lenta o caída no retrasa ni bloquea la actualización de las demás. Los resultados que llegan
 * con la señal ya cancelada (desmontaje) se descartan.
 *
 * No depende de React ni tiene importaciones en tiempo de ejecución: se prueba con node:test.
 */

export interface FuenteCoordinada<Resultado> {
  /**
   * Periodicidad mínima entre dos inicios de consulta de esta fuente, en ms.
   * 0: en cada ciclo. La periodicidad real es el primer ciclo que cumple el plazo, así que
   * nunca es menor que el intervalo del ciclo.
   */
  readonly cadaMs: number;
  /** Ejecuta la consulta. No debería lanzar excepciones (los servicios del dashboard no lo hacen). */
  readonly consultar: (senal: AbortSignal) => Promise<Resultado>;
  /** Recibe el resultado en cuanto llega, solo si la consulta no fue cancelada. */
  readonly alRecibir: (resultado: Resultado) => void;
}

/**
 * Forma mínima que cumple cualquier FuenteCoordinada<R>, sea cual sea R: permite un mapa de
 * fuentes con nombre, cada una con su propio tipo de resultado.
 */
interface FuenteCualquiera {
  readonly cadaMs: number;
  readonly consultar: (senal: AbortSignal) => Promise<unknown>;
  readonly alRecibir: (resultado: never) => void;
}

/** Nombres de las fuentes consultadas en una ronda (útil para pruebas y diagnóstico). */
export type RondaCoordinada<Nombre extends string> = readonly Nombre[];

export interface OpcionesConsultaCoordinada<Fuentes> {
  readonly fuentes: Fuentes;
  /** Reloj en ms; por defecto Date.now. Las pruebas lo sustituyen. */
  readonly ahora?: () => number;
}

/**
 * Devuelve la función de consulta para crearCicloConsultas. Conserva entre rondas el
 * instante del último inicio de cada fuente; crear una instancia por cada montaje.
 */
export function crearConsultaCoordinada<Fuentes extends Record<string, FuenteCualquiera>>(
  opciones: OpcionesConsultaCoordinada<Fuentes>,
): (senal: AbortSignal) => Promise<RondaCoordinada<Extract<keyof Fuentes, string>>> {
  type Nombre = Extract<keyof Fuentes, string>;
  const { fuentes } = opciones;
  const ahora = opciones.ahora ?? Date.now;
  const ultimoInicio = new Map<Nombre, number>();
  const nombres = Object.keys(fuentes) as Nombre[];

  return async (senal) => {
    const instante = ahora();
    const corresponden = nombres.filter((nombre) => {
      const anterior = ultimoInicio.get(nombre);
      return anterior === undefined || instante - anterior >= fuentes[nombre].cadaMs;
    });
    for (const nombre of corresponden) {
      ultimoInicio.set(nombre, instante);
    }

    await Promise.all(
      corresponden.map(async (nombre) => {
        // El tipo concreto de cada fuente se pierde en el mapa; consultar y alRecibir son de la misma fuente.
        const fuente = fuentes[nombre] as unknown as FuenteCoordinada<unknown>;
        let resultado: unknown;
        try {
          resultado = await fuente.consultar(senal);
        } catch {
          // Defensa: una fuente que lanza no detiene a las demás ni al ciclo.
          return;
        }
        if (!senal.aborted) {
          fuente.alRecibir(resultado);
        }
      }),
    );
    return corresponden;
  };
}
