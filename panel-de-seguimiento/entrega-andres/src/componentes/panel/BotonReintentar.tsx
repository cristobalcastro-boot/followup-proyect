/** Consulta de inmediato, sin esperar al siguiente ciclo de actualización. */
export function BotonReintentar({ alReintentar }: { alReintentar: () => void }) {
  return (
    <button
      type="button"
      onClick={alReintentar}
      className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
    >
      Reintentar
    </button>
  );
}
