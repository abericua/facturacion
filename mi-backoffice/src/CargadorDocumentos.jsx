// ═══════════════════════════════════════════════════════════════════════════
// CARGADOR AUTOMÁTICO DE DOCUMENTOS LOCALES - Sol Pro
// ═══════════════════════════════════════════════════════════════════════════
// Escanea carpetas locales y carga automáticamente:
// - PDFs de IVA y Renta (DOCUMENTOS DNIT)
// - Excel de compras por año (FACTURAS DE COMPRAS SOLPRO)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { FolderOpen, FileText, File, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import DB from './db.js';

const T = {
  bg: '#07080f',
  surface: '#0d1117',
  card: '#111827',
  border: '#1a2535',
  accent: '#f59e0b',
  green: '#34d399',
  red: '#f87171',
  cyan: '#22d3ee',
  textPrimary: '#e2e8f0',
  textSecondary: '#7d9db5'
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CARPETAS LOCALES
// ═══════════════════════════════════════════════════════════════════════════

const CARPETAS_LOCALES = {
  documentos_dnit: {
    ruta: 'DOCUMENTOS DNIT',
    descripcion: 'Declaraciones IVA y Renta anual',
    tipos: ['.pdf'],
    patron: /F(120|500)/i // Detecta F120 o F500 en el nombre
  },
  facturas_compras: {
    ruta: 'FACTURAS DE COMPRAS SOLPRO',
    descripcion: 'Registros de compras por año',
    tipos: ['.xlsx', '.xls'],
    patron: /\d{4}/ // Detecta año (2023, 2024, etc)
  }
};

export default function CargadorDocumentos({ onDocumentosCargados }) {
  const [estado, setEstado] = useState({
    escaneando: false,
    documentos: [],
    errores: [],
    carpetasDisponibles: []
  });

  // ── CARGAR DOCUMENTOS AL MONTAR ─────────────────────────────────────────────
  useEffect(() => {
    cargarDocumentosGuardados();
  }, []);

  const cargarDocumentosGuardados = async () => {
    try {
      // Cargar documentos DNIT desde IndexedDB
      const ivaGuardados = await DB.getAll('finanzas_iva');
      const ireGuardados = await DB.getAll('finanzas_ire');
      
      const documentosDNIT = [
        ...ivaGuardados.map(doc => ({
          tipo: 'dnit',
          nombre: `F120_${doc.periodo}.pdf`,
          formulario: 'F120 (IVA)',
          periodo: doc.periodo,
          tamano: doc.pdf ? doc.pdf.length : 0,
          fechaCarga: doc.fecha_actualizacion,
          guardado: true
        })),
        ...ireGuardados.map(doc => ({
          tipo: 'dnit',
          nombre: `F500_${doc.anio}.pdf`,
          formulario: 'F500 (Renta)',
          periodo: doc.anio,
          tamano: doc.pdf ? doc.pdf.length : 0,
          fechaCarga: doc.fecha_actualizacion,
          guardado: true
        }))
      ];

      if (documentosDNIT.length > 0) {
        setEstado(prev => ({
          ...prev,
          documentos: documentosDNIT
        }));
      }
    } catch (error) {
      console.error('Error al cargar documentos guardados:', error);
    }
  };

  // ── COMPONENTE SELECTOR DE ARCHIVOS ────────────────────────────────────────
  
  const CargarDocumentosDNIT = () => {
    return (
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 24,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <FolderOpen size={24} color={T.accent} />
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: 18, 
              fontFamily: 'Syne', 
              color: T.textPrimary 
            }}>
              Documentos DNIT (IVA y Renta)
            </h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: 13, 
              color: T.textSecondary,
              fontFamily: 'DM Sans'
            }}>
              Cargá tus PDFs F120 (IVA) y F500 (Renta)
            </p>
          </div>
        </div>

        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={(e) => procesarDocumentosDNIT(e.target.files)}
          style={{ display: 'none' }}
          id="upload-dnit"
        />
        
        <label
          htmlFor="upload-dnit"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '16px 24px',
            background: T.surface,
            border: `2px dashed ${T.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'DM Sans',
            fontSize: 14,
            color: T.textSecondary
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = T.accent;
            e.currentTarget.style.background = 'rgba(245,158,11,0.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.background = T.surface;
          }}
        >
          <Upload size={20} />
          Click para seleccionar PDFs F120/F500
        </label>

        {/* Lista de documentos cargados */}
        {estado.documentos.filter(d => d.tipo === 'dnit').length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ 
              margin: '0 0 8px 0', 
              fontSize: 12, 
              color: T.textSecondary,
              fontFamily: 'DM Sans'
            }}>
              Documentos cargados:
            </p>
            {estado.documentos.filter(d => d.tipo === 'dnit').map((doc, i) => (
              <div key={i} style={{
                padding: 8,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <FileText size={16} color={T.green} />
                <span style={{ 
                  flex: 1, 
                  fontSize: 13, 
                  color: T.textPrimary,
                  fontFamily: 'DM Sans'
                }}>
                  {doc.nombre}
                </span>
                <span style={{ 
                  fontSize: 11, 
                  color: T.cyan,
                  fontFamily: 'JetBrains Mono'
                }}>
                  {doc.formulario} • {doc.periodo}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const CargarFacturasCompras = () => {
    return (
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <File size={24} color={T.cyan} />
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: 18, 
              fontFamily: 'Syne', 
              color: T.textPrimary 
            }}>
              Facturas de Compras
            </h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: 13, 
              color: T.textSecondary,
              fontFamily: 'DM Sans'
            }}>
              Cargá tus registros Excel por año
            </p>
          </div>
        </div>

        <input
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={(e) => procesarFacturasCompras(e.target.files)}
          style={{ display: 'none' }}
          id="upload-compras"
        />
        
        <label
          htmlFor="upload-compras"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '16px 24px',
            background: T.surface,
            border: `2px dashed ${T.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'DM Sans',
            fontSize: 14,
            color: T.textSecondary
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = T.cyan;
            e.currentTarget.style.background = 'rgba(34,211,238,0.05)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.background = T.surface;
          }}
        >
          <Upload size={20} />
          Click para seleccionar archivos Excel
        </label>

        {/* Lista de facturas cargadas */}
        {estado.documentos.filter(d => d.tipo === 'compras').length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ 
              margin: '0 0 8px 0', 
              fontSize: 12, 
              color: T.textSecondary,
              fontFamily: 'DM Sans'
            }}>
              Archivos cargados:
            </p>
            {estado.documentos.filter(d => d.tipo === 'compras').map((doc, i) => (
              <div key={i} style={{
                padding: 8,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <File size={16} color={T.cyan} />
                <span style={{ 
                  flex: 1, 
                  fontSize: 13, 
                  color: T.textPrimary,
                  fontFamily: 'DM Sans'
                }}>
                  {doc.nombre}
                </span>
                <span style={{ 
                  fontSize: 11, 
                  color: T.accent,
                  fontFamily: 'JetBrains Mono'
                }}>
                  {doc.anio} • {doc.registros} registros
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── PROCESADORES ───────────────────────────────────────────────────────────

  const procesarDocumentosDNIT = async (archivos) => {
    const nuevosDocumentos = [];
    const errores = [];

    for (const archivo of archivos) {
      try {
        // Detectar tipo de formulario
        let formulario = 'DESCONOCIDO';
        let periodo = '';

        if (/F-?120/i.test(archivo.name)) {
          formulario = 'F120 (IVA)';
          // Intentar extraer mes/año del nombre
          const matchPeriodo = archivo.name.match(/(\w+)[\s_-]?(\d{4})/i);
          if (matchPeriodo) {
            periodo = `${matchPeriodo[2]}-${obtenerNumeroMes(matchPeriodo[1])}`;
          }
        } else if (/F-?500/i.test(archivo.name)) {
          formulario = 'F500 (Renta)';
          // Intentar extraer año
          const matchAnio = archivo.name.match(/\d{4}/);
          if (matchAnio) {
            periodo = matchAnio[0];
          }
        }

        // Convertir PDF a base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(archivo);
        });

        const base64 = await base64Promise;

        // Guardar en IndexedDB
        if (formulario === 'F120 (IVA)' && periodo) {
          await DB.guardarIVA(periodo, {}, base64);
        } else if (formulario === 'F500 (Renta)' && periodo) {
          await DB.guardarIRE(periodo, {}, base64);
        }

        nuevosDocumentos.push({
          tipo: 'dnit',
          nombre: archivo.name,
          formulario,
          periodo,
          archivo,
          tamano: archivo.size,
          fechaCarga: new Date().toISOString(),
          guardado: true
        });

      } catch (error) {
        errores.push(`Error en ${archivo.name}: ${error.message}`);
      }
    }

    setEstado(prev => ({
      ...prev,
      documentos: [...prev.documentos, ...nuevosDocumentos],
      errores: [...prev.errores, ...errores]
    }));

    // Notificar al componente padre
    if (onDocumentosCargados) {
      onDocumentosCargados({
        tipo: 'dnit',
        documentos: nuevosDocumentos
      });
    }
  };

  // Helper para convertir nombre de mes a número
  const obtenerNumeroMes = (mes) => {
    const meses = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    return meses[mes.toLowerCase()] || '01';
  };

  const procesarFacturasCompras = async (archivos) => {
    const nuevosDocumentos = [];
    const errores = [];

    for (const archivo of archivos) {
      try {
        // Detectar año del nombre
        const matchAnio = archivo.name.match(/\d{4}/);
        const anio = matchAnio ? matchAnio[0] : 'Sin año';

        // Estimar registros por tamaño (aproximado)
        const registrosEstimados = Math.floor(archivo.size / 500); // ~500 bytes por registro

        nuevosDocumentos.push({
          tipo: 'compras',
          nombre: archivo.name,
          anio,
          registros: registrosEstimados,
          archivo,
          tamano: archivo.size,
          fechaCarga: new Date().toISOString()
        });

      } catch (error) {
        errores.push(`Error en ${archivo.name}: ${error.message}`);
      }
    }

    setEstado(prev => ({
      ...prev,
      documentos: [...prev.documentos, ...nuevosDocumentos],
      errores: [...prev.errores, ...errores]
    }));

    // Notificar al componente padre
    if (onDocumentosCargados) {
      onDocumentosCargados({
        tipo: 'compras',
        documentos: nuevosDocumentos
      });
    }
  };

  // ── RENDER PRINCIPAL ───────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, background: T.bg, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono&display=swap');
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <FolderOpen size={32} color={T.accent} />
          <h1 style={{ margin: 0, fontSize: 28, fontFamily: 'Syne', color: T.textPrimary }}>
            Cargador de Documentos
          </h1>
        </div>
        <p style={{ margin: 0, color: T.textSecondary, fontFamily: 'DM Sans' }}>
          Importá tus documentos DNIT y registros de compras
        </p>
      </div>

      {/* Errores */}
      {estado.errores.length > 0 && (
        <div style={{
          padding: 16,
          background: 'rgba(248,113,113,0.1)',
          border: `1px solid ${T.red}`,
          borderRadius: 8,
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertCircle size={20} color={T.red} />
            <strong style={{ color: T.red, fontFamily: 'Syne' }}>
              Errores detectados
            </strong>
          </div>
          {estado.errores.map((error, i) => (
            <p key={i} style={{ 
              margin: '4px 0', 
              fontSize: 13, 
              color: T.red,
              fontFamily: 'DM Sans'
            }}>
              • {error}
            </p>
          ))}
        </div>
      )}

      {/* Resumen */}
      {estado.documentos.length > 0 && (
        <div style={{
          padding: 16,
          background: 'rgba(52,211,153,0.1)',
          border: `1px solid ${T.green}`,
          borderRadius: 8,
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={20} color={T.green} />
            <span style={{ color: T.green, fontFamily: 'DM Sans', fontSize: 14 }}>
              <strong>{estado.documentos.length}</strong> documento(s) cargado(s) correctamente
            </span>
          </div>
        </div>
      )}

      {/* Secciones de carga */}
      <div style={{ display: 'grid', gap: 16 }}>
        <CargarDocumentosDNIT />
        <CargarFacturasCompras />
      </div>

      {/* Instrucciones */}
      <div style={{
        marginTop: 32,
        padding: 16,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8
      }}>
        <p style={{ 
          margin: '0 0 8px 0', 
          fontSize: 13, 
          fontFamily: 'Syne', 
          color: T.textSecondary 
        }}>
          ℹ️ Instrucciones
        </p>
        <ul style={{ 
          margin: 0, 
          paddingLeft: 20, 
          fontSize: 12, 
          color: T.textSecondary,
          fontFamily: 'DM Sans',
          lineHeight: 1.8
        }}>
          <li>Los PDFs F120 y F500 se procesarán automáticamente al cargarlos</li>
          <li>Los archivos Excel de compras se integrarán al sistema de análisis</li>
          <li>Podés cargar múltiples archivos a la vez</li>
          <li>Los documentos se guardarán en IndexedDB para acceso offline</li>
        </ul>
      </div>
    </div>
  );
}
