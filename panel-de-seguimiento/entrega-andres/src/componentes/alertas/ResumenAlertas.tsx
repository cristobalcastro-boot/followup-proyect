import { TarjetaResumen } from "@/componentes/panel/TarjetaResumen";
import type { ConsultaAlertas } from "@/servicios/apiAlertas";
import { esConexionFallida, type FuenteVista } from "@/tipos/conexion";
import { resumirAlertas } from "@/utilidades/alertas";

/**
 * Conteo de alertas activas, calculado solo con la respuesta de alertas activas.
 * Sin datos válidos se muestra "—" (nunca 0, que afirmaría que no hay alertas); con datos
 * anteriores a un fallo, las cifras se marcan como desactualizadas.
 */
export function ResumenAlertas({ activas }: { activas: FuenteVista<ConsultaAlertas> }) {
  const resumen = activas.datos === null ? null : resumirAlertas(activas.datos.respuesta.alerts);
  const fallida = esConexionFallida(activas.conexion);
  const aviso = fallida ? (resumen === null ? "Desconocido" : "Desactualizado") : undefined;

  return (
    <>
      <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Alertas activas
      </h3>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <TarjetaResumen
          titulo="Total activas"
          valor={resumen?.total ?? null}
          descripcion="Según la API"
          tono="neutro"
          compacta
          aviso={aviso}
        />
        <TarjetaResumen
          titulo="Conectividad"
          valor={resumen?.conectividad ?? null}
          descripcion="Sin conexión (crítica)"
          tono="alerta-critica"
          compacta
          aviso={aviso}
        />
        <TarjetaResumen
          titulo="Rendimiento"
          valor={resumen?.rendimiento ?? null}
          descripcion="CPU, RAM o disco (advertencia)"
          tono="alerta-advertencia"
          compacta
          aviso={aviso}
        />
      </div>
    </>
  );
}
