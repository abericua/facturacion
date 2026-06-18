import { useState, useEffect, useRef, useCallback } from 'react';
import { FolderOpen, FileText, Upload, CheckCircle, AlertCircle, AlertTriangle, XCircle, RefreshCw, Save, Eye } from 'lucide-react';
import DB from './db.js';
import T from './theme.js';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.mjs`;

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'https://facturacion-production-3916.up.railway.app';
const BRIDGE_KEY = import.meta.env.VITE_BRIDGE_KEY || 'sgsp-bridge-2026';

// ── Extrae texto de un PDF con pdfjs preservando layout espacial ──────────────
async function extraerTextoPDF(archivo) {
  const arrayBuffer = await archivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ normalizeWhitespace: false });
    // Reconstruir orden visual: Y desc (arriba primero), X asc (izq a der)
    const positioned = content.items
      .filter(it => it.str && it.str.trim())
      .map(it => ({ x: it.transform[4], y: it.transform[5], str: it.str }));
    positioned.sort((a, b) =>
      Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x
    );
    const rows = [];
    let curRow = null;
    for (const item of positioned) {
      if (!curRow || Math.abs(item.y - curRow.y) > 3) {
        curRow = { y: item.y, items: [] };
        rows.push(curRow);
      }
      curRow.items.push(item);
    }
    texto += rows.map(r => r.items.map(it => it.str).join('  ')).join('\n') + '\n\n';
  }
  return texto;
}

// ── Llama al bridge Anthropic para clasificar y extraer datos ─────────────────
async function clasificarConIA(textoPDF, nombreArchivo) {
  const res = await fetch(`${BRIDGE_URL}/api/bridge/anthropic/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_KEY },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Sos un analizador de documentos fiscales de Paraguay (SET).
Analizá el texto del PDF y determiná exactamente qué tipo de documento es y extraé los datos clave.

Tipos posibles:
- "IVA": Formulario 120, declaración mensual de IVA
- "IRE": Formulario 500, declaración anual de Renta Empresarial
- "DESCONOCIDO": cualquier otro tipo

