type TonoResumen =
  | "neutro"
  | "online"
  | "offline"
  | "computador"
  | "camara"
  | "sin-clasificar"
  | "alerta-critica"
  | "alerta-advertencia";

const CLASES_TONO: Record<TonoResumen, string> = {
  neutro: "bg-slate-400 dark:bg-slate-500",
  "alerta-critica": "bg-rose-500",
  "alerta-advertencia": "bg-amber-500",
  online: "bg-emerald-500",
  offline: "bg-rose-500",
  computador: "bg-sky-500",
  camara: "bg-teal-500",
  "sin-clasificar": "border border-dashed border-slate-400 dark:border-slate-500",
};

interface PropiedadesTarjetaResumen {
  titulo: string;
  /** null mientras no hay datos (se muestra un guion). */
  valor: number | null;
  descripcion: string;
  tono: TonoResumen;
  /** Variante en una fila (título a la izquierda, cifra a la derecha), para el resumen por tipo. */
  compacta?: boolean;
  /** Aviso visible junto a la cifra, por ejemplo "Desactualizado" (solo en la variante compacta). */
  aviso?: string;
}

/** Cifra del resumen global (registrados, online, offline, conteo por tipo y alertas). */
export function TarjetaResumen({ titulo, valor, descripcion, tono, compacta = false, aviso }: PropiedadesTarjetaResumen) {
  const punto = <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${CLASES_TONO[tono]}`} />;

  if (compacta) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {punto}
            {titulo}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>
          {aviso !== undefined && (
            <p className="mt-1 w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
              {aviso}
            </p>
          )}
        </div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-50">
          {valor ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
        {punto}
        {titulo}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
        {valor ?? "—"}
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>
    </div>
  );
}
