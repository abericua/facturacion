import { useState, useEffect } from 'react';
import { Database, Download, Upload, Trash2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import DB from './db.js';

const T = {
  bg: '#07080f',
  surface: '#0d1117',
  card: '#111827',
  border: '#1a2535',
  accent: '#f59e0b',
  accentBg: 'rgba(245,158,11,0.08)',
  green: '#34d399',
  greenBg: 'rgba(52,211,153,0.08)',
  red: '#f87171',
  redBg: 'rgba(248,113,113,0.08)',
  cyan: '#22d3ee',
  textPrimary: '#e2e8f0',
  textSecondary: '#7d9db5'
};

export default function ConfiguracionDB() {
  const [estado, setEstado] = useState({
    migracionCompleta: false,
    registros: {},
    tamanioEstimado: 0
  });
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    cargarEstado();
  }, []);

  const cargarEstado = async () => {
    try {
      const config = await DB.obtenerConfig('migracion_completada');
      const migracionCompleta = config?.valor || false;

      // Contar registros en cada store
      const registros = {
        iva: (await DB.getAll('finanzas_iva')).length,
        ire: (await DB.getAll('finanzas_ire')).length,
        pl: (await DB.getAll('finanzas_pl')).length,
        cuentas: (await DB.getAll('bancos_cuentas')).length,
        movimientos: (await DB.getAll('bancos_movimientos')).length,
        extractos: (await DB.getAll('bancos_extractos')).length,
        tc: (await DB.getAll('bancos_tc')).length,
        catalogo: (await DB.getAll('catalogos')).length
      };

      setEstado({ migracionCompleta, registros, tamanioEstimado: 0 });
    } catch (error) {
      console.error('Error al cargar estado:', error);
    }
  };

  const migrarDesdeLocalStorage = async () => {
    setMensaje({ tipo: 'info', texto: 'Migrando datos desde localStorage...' });
    try {
      await DB.migrarDesdeLocalStorage();
      setMensaje({ tipo: 'success', texto: 'Migración completada exitosamente' });
      await cargarEstado();
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error en migración: ' + error.message });
    }
  };

  const exportarBackup = async () => {
    setMensaje({ tipo: 'info', texto: 'Generando backup...' });
    try {
      const backup = await DB.exportarBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solpro_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMensaje({ tipo: 'success', texto: 'Backup descargado correctamente' });
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al exportar: ' + error.message });
    }
  };

  const importarBackup = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setMensaje({ tipo: 'info', texto: 'Importando backup...' });
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await DB.importarBackup(backup);
      setMensaje({ tipo: 'success', texto: 'Backup importado correctamente' });
      await cargarEstado();
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al importar: ' + error.message });
    }
  };

  const limpiarBaseDatos = async () => {
    if (!confirm('⚠️ ¿Estás seguro? Esto borrará TODOS los datos guardados. Esta acción no se puede deshacer.')) {
      return;
    }
    if (!confirm('⚠️ ÚLTIMA CONFIRMACIÓN: Se borrarán PDFs, movimientos bancarios, catálogos y toda la información. ¿Continuar?')) {
      return;
    }

    setMensaje({ tipo: 'info', texto: 'Limpiando base de datos...' });
    try {
      await DB.limpiarBaseDatos();
      setMensaje({ tipo: 'success', texto: 'Base de datos limpiada' });
      await cargarEstado();
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al limpiar: ' + error.message });
    }
  };

  return (
    <div style={{ padding: 24, background: T.bg, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Database size={32} color={T.accent} />
          <h1 style={{ margin: 0, fontSize: 28, fontFamily: 'Syne', color: T.textPrimary }}>
            Configuración Base de Datos
          </h1>
        </div>
        <p style={{ margin: 0, color: T.textSecondary, fontFamily: 'DM Sans' }}>
          Gestiona el almacenamiento local IndexedDB
        </p>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div style={{
          padding: 16,
          background: mensaje.tipo === 'success' ? T.greenBg : mensaje.tipo === 'error' ? T.redBg : T.accentBg,
          border: `1px solid ${mensaje.tipo === 'success' ? T.green : mensaje.tipo === 'error' ? T.red : T.accent}`,
          borderRadius: 8,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          {mensaje.tipo === 'success' && <CheckCircle size={20} color={T.green} />}
          {mensaje.tipo === 'error' && <AlertTriangle size={20} color={T.red} />}
          <span style={{ color: T.textPrimary, fontFamily: 'DM Sans' }}>{mensaje.texto}</span>
        </div>
      )}

      {/* Estado actual */}
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontFamily: 'Syne', color: T.textPrimary }}>
          Estado Actual
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <Stat label="IVA Mensual" valor={estado.registros.iva || 0} />
          <Stat label="IRE Anual" valor={estado.registros.ire || 0} />
          <Stat label="P&L Mensual" valor={estado.registros.pl || 0} />
          <Stat label="Cuentas Bancarias" valor={estado.registros.cuentas || 0} />
          <Stat label="Movimientos" valor={estado.registros.movimientos || 0} />
          <Stat label="Extractos PDF" valor={estado.registros.extractos || 0} />
          <Stat label="Tipo Cambio" valor={estado.registros.tc || 0} />
          <Stat label="Catálogos" valor={estado.registros.catalogo || 0} />
        </div>
        
        {estado.migracionCompleta && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: T.greenBg, 
            border: `1px solid ${T.green}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <CheckCircle size={16} color={T.green} />
            <span style={{ fontSize: 14, color: T.green, fontFamily: 'DM Sans' }}>
              Migración desde localStorage completada
            </span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 24
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontFamily: 'Syne', color: T.textPrimary }}>
          Acciones
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* Migrar desde localStorage */}
          <Boton
            icono={<RefreshCw size={18} />}
            texto="Migrar desde localStorage"
            descripcion="Importa datos guardados en localStorage (finanzas_v1, bancos_v2, catalogo_v1)"
            onClick={migrarDesdeLocalStorage}
            color={T.cyan}
          />

          {/* Exportar backup */}
          <Boton
            icono={<Download size={18} />}
            texto="Exportar Backup"
            descripcion="Descarga un archivo JSON con toda la base de datos (incluye PDFs)"
            onClick={exportarBackup}
            color={T.green}
          />

          {/* Importar backup */}
          <label style={{ cursor: 'pointer' }}>
            <input
              type="file"
              accept=".json"
              onChange={importarBackup}
              style={{ display: 'none' }}
            />
            <Boton
              icono={<Upload size={18} />}
              texto="Importar Backup"
              descripcion="Restaura datos desde un archivo de backup JSON"
              color={T.accent}
              isLabel={true}
            />
          </label>

          {/* Limpiar base de datos */}
          <Boton
            icono={<Trash2 size={18} />}
            texto="Limpiar Base de Datos"
            descripcion="⚠️ PELIGRO: Borra todos los datos guardados"
            onClick={limpiarBaseDatos}
            color={T.red}
          />
        </div>
      </div>

      {/* Info técnica */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8
      }}>
        <p style={{ margin: '0 0 8px 0', fontSize: 13, fontFamily: 'Syne', color: T.textSecondary }}>
          ℹ️ Información Técnica
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: T.textSecondary, fontFamily: 'DM Sans' }}>
          <li>IndexedDB puede almacenar hasta ~500 MB - 1 GB de datos</li>
          <li>Los PDFs se guardan en formato base64</li>
          <li>Los datos persisten incluso si cierras el navegador</li>
          <li>Se recomienda hacer backup mensual</li>
          <li>Los backups se pueden transferir a otra computadora</li>
        </ul>
      </div>
    </div>
  );
}

// ── COMPONENTES AUXILIARES ─────────────────────────────────────────────────

function Stat({ label, valor }) {
  return (
    <div style={{
      padding: 12,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 8
    }}>
      <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: 'DM Sans', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, color: T.accent, fontFamily: 'Syne', fontWeight: 700 }}>
        {valor}
      </div>
    </div>
  );
}

function Boton({ icono, texto, descripcion, onClick, color, isLabel }) {
  const Component = isLabel ? 'div' : 'button';
  return (
    <Component
      onClick={!isLabel ? onClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'DM Sans'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.card;
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = T.surface;
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      <div style={{ color }}>{icono}</div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500, marginBottom: 4 }}>
          {texto}
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary }}>
          {descripcion}
        </div>
      </div>
    </Component>
  );
}