Devolvé SOLO JSON, sin texto adicional:
{
  "tipo": "IVA" | "IRE" | "DESCONOCIDO",
  "periodo": "YYYY-MM" para IVA (ej: "2026-05"), "YYYY" para IRE (ej: "2025"), null si no podés determinarlo,
  "confianza": "alta" | "media" | "baja",
  "datos": {
    // Si tipo=IVA (F120):
    "total_ventas_brutas": numero o null,
    "ventas_gravadas_10": numero o null,
    "ventas_gravadas_5": numero o null,
    "ventas_exentas": numero o null,
    "debito_fiscal": numero o null,
    "credito_fiscal": numero o null,
    "saldo_pagar": numero o null,
    // Si tipo=IRE (F500):
    "ingresos_totales": numero o null,
    "egresos_deducibles": numero o null,
    "renta_neta": numero o null,
    "impuesto_determinado": numero o null,
    "anticipos_pagados": numero o null,
    "saldo_pagar": numero o null
  },
  "razon": "descripción breve de por qué clasificaste así"
}`,
      messages: [{
        role: 'user',
        content: `Archivo: ${nombreArchivo}\n\nTexto extraído:\n${textoPDF.slice(0, 3000)}`
      }]
    })
  });
  if (!res.ok) throw new Error(`Bridge error: ${res.status}`);
  const json = await res.json();
  const raw = json.content?.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

// ── Verifica si ya existe ese período en IndexedDB ────────────────────────────
async function verificarDuplicado(tipo, periodo) {
  try {
    if (tipo === 'IVA') {
      const todos = await DB.getAll('finanzas_iva');
      return todos.some(r => r.periodo === periodo);
    }
    if (tipo === 'IRE') {
      const todos = await DB.getAll('finanzas_ire');
      return todos.some(r => r.anio === periodo || r.anio === String(periodo));
    }
  } catch { return false; }
  return false;
}

// ── Formatea números grandes en guaraníes ──────────────────────────────────────
const fmtGs = (n) => n != null ? `₲ ${new Intl.NumberFormat('es-PY').format(n)}` : '—';

// ──────────────────────────────────────────────────────────────────────────────
export default function CargadorDocumentos() {
  const [cola, setCola] = useState([]);           // archivos en proceso
  const [procesados, setProcesados] = useState([]); // ya guardados en IndexedDB
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  useEffect(() => { cargarExistentes(); }, []);

  const cargarExistentes = async () => {
    try {
      const iva = await DB.getAll('finanzas_iva');
      const ire = await DB.getAll('finanzas_ire');
      setProcesados([
        ...iva.map(d => ({ tipo: 'IVA', periodo: d.periodo, label: `F120 — ${d.periodo}` })),
        ...ire.map(d => ({ tipo: 'IRE', periodo: d.anio, label: `F500 — ${d.anio}` })),
      ].sort((a, b) => b.periodo?.localeCompare(a.periodo)));
    } catch { /* silencioso */ }
  };

  // ── Procesa cada archivo subido ──────────────────────────────────────────────
  const procesarArchivos = useCallback(async (files) => {
    const nuevos = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!nuevos.length) return;

    // Agrega todos a la cola como "procesando"
    const items = nuevos.map(f => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      nombre: f.name,
      archivo: f,
      estado: 'procesando', // procesando | listo | duplicado | error | guardado
      tipo: null,
      periodo: null,
      confianza: null,
      datos: {},
      razon: '',
      esDuplicado: false,
      error: null,
      // campos editables por el usuario
      periodoEdit: null,
    }));

    setCola(prev => [...prev, ...items]);

    // Procesa cada uno en paralelo
    items.forEach(async (item) => {
      try {
        // 1. Extraer texto
        const texto = await extraerTextoPDF(item.archivo);

        // 2. Clasificar y extraer datos con IA
        const resultado = await clasificarConIA(texto, item.nombre);

        // 3. Verificar duplicado
        const esDup = resultado.periodo
          ? await verificarDuplicado(resultado.tipo, resultado.periodo)
          : false;

        setCola(prev => prev.map(e => e.id === item.id ? {
          ...e,
          estado: esDup ? 'duplicado' : 'listo',
          tipo: resultado.tipo,
          periodo: resultado.periodo,
          periodoEdit: resultado.periodo || '',
          confianza: resultado.confianza,
          datos: resultado.datos || {},
          razon: resultado.razon || '',
          esDuplicado: esDup,
        } : e));
      } catch (err) {
        setCola(prev => prev.map(e => e.id === item.id ? {
          ...e,
          estado: 'error',
          error: err.message,
        } : e));
      }
    });
  }, []);

  // ── Guardar un item confirmado ────────────────────────────────────────────────
  const guardar = async (item, forzar = false) => {
    if (item.esDuplicado && !forzar) return;

    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(item.archivo);
      });

      const periodo = item.periodoEdit || item.periodo;

      if (item.tipo === 'IVA') {
        await DB.guardarIVA(periodo, item.datos, base64);
      } else if (item.tipo === 'IRE') {
        await DB.guardarIRE(periodo, item.datos, base64);
      } else {
        throw new Error('Tipo de documento no soportado para guardar');
      }

      setCola(prev => prev.map(e => e.id === item.id ? { ...e, estado: 'guardado' } : e));
      cargarExistentes();
    } catch (err) {
      setCola(prev => prev.map(e => e.id === item.id ? { ...e, estado: 'error', error: err.message } : e));
    }
  };

  const eliminarDeCola = (id) => setCola(prev => prev.filter(e => e.id !== id));

  const actualizarPeriodo = (id, val) =>
    setCola(prev => prev.map(e => e.id === id ? { ...e, periodoEdit: val } : e));

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    procesarArchivos(e.dataTransfer.files);
  }, [procesarArchivos]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  // ── Colores por estado ─────────────────────────────────────────────────────
  const colorEstado = { procesando: T.cyan, listo: T.green, duplicado: T.orange, error: T.red, guardado: T.blue };
  const iconoEstado = {
    procesando: <RefreshCw size={15} color={T.cyan} style={{ animation: 'spin 1s linear infinite' }} />,
    listo:      <CheckCircle size={15} color={T.green} />,
    duplicado:  <AlertTriangle size={15} color={T.orange} />,
    error:      <XCircle size={15} color={T.red} />,
    guardado:   <CheckCircle size={15} color={T.blue} />,
  };

  const pendientes = cola.filter(e => e.estado === 'listo' || e.estado === 'duplicado');
  const guardados  = cola.filter(e => e.estado === 'guardado');
  const errores    = cola.filter(e => e.estado === 'error');
  const procesando = cola.filter(e => e.estado === 'procesando');

  return (
    <div style={{ padding: 24, background: T.bg, minHeight: '100vh', maxWidth: 960, margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .drop-zone { border: 2px dashed ${T.border}; border-radius: 16px; padding: 40px; text-align: center; cursor: pointer; transition: all .2s; }
        .drop-zone.active { border-color: ${T.accent}; background: rgba(245,158,11,.05); }
        .drop-zone:hover { border-color: ${T.accent}55; }
        .btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-family: 'DM Sans'; font-weight: 600; font-size: 13px; transition: all .15s; }
        .btn:hover { opacity: .85; }
        .tag { display:inline-block; padding:2px 8px; border-radius:9999px; font-size:11px; font-weight:600; font-family:'JetBrains Mono'; }
        .field-edit { background:${T.surface}; border:1px solid ${T.border}; color:${T.textPrimary}; padding:5px 10px; border-radius:6px; font-family:'JetBrains Mono'; font-size:12px; outline:none; }
        .field-edit:focus { border-color:${T.accent}; }
        .dato-row { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid ${T.border}30; font-size:12px; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
        <FolderOpen size={30} color={T.accent} />
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontFamily: 'Syne', color: T.textPrimary }}>Gestor de Documentos</h1>
          <p style={{ margin: '4px 0 0 0', color: T.textSecondary, fontSize: 14 }}>
            Tirá los PDFs — el sistema los clasifica, extrae los datos y verifica duplicados antes de guardar.
          </p>
        </div>
      </div>

      {/* Zona universal de carga */}
      <div
        className={`drop-zone${dragging ? ' active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileRef.current?.click()}
        style={{ marginBottom: 28 }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => procesarArchivos(e.target.files)}
        />
        <Upload size={36} color={dragging ? T.accent : T.textSecondary} style={{ marginBottom: 12 }} />
        <p style={{ margin: '0 0 6px 0', fontSize: 17, color: T.textPrimary, fontFamily: 'Syne' }}>
          {dragging ? 'Soltá los PDFs aquí' : 'Arrastrá los PDFs o hacé clic'}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: T.textSecondary }}>
          F120 (IVA mensual) · F500 (IRE anual) · Múltiples archivos a la vez
        </p>
      </div>

      {/* Cola de procesamiento */}
      {procesando.length > 0 && (
        <div style={{ marginBottom: 20, padding: 16, background: `${T.cyan}10`, border: `1px solid ${T.cyan}30`, borderRadius: 12 }}>
          <p style={{ margin: '0 0 10px 0', color: T.cyan, fontWeight: 600, fontSize: 14 }}>
            <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Procesando {procesando.length} archivo{procesando.length > 1 ? 's' : ''}…
          </p>
          {procesando.map(e => (
            <div key={e.id} style={{ color: T.textSecondary, fontSize: 13, padding: '4px 0' }}>
              {iconoEstado.procesando} &nbsp;{e.nombre}
            </div>
          ))}
        </div>
      )}

      {/* Documentos listos para revisar */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 14px 0', fontFamily: 'Syne', color: T.textPrimary, fontSize: 17 }}>
            Revisá y confirmá — {pendientes.length} documento{pendientes.length > 1 ? 's' : ''}
          </h3>
          {pendientes.map(item => (
            <DocumentCard
              key={item.id}
              item={item}
              onGuardar={() => guardar(item)}
              onForzar={() => guardar(item, true)}
              onEliminar={() => eliminarDeCola(item.id)}
              onPeriodoChange={val => actualizarPeriodo(item.id, val)}
              T={T}
              iconoEstado={iconoEstado}
              colorEstado={colorEstado}
              fmtGs={fmtGs}
            />
          ))}
        </div>
      )}

      {/* Errores */}
      {errores.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px 0', fontFamily: 'Syne', color: T.red, fontSize: 16 }}>Errores</h3>
          {errores.map(item => (
            <div key={item.id} style={{ background: `${T.red}10`, border: `1px solid ${T.red}40`, borderRadius: 10, padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: T.red, fontWeight: 600, fontSize: 14 }}>{item.nombre}</span>
                <p style={{ margin: '4px 0 0 0', color: T.textSecondary, fontSize: 13 }}>{item.error}</p>
              </div>
              <button className="btn" onClick={() => eliminarDeCola(item.id)} style={{ background: T.surface, color: T.textSecondary }}>
                Descartar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Guardados esta sesión */}
      {guardados.length > 0 && (
        <div style={{ marginBottom: 24, padding: 14, background: `${T.blue}10`, border: `1px solid ${T.blue}30`, borderRadius: 10 }}>
          <p style={{ margin: 0, color: T.blue, fontWeight: 600, fontSize: 14 }}>
            <CheckCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Guardados esta sesión: {guardados.map(e => e.nombre).join(', ')}
          </p>
        </div>
      )}

      {/* Documentos ya en IndexedDB */}
      {procesados.length > 0 && (
        <div style={{ marginTop: 28, padding: 18, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
          <h4 style={{ margin: '0 0 14px 0', color: T.textPrimary, fontFamily: 'Syne', fontSize: 16 }}>
            Documentos en memoria local ({procesados.length})
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {procesados.map((doc, i) => (
              <span key={i} className="tag" style={{
                background: doc.tipo === 'IVA' ? `${T.accent}20` : `${T.green}20`,
                color: doc.tipo === 'IVA' ? T.accent : T.green,
                border: `1px solid ${doc.tipo === 'IVA' ? T.accent : T.green}40`,
              }}>
                {doc.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {cola.length === 0 && procesados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: T.textSecondary }}>
          <FileText size={40} style={{ opacity: .4, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>No hay documentos cargados. Tirá los PDFs arriba para empezar.</p>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta individual por documento ─────────────────────────────────────────
function DocumentCard({ item, onGuardar, onForzar, onEliminar, onPeriodoChange, T, iconoEstado, colorEstado, fmtGs }) {
  const [mostrarDatos, setMostrarDatos] = useState(true);
  const color = colorEstado[item.estado] || T.textSecondary;

  const labelTipo = item.tipo === 'IVA' ? 'F120 · IVA Mensual'
                  : item.tipo === 'IRE' ? 'F500 · Renta IRE'
                  : 'Tipo desconocido';

  const datosEntradas = Object.entries(item.datos || {}).filter(([, v]) => v != null);

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${color}50`,
      borderRadius: 12,
      marginBottom: 14,
      overflow: 'hidden',
    }}>
      {/* Header de la tarjeta */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {iconoEstado[item.estado]}
            <span style={{ color: T.textPrimary, fontWeight: 600, fontSize: 14 }}>{item.nombre}</span>
            {item.tipo && item.tipo !== 'DESCONOCIDO' && (
              <span className="tag" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>{labelTipo}</span>
            )}
            {item.confianza === 'baja' && (
              <span className="tag" style={{ background: `${T.orange}20`, color: T.orange }}>confianza baja</span>
            )}
          </div>
          {item.razon && (
            <p style={{ margin: 0, fontSize: 12, color: T.textSecondary }}>{item.razon}</p>
          )}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            className="btn"
            onClick={() => setMostrarDatos(v => !v)}
            style={{ background: T.surface, color: T.textSecondary, padding: '6px 10px' }}
            title="Ver datos extraídos"
          >
            <Eye size={14} />
          </button>

          {item.estado === 'duplicado' && (
            <button className="btn" onClick={onForzar}
              style={{ background: `${T.orange}20`, color: T.orange, border: `1px solid ${T.orange}40` }}>
              Sobrescribir
            </button>
          )}

          {(item.estado === 'listo') && item.tipo !== 'DESCONOCIDO' && (
            <button className="btn" onClick={onGuardar}
              style={{ background: T.accent, color: '#000' }}>
              <Save size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Guardar
            </button>
          )}

          <button className="btn" onClick={onEliminar}
            style={{ background: T.surface, color: T.textSecondary, padding: '6px 10px' }}>
            ✕
          </button>
        </div>
      </div>

      {/* Período editable + datos */}
      {mostrarDatos && (
        <div style={{ padding: '14px 18px' }}>
          {/* Período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ color: T.textSecondary, fontSize: 13, minWidth: 80 }}>Período:</span>
            <input
              className="field-edit"
              value={item.periodoEdit || ''}
              onChange={e => onPeriodoChange(e.target.value)}
              placeholder={item.tipo === 'IVA' ? 'YYYY-MM (ej: 2026-05)' : 'YYYY (ej: 2025)'}
              style={{ width: 160 }}
            />
            {item.esDuplicado && (
              <span style={{ color: T.orange, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={13} />
                Ya existe este período
              </span>
            )}
          </div>

          {/* Datos extraídos */}
          {datosEntradas.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
              {datosEntradas.map(([clave, valor]) => (
                <div key={clave} className="dato-row">
                  <span style={{ color: T.textSecondary, textTransform: 'capitalize' }}>
                    {clave.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: T.textPrimary, fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                    {typeof valor === 'number' ? fmtGs(valor) : String(valor)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: T.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
              {item.tipo === 'DESCONOCIDO'
                ? 'No se pudo determinar el tipo de documento. Verificá manualmente.'
                : 'No se extrajeron datos numéricos del PDF.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
