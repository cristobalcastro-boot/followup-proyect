import type { AlertasDispositivo } from "@/utilidades/alertas";

interface PropiedadesIndicadorAlertasEquipo {
  /** Alertas activas del equipo; null si las alertas se desconocen (no se muestra nada aquí). */
  alertas: AlertasDispositivo | null;
  /** Las alertas provienen de una consulta anterior a un fallo. */
  desactualizadas: boolean;
}

/**
 * Alertas activas asociadas a un equipo por daemonId: cantidad y, si corresponde, la alerta de
 * conectividad. Con cero alertas no muestra nada (el aviso del inventario indica si las alertas
 * se desconocen). La alerta offline se muestra aunque el status de /servers diga online: ambas
 * fuentes pueden diferir un momento y no se fuerza su coincidencia.
 */
export function IndicadorAlertasEquipo({ alertas, desactualizadas }: PropiedadesIndicadorAlertasEquipo) {
  if (alertas === null || alertas.total === 0) {
    return null;
  }
  const sufijo = desactualizadas ? " (desactualizado)" : "";
  return (
    <div className="mt-1.5 flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-semibold ${
          desactualizadas
            ? "border-dashed border-amber-500/70 bg-transparent text-amber-800 dark:text-amber-300"
            : "border-amber-600/30 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M8 2.5a4 4 0 0 0-4 4v2.5L2.5 11h11L12 9V6.5a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0" strokeLinejoin="round" />
        </svg>
        {alertas.total === 1 ? "1 alerta activa" : `${alertas.total} alertas activas`}
        {sufijo}
      </span>
      {alertas.offline && (
        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-rose-700 dark:text-rose-300">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3M2 2l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Alerta de conectividad: sin conexión
        </span>
      )}
    </div>
  );
}
