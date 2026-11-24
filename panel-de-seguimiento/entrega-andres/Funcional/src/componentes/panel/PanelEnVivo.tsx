"use client";

import { usePanel } from "@/hooks/usePanel";
import { PanelGlobal } from "./PanelGlobal";

/**
 * Conecta PanelGlobal con la API real. Es el único componente cliente del panel:
 * necesita el navegador para consultar la API periódicamente y guardar el estado.
 */
export function PanelEnVivo() {
  const {
    servidores,
    alertasActivas,
    alertasResueltas,
    consultar,
    intervaloMs,
    intervaloResueltasMs,
    advertenciaConfiguracion,
  } = usePanel();
  return (
    <PanelGlobal
      respuesta={servidores.datos}
      conexion={servidores.conexion}
      alertasActivas={alertasActivas}
      alertasResueltas={alertasResueltas}
      origenDatos="api"
      alReintentar={consultar}
      actualizacion={{ intervaloMs, intervaloResueltasMs, advertenciaConfiguracion }}
    />
  );
}
