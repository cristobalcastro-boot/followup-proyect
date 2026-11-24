# Proyecto FollowUP

Estructura del workspace local:
- \panel-de-seguimiento/\: Dashboard web en Next.js.
- \panel-de-seguimiento/entrega-andres/\: Archivos recibidos en \GIT_Dashboard.zip\ (\FOLLOWUP-DASHBOARD\, \Funcional\ y \Tests\).
- \seguimiento-api/\: Servidor backend local (\server.js\).

## Cómo ejecutarlo en local

1. **Configurar variables del panel**:
   Crea el archivo \panel-de-seguimiento/.env.local\ con:
   \\\env
   NEXT_PUBLIC_URL_API=http://127.0.0.1:3001
   \\\

2. **Iniciar la API (Terminal 1)**:
   \\\powershell
   cd C:\proyecto-seguimiento\seguimiento-api
   node server.js
   \\\

3. **Instalar dependencias e iniciar el panel (Terminal 2)**:
   \\\powershell
   cd C:\proyecto-seguimiento\panel-de-seguimiento
   npm install
   npm run dev
   \\\

4. **Abrir en el navegador**:
   Entra a \http://localhost:3000\.
