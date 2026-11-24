// Clasificación visual de dispositivos por el sufijo del daemonId y conteos del resumen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificarDispositivo, contarPorTipo, NOMBRE_TIPO_DISPOSITIVO } from "../src/utilidades/tipoDispositivo.ts";
import { resumirServidores } from "../src/utilidades/resumen.ts";

const PREFIJO = "followup-local-01";
/** Los 10 dispositivos que deriva followup-daemon con su prefijo por defecto. */
const DIEZ = [
  `${PREFIJO}-pc-01`,
  `${PREFIJO}-pc-02`,
  ...Array.from({ length: 8 }, (_, i) => `${PREFIJO}-cam-0${i + 1}`),
];

function equipos(identificadores, offline = []) {
  return identificadores.map((daemonId) => ({ daemonId, status: offline.includes(daemonId) ? "offline" : "online" }));
}

test("clasifica computadores y cámaras IP por el sufijo completo", () => {
  assert.equal(clasificarDispositivo("followup-local-01-pc-01"), "computador");
  assert.equal(clasificarDispositivo("followup-local-01-pc-99"), "computador");
  assert.equal(clasificarDispositivo("followup-local-01-cam-08"), "camara");
  assert.equal(clasificarDispositivo("followup-local-01-cam-00"), "camara");
});

test("no asume un prefijo fijo", () => {
  assert.equal(clasificarDispositivo("tienda-norte-pc-03"), "computador");
  assert.equal(clasificarDispositivo("x-cam-12"), "camara");
  assert.equal(clasificarDispositivo("a.b_c-cam-01"), "camara");
  // Solo cuenta el final: un "-pc-NN" intermedio no decide el tipo.
  assert.equal(clasificarDispositivo("sede-pc-01-cam-02"), "camara");
});

test("deja sin clasificar el registro histórico y los identificadores que no cumplen el sufijo", () => {
  const sinClasificar = [
    "followup-local-01",
    "followup-local-02",
    "followup-tienda-03",
    "pc-01", // sin prefijo
    "-pc-01", // prefijo vacío
    "followup-local-01-pc-1", // un dígito
    "followup-local-01-cam-001", // tres dígitos
    "followup-local-01-PC-01", // mayúsculas
    "followup-local-01-cam-0a",
    "followup-local-01-cam-01-",
    "followup-local-01-camara-01",
    "followup-local-01-pc01",
    "followup-local-01_pc-01",
    "followup-local-01-pc-٠١", // dígitos no ASCII
    "",
  ];
  for (const daemonId of sinClasificar) {
    assert.equal(clasificarDispositivo(daemonId), "sin-clasificar", JSON.stringify(daemonId));
  }
});

test("nombres visibles de cada tipo", () => {
  assert.deepEqual(NOMBRE_TIPO_DISPOSITIVO, {
    computador: "Computador",
    camara: "Cámara IP",
    "sin-clasificar": "Sin clasificar",
  });
});

test("resumen con los 10 dispositivos", () => {
  const lista = equipos(DIEZ, [`${PREFIJO}-cam-07`]);
  assert.deepEqual(contarPorTipo(lista), { computadores: 2, camaras: 8, sinClasificar: 0 });
  assert.deepEqual(resumirServidores(lista), { registrados: 10, online: 9, offline: 1 });
});

test("resumen con 11 registros: los 10 dispositivos y el histórico sin clasificar", () => {
  const lista = equipos([PREFIJO, ...DIEZ], [PREFIJO]);
  assert.deepEqual(contarPorTipo(lista), { computadores: 2, camaras: 8, sinClasificar: 1 });
  assert.deepEqual(resumirServidores(lista), { registrados: 11, online: 10, offline: 1 });
});

test("inventario vacío", () => {
  assert.deepEqual(contarPorTipo([]), { computadores: 0, camaras: 0, sinClasificar: 0 });
  assert.deepEqual(resumirServidores([]), { registrados: 0, online: 0, offline: 0 });
});

test("los conteos se calculan con cualquier cantidad y siempre suman el total", () => {
  const lista = equipos([...DIEZ, `${PREFIJO}-cam-09`, "otro-pc-03", "nuevo-equipo", "legado"]);
  const conteo = contarPorTipo(lista);
  assert.deepEqual(conteo, { computadores: 3, camaras: 9, sinClasificar: 2 });
  assert.equal(conteo.computadores + conteo.camaras + conteo.sinClasificar, lista.length);
});

test("el tipo no altera el estado: online/offline sale solo del status de la API", () => {
  const lista = equipos([PREFIJO, `${PREFIJO}-pc-01`, `${PREFIJO}-cam-01`], [`${PREFIJO}-pc-01`, `${PREFIJO}-cam-01`]);
  assert.deepEqual(resumirServidores(lista), { registrados: 3, online: 1, offline: 2 });
  // El histórico sin clasificar online se cuenta como online.
  assert.equal(lista[0].status, "online");
});
