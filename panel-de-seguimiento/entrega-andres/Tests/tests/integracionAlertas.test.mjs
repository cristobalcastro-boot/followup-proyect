// Integración inventario-alertas y filtros locales (D4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  agruparAlertasActivas,
  alertasDeDispositivo,
  alertasSinDispositivo,
  disponibilidadAlertas,
  filtrarAlertasPorCategoria,
  FILTROS_ALERTAS_INICIALES,
  gruposAlertasVisibles,
  SIN_ALERTAS_DISPOSITIVO,
} from "../src/utilidades/alertas.ts";
import {
  filtrarInventario,
  FILTROS_INVENTARIO_INICIALES,
  hayFiltrosInventario,
} from "../src/utilidades/filtrosInventario.ts";
import { clasificarDispositivo } from "../src/utilidades/tipoDispositivo.ts";

const P = "followup-local-01";

function alerta(daemonId, kind, status = "active") {
  return { daemonId, kind, status };
}

function equipo(daemonId, status = "online", cpu = 20) {
  return { daemonId, status, latestReport: { resources: { cpuUsagePercent: cpu } } };
}

/** Congela en profundidad para detectar cualquier modificación de los datos recibidos. */
function congelar(valor) {
  if (typeof valor === "object" && valor !== null) {
    Object.values(valor).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
}

const INVENTARIO = congelar([
  equipo(P, "offline"),
  equipo(`${P}-cam-03`, "online", 89.6),
  equipo(`${P}-cam-07`, "offline"),
  equipo(`${P}-pc-01`, "online", 99.9),
  equipo(`${P}-pc-02`, "online"),
]);

const ACTIVAS = congelar([
  alerta(P, "offline"),
  alerta(`${P}-cam-07`, "offline"),
  alerta(`${P}-cam-03`, "cpu_high"),
  alerta(`${P}-pc-02`, "memory_high"),
  alerta(`${P}-pc-02`, "disk_high"),
]);

const contexto = (alertasActivas) => ({ tipoDe: clasificarDispositivo, alertasActivas });

test("asocia las alertas activas por daemonId y cuenta las de cada dispositivo", () => {
  const mapa = agruparAlertasActivas(ACTIVAS);
  assert.equal(mapa.size, 4);
  assert.deepEqual(alertasDeDispositivo(mapa, `${P}-pc-02`), {
    total: 2,
    offline: false,
    cpu: false,
    ram: true,
    disco: true,
  });
  assert.equal(alertasDeDispositivo(mapa, `${P}-cam-07`).total, 1);
  assert.deepEqual(alertasDeDispositivo(mapa, `${P}-pc-01`), SIN_ALERTAS_DISPOSITIVO, "sin alertas si no figura");
});

test("resalta CPU, RAM y disco solo con la alerta del tipo correspondiente", () => {
  const mapa = agruparAlertasActivas(ACTIVAS);
  const cam03 = alertasDeDispositivo(mapa, `${P}-cam-03`);
  assert.deepEqual([cam03.cpu, cam03.ram, cam03.disco], [true, false, false]);
  const pc02 = alertasDeDispositivo(mapa, `${P}-pc-02`);
  assert.deepEqual([pc02.cpu, pc02.ram, pc02.disco], [false, true, true]);
});

test("la alerta offline se indica aparte y no cambia el status de /servers", () => {
  const mapa = agruparAlertasActivas([alerta(`${P}-cam-07`, "offline")]);
  const cam07 = alertasDeDispositivo(mapa, `${P}-cam-07`);
  assert.equal(cam07.offline, true);
  assert.deepEqual([cam07.cpu, cam07.ram, cam07.disco], [false, false, false]);
  // Un equipo online con alerta offline (la API aún no la resolvió) sigue contando como online.
  const online = filtrarInventario([equipo(`${P}-cam-07`, "online")], { ...FILTROS_INVENTARIO_INICIALES, estado: "online" }, contexto(mapa));
  assert.equal(online.length, 1);
});

test("ignora las alertas resueltas al relacionarlas con los dispositivos", () => {
  const mapa = agruparAlertasActivas([alerta(`${P}-cam-03`, "cpu_high", "resolved")]);
  assert.equal(mapa.size, 0);
});

test("sin umbrales locales: el resaltado depende solo de las alertas, no de los porcentajes", () => {
  const mapa = agruparAlertasActivas(ACTIVAS);
  // pc-01 tiene 99,9 % de CPU y ninguna alerta: no es anomalía.
  assert.equal(alertasDeDispositivo(mapa, `${P}-pc-01`).cpu, false);
  // Un equipo con CPU baja y alerta cpu_high sí se resalta.
  const conAlerta = agruparAlertasActivas([alerta(`${P}-cam-05`, "cpu_high")]);
  assert.equal(alertasDeDispositivo(conAlerta, `${P}-cam-05`).cpu, true);
});

test("identifica alertas sin dispositivo en el inventario, sin descartarlas", () => {
  const ajena = alerta("followup-sede-02-cam-01", "offline");
  const todas = [...ACTIVAS, ajena];
  assert.deepEqual(alertasSinDispositivo(todas, INVENTARIO.map((e) => e.daemonId)), [ajena]);
  assert.equal(todas.length, ACTIVAS.length + 1, "la lista original no cambia");
  assert.deepEqual(alertasSinDispositivo(ACTIVAS, INVENTARIO.map((e) => e.daemonId)), []);
});

test("disponibilidad de alertas: desconocida, desactualizada o disponible", () => {
  assert.equal(disponibilidadAlertas(false, false), "desconocida", "cargando: no equivale a cero alertas");
  assert.equal(disponibilidadAlertas(false, true), "desconocida", "fallo sin datos previos");
  assert.equal(disponibilidadAlertas(true, true), "desactualizada");
  assert.equal(disponibilidadAlertas(true, false), "disponible");
});

test("filtros individuales del inventario: estado, tipo y alertas", () => {
  const mapa = agruparAlertasActivas(ACTIVAS);
  const ids = (filtros) =>
    filtrarInventario(INVENTARIO, { ...FILTROS_INVENTARIO_INICIALES, ...filtros }, contexto(mapa)).map((e) => e.daemonId);
  assert.equal(ids({}).length, 5);
  assert.deepEqual(ids({ estado: "offline" }), [P, `${P}-cam-07`]);
  assert.deepEqual(ids({ estado: "online" }), [`${P}-cam-03`, `${P}-pc-01`, `${P}-pc-02`]);
  assert.deepEqual(ids({ tipo: "computador" }), [`${P}-pc-01`, `${P}-pc-02`]);
  assert.deepEqual(ids({ tipo: "camara" }), [`${P}-cam-03`, `${P}-cam-07`]);
  assert.deepEqual(ids({ tipo: "sin-clasificar" }), [P]);
  assert.deepEqual(ids({ alertas: "con-alertas" }), [P, `${P}-cam-03`, `${P}-cam-07`, `${P}-pc-02`]);
});

test("filtros combinados (Y lógico)", () => {
  const mapa = agruparAlertasActivas(ACTIVAS);
  const filtrar = (filtros) => filtrarInventario(INVENTARIO, filtros, contexto(mapa)).map((e) => e.daemonId);
  assert.deepEqual(filtrar({ estado: "online", tipo: "camara", alertas: "con-alertas" }), [`${P}-cam-03`]);
  assert.deepEqual(filtrar({ estado: "offline", tipo: "camara", alertas: "todos" }), [`${P}-cam-07`]);
  assert.deepEqual(filtrar({ estado: "online", tipo: "computador", alertas: "con-alertas" }), [`${P}-pc-02`]);
});

test("resultados vacíos por filtro e inventario vacío", () => {
  const mapa = agruparAlertasActivas(ACTIVAS);
  assert.deepEqual(
    filtrarInventario(INVENTARIO, { estado: "offline", tipo: "computador", alertas: "todos" }, contexto(mapa)),
    [],
  );
  assert.deepEqual(filtrarInventario([], { estado: "online", tipo: "camara", alertas: "con-alertas" }, contexto(mapa)), []);
  assert.deepEqual(filtrarInventario([], FILTROS_INVENTARIO_INICIALES, contexto(null)), []);
});

test("con alertas desconocidas, «con alertas activas» no afirma nada y los demás filtros siguen funcionando", () => {
  assert.deepEqual(filtrarInventario(INVENTARIO, { ...FILTROS_INVENTARIO_INICIALES, alertas: "con-alertas" }, contexto(null)), []);
  assert.equal(filtrarInventario(INVENTARIO, { ...FILTROS_INVENTARIO_INICIALES, tipo: "camara" }, contexto(null)).length, 2);
});

test("los filtros no modifican los datos originales y devuelven listas nuevas", () => {
  const copia = JSON.stringify(INVENTARIO);
  const mapa = agruparAlertasActivas(ACTIVAS); // ACTIVAS e INVENTARIO están congelados: modificar lanzaría
  const visibles = filtrarInventario(INVENTARIO, FILTROS_INVENTARIO_INICIALES, contexto(mapa));
  assert.notEqual(visibles, INVENTARIO);
  assert.equal(JSON.stringify(INVENTARIO), copia);
  assert.equal(INVENTARIO[3].latestReport.resources.cpuUsagePercent, 99.9, "los valores numéricos no cambian");
  const alertas = filtrarAlertasPorCategoria(ACTIVAS, "todas");
  assert.notEqual(alertas, ACTIVAS);
  assert.deepEqual(alertas, [...ACTIVAS]);
});

test("detecta si hay filtros de inventario aplicados", () => {
  assert.equal(hayFiltrosInventario(FILTROS_INVENTARIO_INICIALES), false);
  assert.equal(hayFiltrosInventario({ ...FILTROS_INVENTARIO_INICIALES, tipo: "camara" }), true);
});

test("filtros del panel de alertas: grupos activas, resueltas y todas las disponibles", () => {
  assert.deepEqual(FILTROS_ALERTAS_INICIALES, { estado: "todas", categoria: "todas" });
  assert.deepEqual(gruposAlertasVisibles("todas"), { activas: true, resueltas: true });
  assert.deepEqual(gruposAlertasVisibles("activas"), { activas: true, resueltas: false });
  assert.deepEqual(gruposAlertasVisibles("resueltas"), { activas: false, resueltas: true });
});

test("filtro por categoría: conectividad y rendimiento, en activas y en resueltas", () => {
  const resueltas = congelar([alerta(`${P}-cam-07`, "offline", "resolved"), alerta(`${P}-pc-01`, "cpu_high", "resolved")]);
  assert.deepEqual(filtrarAlertasPorCategoria(ACTIVAS, "conectividad").map((a) => a.kind), ["offline", "offline"]);
  assert.deepEqual(filtrarAlertasPorCategoria(ACTIVAS, "rendimiento").map((a) => a.kind), ["cpu_high", "memory_high", "disk_high"]);
  assert.deepEqual(filtrarAlertasPorCategoria(resueltas, "conectividad").map((a) => a.daemonId), [`${P}-cam-07`]);
  assert.deepEqual(filtrarAlertasPorCategoria(resueltas, "rendimiento").map((a) => a.daemonId), [`${P}-pc-01`]);
  assert.deepEqual(filtrarAlertasPorCategoria([], "rendimiento"), []);
});

test("el código del dashboard no compara métricas con umbrales propios", () => {
  const raiz = new URL("../src/", import.meta.url);
  const archivos = readdirSync(raiz, { recursive: true })
    .filter((ruta) => /\.(ts|tsx)$/.test(ruta))
    // Los datos ficticios de /demostracion no deciden nada en la interfaz.
    .filter((ruta) => !ruta.split(/[\\/]/).includes("demostracion"));
  assert.ok(archivos.length > 20);
  const patrones = [
    /(UsagePercent|observedValue|threshold)\s*[<>]=?/, // métrica o umbral a la izquierda de una comparación
    /[<>]=?\s*[\w.?]*(UsagePercent|observedValue|threshold)\b/, // o a la derecha
    /[<>]=?\s*(8\d|9\d)(\.\d+)?\b/, // comparación con un número del rango de los umbrales (85, 90…)
  ];
  const hallazgos = [];
  for (const archivo of archivos) {
    const lineas = readFileSync(join(raiz.pathname.replace(/^\/([A-Za-z]:)/, "$1"), archivo), "utf8").split("\n");
    lineas.forEach((linea, i) => {
      if (patrones.some((patron) => patron.test(linea))) {
        hallazgos.push(`${relative(".", archivo)}:${i + 1}: ${linea.trim()}`);
      }
    });
  }
  assert.deepEqual(hallazgos, []);
});
