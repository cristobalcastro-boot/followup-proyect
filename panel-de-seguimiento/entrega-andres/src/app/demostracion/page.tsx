import type { Metadata } from "next";
import { PanelGlobal } from "@/componentes/panel/PanelGlobal";
import { obtenerEscenario } from "@/demostracion/escenarios";
import { SelectorEscenario } from "@/demostracion/SelectorEscenario";

export const metadata: Metadata = {
  title: "FollowUP · Escenarios demostrativos",
};

/**
 * Escenarios visuales ficticios (creados en A3.2), elegidos con ?escenario=<id>.
 * No consulta la API: sirve para revisar todos los estados de la interfaz.
 */
export default async function PaginaDemostracion({ searchParams }: PageProps<"/demostracion">) {
  const { escenario } = await searchParams;
  const seleccionado = obtenerEscenario(typeof escenario === "string" ? escenario : undefined);

  return (
    <>
      <SelectorEscenario escenarioActual={seleccionado.id} />
      <PanelGlobal
        respuesta={seleccionado.respuesta}
        conexion={seleccionado.conexion}
        alertasActivas={seleccionado.alertasActivas}
        alertasResueltas={seleccionado.alertasResueltas}
        origenDatos="demostracion"
      />
    </>
  );
}
