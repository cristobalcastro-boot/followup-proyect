// Presentación de alertas: etiquetas de tipos, severidades y estados, y conteos del resumen.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esAlertaConectividad,
  ETIQUETA_ESTADO_ALERTA,
  ETIQUETA_SEVERIDAD,
  ETIQUETA_TIPO_ALERTA,
  resumirAlertas,
} from "../src/utilidades/alertas.ts";

test("etiquetas de los tipos de alerta del contrato", () => {
  assert.deepEqual(ETIQUETA_TIPO_ALERTA, {
    cpu_high: "CPU alta",
    memory_high: "RAM alta",
    disk_high: "Disco alto",
    offline: "Sin conexión",
  });
});

test("etiquetas de severidades y estados", () => {
  assert.deepEqual(ETIQUETA_SEVERIDAD, { warning: "Advertencia", critical: "Crítica" });
  assert.deepEqual(ETIQUETA_ESTADO_ALERTA, { active: "Activa", resolved: "Resuelta" });
});

test("solo offline es una alerta de conectividad", () => {
  assert.equal(esAlertaConectividad({ kind: "offline" }), true);
  for (const kind of ["cpu_high", "memory_high", "disk_high"]) {
    assert.equal(esAlertaConectividad({ kind }), false, kind);
  }
});

test("conteos de alertas activas: total, conectividad y rendimiento", () => {
  const alertas = ["offline", "offline", "cpu_high", "memory_high", "disk_high"].map((kind) => ({ kind }));
  assert.deepEqual(resumirAlertas(alertas), { total: 5, conectividad: 2, rendimiento: 3 });
  assert.deepEqual(resumirAlertas([{ kind: "offline" }]), { total: 1, conectividad: 1, rendimiento: 0 });
});

test("sin alertas activas, los conteos son cero (solo con una respuesta válida)", () => {
  assert.deepEqual(resumirAlertas([]), { total: 0, conectividad: 0, rendimiento: 0 });
});
