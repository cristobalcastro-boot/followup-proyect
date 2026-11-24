export interface OpcionFiltro<Valor extends string> {
  readonly valor: Valor;
  readonly etiqueta: string;
  /** La opción se ve, pero no se puede elegir (por ejemplo, alertas desconocidas). */
  readonly deshabilitada?: boolean;
}

interface PropiedadesGrupoOpciones<Valor extends string> {
  /** Texto del <legend>: nombra el filtro. */
  leyenda: string;
  /** name de los radios; debe ser único en la página. */
  nombre: string;
  opciones: readonly OpcionFiltro<Valor>[];
  valor: Valor;
  alCambiar: (valor: Valor) => void;
  /** Aclaración visible bajo las opciones (por ejemplo, datos desactualizados). */
  nota?: string;
}

/**
 * Filtro de opción única con radios nativos: se recorre con Tab y se cambia con las flechas.
 * La opción elegida se distingue por fondo, peso y una marca, no solo por color.
 */
export function GrupoOpciones<Valor extends string>({
  leyenda,
  nombre,
  opciones,
  valor,
  alCambiar,
  nota,
}: PropiedadesGrupoOpciones<Valor>) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-slate-600 dark:text-slate-400">{leyenda}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {opciones.map((opcion) => {
          const elegida = opcion.valor === valor;
          return (
            <label
              key={opcion.valor}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-50 has-[:checked]:bg-slate-900 has-[:checked]:font-semibold has-[:checked]:text-white has-[:checked]:ring-slate-900 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky-600 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:has-[:checked]:bg-slate-100 dark:has-[:checked]:text-slate-900 dark:has-[:checked]:ring-slate-100"
            >
              <input
                type="radio"
                name={nombre}
                value={opcion.valor}
                checked={elegida}
                disabled={opcion.deshabilitada}
                onChange={() => alCambiar(opcion.valor)}
                className="sr-only"
              />
              {elegida && (
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="m3 8.5 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {opcion.etiqueta}
            </label>
          );
        })}
      </div>
      {nota !== undefined && <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">{nota}</p>}
    </fieldset>
  );
}
