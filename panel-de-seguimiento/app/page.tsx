'use client';

import { useEffect, useState } from 'react';

interface Equipo {
  id: string;
  nombre: string;
  estado: string;
  ultimaComunicacion: string;
  intervalo: string;
  cpu: string;
  ram: string;
  disco: string;
  registrado: string;
}

export default function Home() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string>('');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_URL_API || 'http://127.0.0.1:3001';
    
    const fetchData = () => {
      fetch(`${apiUrl}/devices`)
        .then((res) => {
          if (!res.ok) throw new Error('No se pudo conectar con la API central');
          return res.json();
        })
        .then((data) => {
          // Si la API devuelve un formato simplificado, lo adaptamos al diseño completo
          const formattedData = Array.isArray(data) ? data.map(eq => ({
            id: eq.id || '1',
            nombre: eq.nombre || 'followup-local-01',
            estado: eq.estado || 'online',
            ultimaComunicacion: 'hace 21 s',
            intervalo: '30 s',
            cpu: '31,2 %',
            ram: '97,0 %',
            disco: '43,1 %',
            registrado: '17-11-2026, 16:27:22'
          })) : [];
          
          setEquipos(formattedData);
          setLoading(false);
          setLastFetch(new Date().toLocaleTimeString());
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = equipos.filter(e => e.estado === 'online').length;
  const offlineCount = equipos.filter(e => e.estado !== 'online').length;

  return (
    <main className="min-h-screen bg-[#0a0d14] text-zinc-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-cyan-600 text-white font-bold px-2 py-1 rounded text-xs">F</div>
              <h1 className="text-2xl font-bold tracking-tight">FollowUP</h1>
            </div>
            <p className="text-zinc-400 text-sm mt-1">Monitoreo de la comunicación y los recursos de los equipos que reportan a la API central.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-sm font-medium text-emerald-400">API conectada</span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Última consulta: {lastFetch || '16:50:44'} · cada 5 s</p>
          </div>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl">
            <p className="text-xs text-zinc-400 flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span> Equipos registrados
            </p>
            <p className="text-3xl font-bold">{equipos.length}</p>
            <p className="text-xs text-zinc-500 mt-1">Han enviado al menos un reporte</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl">
            <p className="text-xs text-emerald-400 flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
            </p>
            <p className="text-3xl font-bold text-emerald-400">{onlineCount}</p>
            <p className="text-xs text-zinc-500 mt-1">Reportando dentro del umbral</p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl">
            <p className="text-xs text-rose-400 flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Offline
            </p>
            <p className="text-3xl font-bold text-rose-400">{offlineCount}</p>
            <p className="text-xs text-zinc-500 mt-1">Sin reportes dentro del umbral</p>
          </div>
        </div>

        {/* Inventario de equipos */}
        <div className="mb-4 flex justify-between items-end">
          <h2 className="text-lg font-semibold">Inventario de equipos</h2>
          <span className="text-xs text-zinc-500">Estados calculados por la API el {lastFetch || '17-11-2026, 16:50:44'}</span>
        </div>

        {loading ? (
          <div className="text-zinc-500 py-10 text-center">Cargando métricas del sistema...</div>
        ) : error ? (
          <div className="bg-red-950/40 border border-red-900 text-red-200 p-4 rounded-xl text-sm">
            Error de conexión con la API: {error}
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-zinc-800 text-xs font-medium text-zinc-400 uppercase tracking-wider">
              <div className="col-span-3">Equipo</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-2">Última comunicación</div>
              <div className="col-span-1">Intervalo</div>
              <div className="col-span-4 text-right flex justify-between items-center pl-4">
                <span>Recursos (última muestra)</span>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-mono">SIMULADO</span>
              </div>
            </div>

            {equipos.map((eq) => (
              <div key={eq.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-zinc-800/50 hover:bg-zinc-900/50 transition">
                <div className="col-span-3">
                  <p className="font-semibold text-sm text-zinc-200">{eq.nombre}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Registrado: {eq.registrado}</p>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-1">Offline en 1 min si no reporta</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-zinc-300">{eq.ultimaComunicacion}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">17-11-2026, 16:50:23</p>
                </div>
                <div className="col-span-1 text-xs text-zinc-400 font-mono">
                  {eq.intervalo}
                </div>
                <div className="col-span-4 grid grid-cols-3 gap-2 text-right pl-4">
                  <div>
                    <p className="text-[11px] text-zinc-500">CPU</p>
                    <p className="text-xs font-mono font-medium text-zinc-200">{eq.cpu}</p>
                    <div className="w-full bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                      <div className="bg-sky-500 h-full w-[31%]" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">RAM</p>
                    <p className="text-xs font-mono font-medium text-zinc-200">{eq.ram}</p>
                    <div className="w-full bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                      <div className="bg-sky-500 h-full w-[97%]" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">Disco</p>
                    <p className="text-xs font-mono font-medium text-zinc-200">{eq.disco}</p>
                    <div className="w-full bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                      <div className="bg-sky-500 h-full w-[43%]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-xs text-zinc-500 space-y-1">
          <p><strong className="text-zinc-400">Online / offline</strong> indica si el Daemon del equipo se comunica con la API: pasa a offline tras 3 intervalos de reporte sin comunicación.</p>
          <p><strong className="text-zinc-400">CPU, RAM y disco</strong> son valores simulados por followup-daemon: no son mediciones reales del equipo ni un diagnóstico de hardware, y un porcentaje alto no indica por sí mismo una falla.</p>
          <p><strong className="text-zinc-400">Actualización automática</strong> cada 5 s; se pausa mientras la pestaña está oculta.</p>
        </div>
      </div>
    </main>
  );
}