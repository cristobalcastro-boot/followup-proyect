import type { SeveridadAlerta, TipoAlerta } from "@/tipos/alertas";
import { ETIQUETA_SEVERIDAD, ETIQUETA_TIPO_ALERTA, esAlertaConectividad } from "@/utilidades/alertas";

const ATRIBUTOS_ICONO = {
  "aria-hidden": true,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-3.5 shrink-0",
};

/** Tipo de alerta con icono decorativo: "Sin conexión" o "CPU alta", "RAM alta", "Disco alto". */
export function EtiquetaTipoAlerta({ tipo }: { tipo: TipoAlerta }) {
  const conectividad = esAlertaConectividad({ kind: tipo });
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
      {conectividad ? (
        // Enchufe desconectado.
        <svg {...ATRIBUTOS_ICONO}>
          <path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3M2 2l12 12" />
        </svg>
      ) : (
        // Indicador de carga.
        <svg {...ATRIBUTOS_ICONO}>
          <path d="M2.5 11a5.5 5.5 0 1 1 11 0M8 11l3-3.5" />
        </svg>
      )}
      {ETIQUETA_TIPO_ALERTA[tipo]}
    </span>
  );
}

const ESTILOS_SEVERIDAD: Record<SeveridadAlerta, string> = {
  critical:
    "bg-rose-50 text-rose-800 ring-rose-600/25 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
  warning:
    "bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
};

/** Severidad con texto e icono propio de cada nivel, además del color. */
export function InsigniaSeveridad({ severidad }: { severidad: SeveridadAlerta }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${ESTILOS_SEVERIDAD[severidad]}`}
    >
      {severidad === "critical" ? (
        // Octágono con signo de exclamación.
        <svg {...ATRIBUTOS_ICONO} className="size-3 shrink-0">
          <path d="M5.5 1.5h5l4 4v5l-4 4h-5l-4-4v-5zM8 5v3.5M8 11h.01" />
        </svg>
      ) : (
        // Triángulo con signo de exclamación.
        <svg {...ATRIBUTOS_ICONO} className="size-3 shrink-0">
          <path d="M8 2 1.5 13.5h13zM8 6.5v3M8 11.5h.01" />
        </svg>
      )}
      {ETIQUETA_SEVERIDAD[severidad]}
    </span>
  );
}
