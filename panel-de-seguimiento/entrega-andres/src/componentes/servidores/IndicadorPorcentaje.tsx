import { formatearPorcentaje } from "@/utilidades/formato";

interface PropiedadesIndicadorPorcentaje {
  /** Nombre de la métrica, por ejemplo "CPU". */
  etiqueta: string;
  /** Porcentaje entre 0 y 100, tal como llegó de la API. */
  valor: number;
  /** Muestra la etiqueta junto al valor (en la tabla la etiqueta ya está en la cabecera). */
  mostrarEtiqueta?: boolean;
  /**
   * Hay una alerta activa de la API para esta métrica (cpu_high, memory_high o disk_high).
   * Lo decide la API con sus umbrales y rachas; nunca se deduce del valor.
   */
  anomala?: boolean;
}

/**
 * Valor porcentual con una barra. La barra es neutra salvo que la API informe una alerta activa
 * de esta métrica: entonces se resalta y se agrega el texto «Anomalía». El dashboard no define
 * umbrales y los valores son simulados.
 */
export function IndicadorPorcentaje({ etiqueta, valor, mostrarEtiqueta = false, anomala = false }: PropiedadesIndicadorPorcentaje) {
  const ancho = Math.min(Math.max(valor, 0), 100);
  const nombreAccesible = anomala ? `${etiqueta}, anomalía según alerta activa de la API` : etiqueta;
  return (
    <div className="min-w-24">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={mostrarEtiqueta ? "text-slate-600 dark:text-slate-400" : "sr-only"}>{etiqueta}</span>
        <span
          className={`tabular-nums ${anomala ? "font-semibold text-amber-800 dark:text-amber-300" : "font-medium text-slate-900 dark:text-slate-100"}`}
        >
          {formatearPorcentaje(valor)}
        </span>
      </div>
      <div
        role="meter"
        aria-label={nombreAccesible}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valor}
        aria-valuetext={formatearPorcentaje(valor)}
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={`h-full rounded-full ${anomala ? "bg-amber-500 dark:bg-amber-400" : "bg-sky-600 dark:bg-sky-400"}`}
          style={{ width: `${ancho}%` }}
        />
      </div>
      {anomala && (
        <p aria-hidden="true" className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-amber-800 dark:text-amber-300">
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M8 2 1.5 13.5h13zM8 6.5v3M8 11.5h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Anomalía
        </p>
      )}
    </div>
  );
}
