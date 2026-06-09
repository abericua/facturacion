import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, FileText, CheckCircle, XCircle, Clock,
  Trash2, Download, RefreshCw, AlertTriangle, Zap,
  Building2, TrendingDown, Package
} from "lucide-react";

import * as pdfjsLib from 'pdfjs-dist';
// Worker via CDN — evita problemas de bundling con Vite en producción
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.mjs`;
import DB from './db.js';
import { SyncBridge } from './SyncBridge.js';
// ── THEME (mismo T del backoffice) ────────────────────────────────────────────
const T = {
  bg:           '#07080f',
  surface:      '#0d1117',
  card:         '#111827',
  cardB:        '#141d2e',
  border:       '#1a2535',
  borderL:      '#243045',
  accent:       '#f59e0b',
  accentBg:     'rgba(245,158,11,0.08)',
  accentBorder: 'rgba(245,158,11,0.25)',
  cyan:         '#22d3ee',
  cyanBg:       'rgba(34,211,238,0.08)',
  green:        '#34d399',
  greenBg:      'rgba(52,211,153,0.08)',
  red:          '#f87171',
  redBg:        'rgba(248,113,113,0.08)',
  purple:       '#a78bfa',
  purpleBg:     'rgba(167,139,250,0.08)',
  textPrimary:  '#e2e8f0',
  textSecondary:'#7d9db5',
  textMuted:    '#3d5470',
};

const PROVEEDORES = [
  { id: 'todos',        label: 'Todos los proveedores', ruc: null },
  { id: 'sol_control',  label: 'Sol Control S.R.L.',    ruc: '80014018-4' },
  { id: 'todo_costura', label: 'Todo Costura S.A.',     ruc: '80054996-1' },
];

// ── Parámetros financieros conocidos por proveedor (extraídos del catálogo productos_maestros.csv)
const PROVEEDOR_PARAMS = {
  sol_control: {
    nombre:      'Sol Control S.R.L.',
    ruc:         '80014018-4',
    moneda:      'USD',
    prefijo_cod: 'SC-',
    iva_tipico:  10,
    productos:   'impresoras Epson, plotters, equipos de impresión digital, consumibles',
    reglas_moneda: `IMPORTANTE: Sol Control S.R.L. factura en DÓLARES AMERICANOS (USD).
- "moneda" SIEMPRE es "USD"
- "precio_unit_usd" es el precio en dólares (ej: 300.00, NO 2.340.000)
- "subtotal_usd" es el monto en dólares
- "subtotal_pyg" puede ser 0 o el equivalente en guaraníes
- Los códigos de artículo empiezan con "SC-" (ej: SC-001, SC-023)`,
  },
  todo_costura: {
    nombre:      'Todo Costura S.A.',
    ruc:         '80054996-1',
    moneda:      'PYG',
    prefijo_cod: 'TC-',
    iva_tipico:  10,
    productos:   'prensas térmicas, grabadoras láser, equipos de sublimación, accesorios de costura',
    reglas_moneda: `IMPORTANTE: Todo Costura S.A. factura en GUARANÍES PARAGUAYOS (PYG).
- "moneda" SIEMPRE es "PYG"
- "precio_unit_usd" debe ser null (no hay precio en dólares)
- "subtotal_usd" debe ser null
- "subtotal_pyg" es el monto real en guaraníes (ej: 1.300.000 → 1300000)
- Los códigos de artículo empiezan con "TC-" (ej: TC-001, TC-023)`,
  },
};

// Estructura base del JSON requerido (compartida entre todos los prompts)
const JSON_ESTRUCTURA = `{
  "tipo": "FAC" o "NC",
  "numero": "001-001-XXXXXXX",
  "fecha": "DD/MM/YY",
  "hora": "HH:MM:SS",
  "proveedor": "Nombre exacto de la empresa emisora",
  "ruc_proveedor": "RUC de la empresa emisora",
  "cliente": "Nombre del receptor",
  "ruc_cliente": "RUC del receptor",
  "condicion": "Contado" o "Credito",
  "moneda": "USD" o "PYG",
  "tipo_cambio": numero_o_null,
  "concepto": "descripción breve de los ítems principales",
  "subtotal_usd": numero_o_null,
  "subtotal_pyg": numero,
  "iva_5": numero,
  "iva_10": numero,
  "iva_total": numero,
  "total_guaranies": numero,
  "items": [
    {
      "linea": 1,
      "codigo": "código del artículo",
      "descripcion": "descripción completa",
      "ncm": "código NCM si existe",
      "cantidad": numero,
      "descuento_pct": numero_o_0,
      "precio_unit_usd": numero_o_null,
      "iva_pct": 5 o 10 o 0,
      "subtotal_usd": numero_o_null
    }
  ]
}`;

function getSystemPrompt(proveedorId) {
  const params = PROVEEDOR_PARAMS[proveedorId];

  if (params) {
    return `Eres un extractor de datos de comprobantes fiscales electrónicos paraguayos (kuDE - SIFEN).
Analiza el documento PDF y devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin backticks, sin markdown.

PROVEEDOR IDENTIFICADO: ${params.nombre} (RUC: ${params.ruc})
Productos típicos: ${params.productos}

${params.reglas_moneda}

Estructura exacta requerida:
${JSON_ESTRUCTURA}

Reglas generales:
- tipo "FAC" para Facturas Electrónicas, "NC" para Notas de Crédito
- iva_total = iva_5 + iva_10
- NUNCA uses puntos como separador de miles en los números JSON (7.650.000 → 7650000)
- Responde SOLO el JSON, nada más`;
  }

  // Prompt genérico cuando no se conoce el proveedor de antemano
  return `Eres un extractor de datos de comprobantes fiscales electrónicos paraguayos (kuDE - SIFEN).
Analiza el documento PDF y devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin backticks, sin markdown.

ATENCIÓN: El COMPRADOR (cliente) es SOLPRO SRL o SOL CONTROL S.R.L. — el PROVEEDOR (emisor) es la otra empresa.
- Si la factura es en USD: moneda="USD", precio_unit_usd=precio en dólares, subtotal_usd=monto en USD
- Si la factura es en guaraníes: moneda="PYG", precio_unit_usd=null, subtotal_usd=null, subtotal_pyg=monto en PYG

Estructura exacta requerida:
${JSON_ESTRUCTURA}

Reglas:
- tipo "FAC" para Facturas Electrónicas, "NC" para Notas de Crédito
- iva_total = iva_5 + iva_10
- NUNCA uses puntos como separador de miles en los números JSON (7.650.000 → 7650000)
- Responde SOLO el JSON, nada más`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmtUSD = (n) =>
  `U$ ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)}`;
const fmtGs = (n) =>
  `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n || 0))}`;
const fmtNum = (n) =>
  new Intl.NumberFormat('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

async function extractPdfText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // workerSrc ya configurado globalmente al importar
        const pdf = await pdfjsLib.getDocument({ data: e.target.result }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        resolve(text);
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── COMPONENTES INTERNOS ──────────────────────────────────────────────────────
const SumCard = ({ label, value, color, sub }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '14px 16px', flex: 1, minWidth: 0,
  }}>
    <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>
      {label.toUpperCase()}
    </div>
    <div style={{ color: color || T.textPrimary, fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '-0.02em', lineHeight: 1 }}>
      {value}
    </div>
    {sub && <div style={{ color: T.textMuted, fontSize: 10, marginTop: 4, fontFamily: "'DM Sans',sans-serif" }}>{sub}</div>}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    pending:    { label: 'Pendiente',    color: T.textMuted,  bg: 'rgba(61,84,112,0.2)' },
    processing: { label: 'Procesando…', color: T.cyan,       bg: T.cyanBg },
    done:       { label: 'Listo',        color: T.green,      bg: T.greenBg },
    error:      { label: 'Error',        color: T.red,        bg: T.redBg },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.06em', color: s.color, background: s.bg,
      fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0,
        animation: status === 'processing' ? 'pulse 1.2s ease-in-out infinite' : 'none' }}/>
      {s.label.toUpperCase()}
    </span>
  );
};

const TypeBadge = ({ tipo }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
    color: tipo === 'NC' ? T.accent  : T.cyan,
    background: tipo === 'NC' ? T.accentBg : T.cyanBg,
    border: `1px solid ${tipo === 'NC' ? T.accentBorder : 'rgba(34,211,238,0.2)'}`,
  }}>
    {tipo}
  </span>
);

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function ImportadorCompras() {
  const [files, setFiles]         = useState([]); // [{id, file, status, data, error}]
  const [records, setRecords] = useState([]);

  useEffect(() => {
    DB.obtenerTodasCompras().then(data => {
      if (data?.length) {
        setRecords(data);
      } else {
        try {
          const raw = localStorage.getItem('solpro_compras');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.length) {
              setRecords(parsed);
              DB.limpiarCompras()
                .then(() => DB.guardarCompras(parsed))
                .catch(console.error);
            }
          }
        } catch(e) {}
      }
    }).catch(()=>{});
  }, []);
  const [processing,   setProcessing]   = useState(false);
  const [stockSync,    setStockSync]    = useState({ status: 'idle', msg: '' });
  const [finUpdate,    setFinUpdate]    = useState(null); // null | { periodos, ivaTotal }
  const [variaciones,  setVariaciones]  = useState([]);
  const [showVar,      setShowVar]      = useState(false);
  const [provFilter, setProvFilter] = useState('todos');
  const [drag, setDrag]           = useState(false);
  const [detailId, setDetailId]   = useState(null);
  const fileInput                 = useRef();
  const idRef                     = useRef(0);

  // ── Agregar archivos ──────────────────────────────────────────────────────
  const addFiles = useCallback((fileList) => {
    const pdfs = Array.from(fileList).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (!pdfs.length) return;
    setFiles(prev => [
      ...prev,
      ...pdfs.map(f => ({ id: `f${++idRef.current}`, file: f, status: 'pending', data: null, error: null })),
    ]);
  }, []);

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));
  const clearAll   = () => { setFiles([]); setRecords([]); DB.limpiarCompras().catch(console.error); };

  // ── Procesar un PDF ───────────────────────────────────────────────────────
  const processOne = async (fileObj, proveedorHint = 'todos') => {
    setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'processing' } : f));
    try {
      const pdfText = await extractPdfText(fileObj.file);
      const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'https://facturacion-production-3916.up.railway.app';
      const res = await fetch(`${BRIDGE_URL}/api/bridge/anthropic/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_BRIDGE_API_KEY || 'sgsp-bridge-2026',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          system: getSystemPrompt(proveedorHint),
          messages: [{
            role: 'user',
            content: `Extraé los datos de este comprobante fiscal paraguayo (kuDE):\n\n${pdfText}`,
          }],
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || `API error ${res.status}`);
      }

      const raw = json.content?.map(b => b.text || '').join('') || '';
      if (!raw) throw new Error('Respuesta vacía de la API');

      const clean = raw.replace(/```json|```/g, '').trim();
      if (!clean) throw new Error('Sin contenido extraíble');

      // ── Extracción robusta del JSON ───────────────────────────────────────

      // Extrae el PRIMER bloque {...} balanceado (ignora texto extra antes/después)
      // Evita el bug del regex greedy que captura hasta el último } del string completo
      const extractFirstJSON = (str) => {
        let depth = 0;
        let inString = false;
        let escape = false;
        const start = str.indexOf('{');
        if (start === -1) return null;
        for (let i = start; i < str.length; i++) {
          const ch = str[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) return str.slice(start, i + 1);
          }
        }
        // JSON truncado: devuelve desde start hasta el final (closeJSON lo cerrará)
        return start > 0 ? str.slice(start) : str;
      };

      // Cierra un JSON truncado contando llaves/corchetes abiertos
      const closeJSON = (str) => {
        const stack = [];
        let inString = false;
        let escape = false;
        for (const ch of str) {
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
          else if ((ch === '}' || ch === ']') && stack.length) stack.pop();
        }
        return str + stack.reverse().join('');
      };

      // Sanitizaciones estándar del LLM (reutilizable en intentos 3 y 4)
      const sanitizeLLMJson = (str) => str
        // Trailing commas antes de } o ]
        .replace(/,\s*([}\]])/g, '$1')
        // Python booleans / null
        .replace(/:\s*True\b/g, ': true')
        .replace(/:\s*False\b/g, ': false')
        .replace(/:\s*None\b/g, ': null')
        // Número con punto final sin decimales: 25. → 25
        .replace(/(\d+)\.\s*([,}\]\s\n\r])/g, '$1$2')
        // Números con separador de miles paraguayo (4 grupos): 1.234.567.890
        .replace(/\b(\d+)\.(\d{3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3$4')
        // Números con separador de miles paraguayo (3 grupos): 7.650.000
        .replace(/\b(\d+)\.(\d{3})\.(\d{3})\b/g, '$1$2$3');

      // Sanitizaciones agresivas para el intento 4
      const sanitizeAgressive = (str) => {
        let s = str;
        // 1. Ellipsis fuera de strings como abreviación del LLM: {..., ...} o [..., ...]
        s = s.replace(/,?\s*\.\.\.\s*([,}\]])/g, '$1');
        // 2. Ellipsis al inicio de array/objeto como primer elemento
        s = s.replace(/([{\[]\s*)\.\.\.\s*,/g, '$1');
        // 3. Ellipsis como valor de propiedad: "key": ...  → "key": null
        s = s.replace(/:\s*\.\.\./g, ': null');
        // 4. Ellipsis dentro de strings: "texto..." es válido, no lo tocamos
        // 5. Claves sin comillas: {key: "val"} o {key: 123}  → {"key": "val"}
        //    Solo aplica fuera de strings (aproximación segura para objetos JSON)
        s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        // 6. Limpiar comillas duplicadas generadas por paso anterior: {""key"":
        s = s.replace(/""+([^"]+)""+\s*:/g, '"$1":');
        // 7. Newlines/tabs literales DENTRO de valores string → espacio
        s = s.replace(/"((?:[^"\\]|\\.)*)"/g, (m) => m.replace(/[\r\n\t]+/g, ' '));
        // 8. String sin cerrar al final del JSON → agregar comilla de cierre
        if ((s.match(/"/g) || []).length % 2 !== 0) {
          s = s + '"';
        }
        return sanitizeLLMJson(s);
      };

      let data;
      try {
        data = JSON.parse(clean);
      } catch (parseErr1) {
        // Intento 2: extraer el primer bloque {} balanceado (ignora texto antes/después)
        // Usamos extractFirstJSON en vez de regex greedy para no capturar texto posterior al JSON
        const jsonStr0 = extractFirstJSON(clean);
        if (!jsonStr0) throw new Error(`JSON inválido: ${parseErr1.message}`);
        let jsonStr = jsonStr0;
        try {
          data = JSON.parse(jsonStr);
        } catch (parseErr2) {
          // Intento 3: sanitizaciones estándar del LLM
          const sanitized3 = sanitizeLLMJson(jsonStr);
          try {
            data = JSON.parse(sanitized3);
          } catch (parseErr3) {
            // Intento 4: sanitizaciones agresivas + cierre de JSON truncado
            try {
              const sanitized4 = sanitizeAgressive(jsonStr);
              const closed4 = closeJSON(sanitized4);
              data = JSON.parse(closed4);
            } catch (parseErr4) {
              throw new Error(`JSON no recuperable: ${parseErr4.message}`);
            }
          }
        }
      }
      // ── Normalizar proveedor por RUC ──────────────────────────────────────
      const RUC_MAP = {
        '80014018-4': { nombre: 'Sol Control S.R.L.',  id: 'sol_control'  },
        '800140184':  { nombre: 'Sol Control S.R.L.',  id: 'sol_control'  },
        '80054996-1': { nombre: 'Todo Costura S.A.',   id: 'todo_costura' },
        '800549961':  { nombre: 'Todo Costura S.A.',   id: 'todo_costura' },
      };
      let provIdDetectado = proveedorHint;
      if (data.ruc_proveedor) {
        const match = Object.keys(RUC_MAP).find(r =>
          data.ruc_proveedor.replace(/[^0-9]/g,'').includes(r.replace(/[^0-9]/g,''))
        );
        if (match) {
          data.proveedor  = RUC_MAP[match].nombre;
          provIdDetectado = RUC_MAP[match].id;
        }
      }

      // ── Corrección de parámetros financieros con datos conocidos del catálogo ──
      // Si identificamos el proveedor (por RUC o por filtro), corregimos campos
      // que el LLM suele equivocar basándonos en parámetros ya determinados.
      const params = PROVEEDOR_PARAMS[provIdDetectado];
      if (params) {
        // Corregir moneda si el LLM la confundió
        if (data.moneda !== params.moneda) {
          console.warn(`[SGSP] Corrección moneda: LLM dijo "${data.moneda}", se esperaba "${params.moneda}" para ${params.nombre}`);
          data.moneda = params.moneda;
        }
        // Para facturas en PYG: precio_unit_usd y subtotal_usd de items deben ser null
        if (params.moneda === 'PYG') {
          data.subtotal_usd = null;
          if (Array.isArray(data.items)) {
            data.items = data.items.map(it => ({
              ...it,
              precio_unit_usd: null,
              subtotal_usd:    null,
            }));
          }
        }
        // Para facturas en USD: subtotal_pyg puede ser 0 (se convertirá con TC al guardar)
        if (params.moneda === 'USD' && !data.subtotal_usd && data.subtotal_pyg > 0) {
          // El LLM puso el monto en subtotal_pyg cuando debería estar en subtotal_usd
          // Esto ocurre si la factura muestra el equivalente en guaraníes
          // No autocorregimos el monto (no sabemos el TC exacto), solo lo logueamos
          console.warn(`[SGSP] Posible confusión USD/PYG: subtotal_usd=${data.subtotal_usd}, subtotal_pyg=${data.subtotal_pyg}`);
        }
      }

      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'done', data } : f));
      return { ...data, _fileId: fileObj.id, _fileName: fileObj.file.name };
    } catch (e) {
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error', error: e.message } : f));
      return null;
    }
  };

  // ── Procesar todos ────────────────────────────────────────────────────────
  const processAll = async () => {
    setProcessing(true);
    const pending = files.filter(f => f.status === 'pending' || f.status === 'error');
    const existing = files
      .filter(f => f.status === 'done' && f.data)
      .map(f => ({ ...f.data, _fileId: f.id, _fileName: f.file.name }));

    const BATCH = 3;
    const newResults = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(f => processOne(f, provFilter)));
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) newResults.push(r.value);
      });
      if (i + BATCH < pending.length) {
        await new Promise(res => setTimeout(res, 10000));
      }
    }
    const allRecords = [...existing, ...newResults];
    setRecords(allRecords);
    await DB.limpiarCompras();
    await DB.guardarCompras(allRecords).catch(console.error);

    // ── Push compras a Railway para sincronización cross-device ──────────────
    try {
      await SyncBridge.pushCompras();
    } catch (e) {
      console.warn('[SyncBridge] pushCompras falló (no crítico):', e.message);
    }

    // ── Auto-actualizar FinanzasPro (egresos compras_local + IVA crédito) ──
    try {
      const periodos = await DB.actualizarEgresosDesdeCompras();
      // Calcular IVA crédito total para mostrar al usuario
      const ivaTotal = allRecords
        .filter(r => r.tipo === 'FAC')
        .reduce((a, r) => a + (r.iva_total || 0), 0)
        - allRecords
        .filter(r => r.tipo === 'NC')
        .reduce((a, r) => a + (r.iva_total || 0), 0);
      setFinUpdate({ periodos, ivaTotal: Math.round(ivaTotal) });
    } catch (e) {
      console.error('Error actualizando FinanzasPro:', e);
    }

    // ── Análisis de variación de costos ──
    try {
      const vars = await DB.analizarVariacionCostos();
      setVariaciones(vars);
      if (vars.length) setShowVar(true);
    } catch (e) {
      console.error('Error en análisis de costos:', e);
    }

    setProcessing(false);
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filteredRecords = records.filter(r => {
    if (provFilter === 'todos') return true;
    const prov = PROVEEDORES.find(p => p.id === provFilter);
    if (!prov) return true;
    if (prov.ruc) return r.ruc_proveedor?.includes(prov.ruc.replace('-', '')) || r.ruc_proveedor === prov.ruc;
    return r.proveedor?.toLowerCase().includes(prov.label.toLowerCase().split(' ')[0].toLowerCase());
  });

  // ── Totales ───────────────────────────────────────────────────────────────
  const facs      = filteredRecords.filter(r => r.tipo === 'FAC');
  const ncs       = filteredRecords.filter(r => r.tipo === 'NC');
  const sumFacUSD = facs.reduce((a, r) => a + (r.subtotal_usd || 0), 0);
  const sumNCUSD  = ncs.reduce((a, r) => a + (r.subtotal_usd || 0), 0);
  const sumFacPYG = facs.reduce((a, r) => a + (r.subtotal_pyg || 0), 0);
  const sumNCPYG  = ncs.reduce((a, r) => a + (r.subtotal_pyg || 0), 0);
  const netoUSD   = sumFacUSD - sumNCUSD;
  const netoPYG   = sumFacPYG - sumNCPYG;
  const ivaNet    = facs.reduce((a, r) => a + (r.iva_total || 0), 0) - ncs.reduce((a, r) => a + (r.iva_total || 0), 0);
  const enPYG     = sumFacPYG > 0 && sumFacUSD === 0;
  const sumFac    = enPYG ? sumFacPYG : sumFacUSD;
  const sumNC     = enPYG ? sumNCPYG  : sumNCUSD;
  const neto      = enPYG ? netoPYG   : netoUSD;
  const moneda    = enPYG ? '₲' : 'U$';

  // ── Sincronizar Stock con Railway (idempotente) ───────────────────────────
  const sincronizarStock = async ({ forzar = false } = {}) => {
    setStockSync({ status: 'syncing', msg: 'Calculando pendientes…' });
    try {
      // Si forzar=true, resetear todos los flags primero
      if (forzar) {
        await DB.resetearFlagsStock();
        setStockSync({ status: 'syncing', msg: 'Flags reseteados, re-sincronizando todo…' });
      }

      const { items, ids, pendientes } = await DB.agregarStockDesdeCompras();

      if (!pendientes) {
        setStockSync({ status: 'ok', msg: '✅ Todo ya sincronizado. Sin compras nuevas.' });
        return;
      }
      if (!items.length) {
        setStockSync({ status: 'error', msg: `${pendientes} compras pendientes pero sin items con código válido.` });
        return;
      }

      setStockSync({ status: 'syncing', msg: `Enviando ${items.length} productos (${pendientes} facturas)…` });
      const actualizados = await SyncBridge.pushStock(items);

      // Marcar como sincronizadas SOLO si el push fue exitoso
      await DB.marcarComprasSincronizadas(ids);

      setStockSync({ status: 'ok', msg: `✅ ${actualizados} productos actualizados · ${pendientes} facturas marcadas.` });
    } catch (e) {
      setStockSync({ status: 'error', msg: `Error: ${e.message}` });
    }
  };

  // ── Exportar ──────────────────────────────────────────────────────────────
  const exportJSON = () => {
    const payload = {
      exportado: new Date().toISOString(),
      modulo: 'importador_compras',
      proveedor_filtro: provFilter,
      total_registros: filteredRecords.length,
      totales: { facturas_usd: sumFac, notas_credito_usd: sumNC, neto_usd: neto, iva_neto_usd: ivaNet },
      registros: filteredRecords,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solpro_compras_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const exportCSV = () => {
    const cols = ['tipo','numero','fecha','proveedor','ruc_proveedor','concepto','subtotal_usd','iva_5','iva_10','iva_total','total_guaranies'];
    const header = cols.join(',');
    const rows = filteredRecords.map(r =>
      cols.map(c => {
        const v = r[c] ?? '';
        const s = String(v);
        return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solpro_compras_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── DETALLE MODAL ─────────────────────────────────────────────────────────
  const detailRec = records.find(r => r._fileId === detailId);

  // ── RENDER ────────────────────────────────────────────────────────────────
  const pendingCount    = files.filter(f => f.status === 'pending').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const doneCount       = files.filter(f => f.status === 'done').length;
  const errorCount      = files.filter(f => f.status === 'error').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* ── HEADER ROW ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: T.textPrimary, fontSize: 16, fontWeight: 800, fontFamily: "'Syne',sans-serif", letterSpacing: '0.04em', marginBottom: 3 }}>
            Importador de Compras
          </h1>
          <p style={{ color: T.textMuted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>
            Procesá kuDEs de Sol Control y Todo Costura — extracción automática con IA
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {records.length > 0 && (
            <>
              {/* ── SYNC STOCK ── */}
              <button
                onClick={() => sincronizarStock()}
                disabled={stockSync.status === 'syncing'}
                title="Sincroniza solo las facturas nuevas (no duplica)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px',
                  background: stockSync.status === 'ok'    ? T.greenBg
                            : stockSync.status === 'error' ? T.redBg
                            : T.purpleBg,
                  border: `1px solid ${
                    stockSync.status === 'ok'    ? 'rgba(52,211,153,0.3)'
                  : stockSync.status === 'error' ? 'rgba(248,113,113,0.3)'
                  : 'rgba(167,139,250,0.3)'}`,
                  borderRadius: 6,
                  color: stockSync.status === 'ok'    ? T.green
                       : stockSync.status === 'error' ? T.red
                       : T.purple,
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "'DM Sans',sans-serif",
                  cursor: stockSync.status === 'syncing' ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                  opacity: stockSync.status === 'syncing' ? 0.6 : 1,
                }}
              >
                {stockSync.status === 'syncing'
                  ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Sincronizando…</>
                  : <><Package size={12} /> Sync Stock</>
                }
              </button>

              {/* ── FORZAR RE-SYNC TOTAL ── */}
              <button
                onClick={() => {
                  if (window.confirm('⚠️ Esto re-sincroniza TODAS las facturas desde cero.\nUsá solo si el stock en Railway está desactualizado.\n¿Continuar?')) {
                    sincronizarStock({ forzar: true });
                  }
                }}
                disabled={stockSync.status === 'syncing'}
                title="Re-sincroniza todo desde cero (resetea flags)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '7px 10px', background: 'transparent',
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  color: T.textMuted, fontSize: 10, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  opacity: stockSync.status === 'syncing' ? 0.4 : 1,
                }}
              >
                <AlertTriangle size={11} /> Re-sync total
              </button>

              {stockSync.msg && (
                <span style={{
                  fontSize: 10,
                  color: stockSync.status === 'ok'    ? T.green
                       : stockSync.status === 'error' ? T.red
                       : T.textMuted,
                  fontFamily: "'DM Sans',sans-serif", maxWidth: 220,
                }}>
                  {stockSync.msg}
                </span>
              )}

              <button onClick={exportJSON} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: T.greenBg,
                border: `1px solid rgba(52,211,153,0.25)`, borderRadius: 6,
                color: T.green, fontSize: 11, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif", cursor: 'pointer', letterSpacing: '0.05em',
              }}>
                <Download size={12} /> JSON
              </button>
              <button onClick={exportCSV} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: T.accentBg,
                border: `1px solid ${T.accentBorder}`, borderRadius: 6,
                color: T.accent, fontSize: 11, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif", cursor: 'pointer', letterSpacing: '0.05em',
              }}>
                <Download size={12} /> CSV
              </button>
            </>
          )}
          {(files.length > 0 || records.length > 0) && (
            <button onClick={clearAll} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', background: 'transparent',
              border: `1px solid ${T.border}`, borderRadius: 6,
              color: T.textMuted, fontSize: 11, cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
            }}>
              <Trash2 size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── PROVEEDOR FILTER ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif", marginRight: 4 }}>
          PROVEEDOR
        </span>
        {PROVEEDORES.map(p => (
          <button key={p.id} onClick={() => setProvFilter(p.id)} style={{
            padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
            border: `1px solid ${provFilter === p.id ? T.accentBorder : T.border}`,
            background: provFilter === p.id ? T.accentBg : 'transparent',
            color: provFilter === p.id ? T.accent : T.textSecondary,
            fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
            letterSpacing: '0.03em', transition: 'all 0.12s',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── SUMMARY CARDS (solo si hay records) ────────────────────────── */}
      {records.length > 0 && (
        <div style={{ display: 'flex', gap: 10 }}>
          <SumCard label="Facturas"      value={facs.length}     color={T.cyan}   sub={`${moneda} ${fmtNum(sumFac)}`} />
          <SumCard label="Notas Crédito" value={ncs.length}      color={T.accent} sub={`${moneda} ${fmtNum(sumNC)}`} />
          <SumCard label="Total Bruto"   value={`${moneda} ${fmtNum(sumFac)}`}  color={T.textPrimary} />
          <SumCard label="Neto Pagable"  value={`${moneda} ${fmtNum(neto)}`}    color={T.green}  sub={`IVA neto: ₲ ${fmtNum(ivaNet)}`} />
        </div>
      )}

      {/* ── DROP ZONE ──────────────────────────────────────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileInput.current?.click()}
        style={{
          border: `2px dashed ${drag ? T.accent : T.borderL}`,
          borderRadius: 10, padding: '28px 20px', textAlign: 'center',
          background: drag ? T.accentBg : T.card,
          cursor: 'pointer', transition: 'all 0.15s',
          boxShadow: drag ? `0 0 24px rgba(245,158,11,0.15)` : 'none',
        }}
      >
        <input ref={fileInput} type="file" multiple accept=".pdf" style={{ display: 'none' }}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <div style={{
          width: 44, height: 44, background: T.accentBg,
          border: `1px solid ${T.accentBorder}`, borderRadius: 8,
          margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Upload size={20} color={T.accent} />
        </div>
        <div style={{ color: T.textPrimary, fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", marginBottom: 4 }}>
          Arrastrá los PDFs aquí
        </div>
        <div style={{ color: T.textMuted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>
          Facturas y Notas de Crédito electrónicas (kuDE) · Múltiples archivos a la vez
        </div>
      </div>

      {/* ── FILE LIST + PROCESS BUTTON ─────────────────────────────────── */}
      {files.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.surface,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: T.textPrimary, fontSize: 12, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>
                {files.length} archivo{files.length !== 1 ? 's' : ''}
              </span>
              {[
                { label: `${pendingCount} pendientes`,  color: T.textMuted,  show: pendingCount > 0 },
                { label: `${processingCount} procesando`, color: T.cyan,    show: processingCount > 0 },
                { label: `${doneCount} listos`,          color: T.green,     show: doneCount > 0 },
                { label: `${errorCount} errores`,        color: T.red,       show: errorCount > 0 },
              ].filter(i => i.show).map((item, i) => (
                <span key={i} style={{ color: item.color, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                  {item.label}
                </span>
              ))}
            </div>
            <button
              onClick={processAll}
              disabled={processing || pendingCount === 0 && errorCount === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', background: T.accent, border: 'none',
                borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700,
                fontFamily: "'DM Sans',sans-serif", cursor: processing ? 'not-allowed' : 'pointer',
                opacity: (processing || (pendingCount === 0 && errorCount === 0)) ? 0.5 : 1,
                transition: 'opacity 0.15s', letterSpacing: '0.04em',
              }}
            >
              {processing
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Procesando…</>
                : <><Zap size={13} /> Procesar con IA</>
              }
            </button>
          </div>

          {/* Files */}
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
              transition: 'background 0.1s',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                background: T.redBg, border: `1px solid rgba(248,113,113,0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={14} color={T.red} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: T.textPrimary, fontSize: 12, fontWeight: 500,
                  fontFamily: "'DM Sans',sans-serif",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.file.name}
                </div>
                <div style={{ color: T.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>
                  {(f.file.size / 1024).toFixed(1)} KB
                  {f.error && <span style={{ color: T.red, marginLeft: 8 }}>{f.error}</span>}
                </div>
              </div>
              <StatusBadge status={f.status} />
              {f.status === 'done' && f.data && (
                <button onClick={() => setDetailId(detailId === f.id ? null : f.id)} style={{
                  padding: '3px 8px', background: 'transparent',
                  border: `1px solid ${T.border}`, borderRadius: 4,
                  color: T.textMuted, fontSize: 10, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}>
                  {detailId === f.id ? 'Cerrar' : 'Ver'}
                </button>
              )}
              <button onClick={() => removeFile(f.id)} disabled={processing} style={{
                background: 'none', border: 'none', color: T.textMuted,
                cursor: 'pointer', padding: 4, borderRadius: 4,
                opacity: processing ? 0.4 : 1,
              }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {/* Inline detail */}
          {detailId && detailRec && (
            <div style={{
              padding: '14px 18px', background: T.cardB,
              borderTop: `1px solid ${T.borderL}`,
            }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  { l: 'Tipo',      v: detailRec.tipo,          c: detailRec.tipo === 'NC' ? T.accent : T.cyan },
                  { l: 'Número',    v: detailRec.numero,         c: T.textPrimary },
                  { l: 'Fecha',     v: detailRec.fecha,          c: T.textSecondary },
                  { l: 'Proveedor', v: detailRec.proveedor,      c: T.textSecondary },
                  { l: 'T/C',       v: detailRec.tipo_cambio ? `₲ ${Intl.NumberFormat('es-PY').format(detailRec.tipo_cambio)}` : '—', c: T.textSecondary },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 12px' }}>
                    <div style={{ color: T.textMuted, fontSize: 9, letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif", marginBottom: 2 }}>{l.toUpperCase()}</div>
                    <div style={{ color: c, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              {detailRec.items?.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: T.surface }}>
                        {['Línea', 'Código', 'Descripción', 'Cant.', 'P. Unit U$', 'IVA%', 'Subtotal U$'].map(h => (
                          <th key={h} style={{
                            padding: '6px 10px', color: T.textMuted, fontSize: 9,
                            fontWeight: 700, letterSpacing: '0.08em', textAlign: 'left',
                            borderBottom: `1px solid ${T.border}`, fontFamily: "'DM Sans',sans-serif",
                            whiteSpace: 'nowrap',
                          }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailRec.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '7px 10px', color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{item.linea}</td>
                          <td style={{ padding: '7px 10px', color: T.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{item.codigo}</td>
                          <td style={{ padding: '7px 10px', color: T.textPrimary, fontFamily: "'DM Sans',sans-serif", fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descripcion}</td>
                          <td style={{ padding: '7px 10px', color: T.textSecondary, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{item.cantidad}</td>
                          <td style={{ padding: '7px 10px', color: T.textPrimary, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{fmtNum(item.precio_unit_usd)}</td>
                          <td style={{ padding: '7px 10px', color: T.accent, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{item.iva_pct}%</td>
                          <td style={{ padding: '7px 10px', color: T.green, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 }}>{fmtNum(item.subtotal_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BANNER FINANZAS AUTO-UPDATE ────────────────────────────────── */}
      {finUpdate && (
        <div style={{
          background: T.greenBg, border: `1px solid rgba(52,211,153,0.25)`,
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={16} color={T.green} />
            <div>
              <div style={{ color: T.green, fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
                FinanzasPro actualizado automáticamente
              </div>
              <div style={{ color: T.textSecondary, fontSize: 11, fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>
                {finUpdate.periodos} período{finUpdate.periodos !== 1 ? 's' : ''} actualizados en Compras Locales
                {finUpdate.ivaTotal > 0 && (
                  <span style={{ color: T.cyan, marginLeft: 8 }}>
                    · IVA Crédito Neto: {fmtGs(finUpdate.ivaTotal)}
                    <span style={{ color: T.textMuted, marginLeft: 4, fontSize: 10 }}>
                      (para tu contador)
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setFinUpdate(null)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 4 }}>
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* ── ANÁLISIS DE VARIACIÓN DE COSTOS ────────────────────────────── */}
      {variaciones.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => setShowVar(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: showVar ? `1px solid ${T.border}` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={15} color={variaciones.some(v => !v.favorable) ? T.accent : T.green} />
              <span style={{ color: T.textPrimary, fontSize: 13, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>
                Variación de Costos vs. Catálogo
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                background: variaciones.some(v => !v.favorable) ? T.accentBg : T.greenBg,
                color: variaciones.some(v => !v.favorable) ? T.accent : T.green,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {variaciones.filter(v => !v.favorable).length} sobre costo · {variaciones.filter(v => v.favorable).length} bajo costo
              </span>
            </div>
            <span style={{ color: T.textMuted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>
              {showVar ? '▲ Ocultar' : '▼ Ver análisis'}
            </span>
          </button>

          {showVar && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.surface }}>
                    {['Código', 'Descripción', 'Costo Base U$', 'Precio Compra U$', 'Diferencia U$', 'Var %', 'Proveedor'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', color: T.textMuted, fontSize: 9, fontWeight: 700,
                        letterSpacing: '0.08em', textAlign: 'left',
                        borderBottom: `1px solid ${T.border}`, fontFamily: "'DM Sans',sans-serif",
                        whiteSpace: 'nowrap',
                      }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variaciones.map((v, i) => (
                    <tr key={i}
                      style={{ borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = T.cardB}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '9px 12px', color: T.cyan, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, whiteSpace: 'nowrap' }}>
                        {v.codigo}
                      </td>
                      <td style={{ padding: '9px 12px', color: T.textSecondary, fontFamily: "'DM Sans',sans-serif", fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.descripcion}
                      </td>
                      <td style={{ padding: '9px 12px', color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                        {fmtNum(v.costo_base_usd)}
                      </td>
                      <td style={{ padding: '9px 12px', color: T.textPrimary, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600 }}>
                        {fmtNum(v.precio_compra_usd)}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700,
                        color: v.favorable ? T.green : T.red }}>
                        {v.favorable ? '' : '+'}{fmtNum(v.diferencia_usd)}
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700,
                        color: v.favorable ? T.green : T.red }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 4,
                          background: v.favorable ? T.greenBg : T.redBg,
                        }}>
                          {v.favorable ? '' : '+'}{v.variacion_pct}%
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: T.textMuted, fontFamily: "'DM Sans',sans-serif", fontSize: 11, whiteSpace: 'nowrap' }}>
                        {v.proveedor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Resumen de variaciones */}
              <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: T.surface, borderTop: `1px solid ${T.border}` }}>
                {[
                  {
                    l: 'Productos sobre costo base',
                    v: variaciones.filter(x => !x.favorable).length,
                    c: T.red,
                    sub: variaciones.filter(x => !x.favorable).length
                      ? `Máx: +U$ ${fmtNum(Math.max(...variaciones.filter(x => !x.favorable).map(x => x.diferencia_usd)))}`
                      : '—',
                  },
                  {
                    l: 'Productos bajo costo base',
                    v: variaciones.filter(x => x.favorable).length,
                    c: T.green,
                    sub: variaciones.filter(x => x.favorable).length
                      ? `Máx ahorro: U$ ${fmtNum(Math.abs(Math.min(...variaciones.filter(x => x.favorable).map(x => x.diferencia_usd))))}`
                      : '—',
                  },
                  {
                    l: 'Sin datos en catálogo',
                    v: records.reduce((a, r) => a + (r.items?.filter(it => it.codigo && !variaciones.find(v => v.codigo === (it.codigo||'').toUpperCase())).length || 0), 0),
                    c: T.textMuted,
                    sub: 'Actualizar catálogo',
                  },
                ].map(({ l, v, c, sub }) => (
                  <div key={l}>
                    <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 3, fontFamily: "'DM Sans',sans-serif" }}>{l.toUpperCase()}</div>
                    <div style={{ color: c, fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                    <div style={{ color: T.textMuted, fontSize: 10, marginTop: 2, fontFamily: "'DM Sans',sans-serif" }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TABLA RESULTADOS ───────────────────────────────────────────── */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface,
        }}>
          <h2 style={{ color: T.textPrimary, fontSize: 13, fontWeight: 700, fontFamily: "'Syne',sans-serif", letterSpacing: '0.04em' }}>
            Registros Extraídos
          </h2>
          <span style={{ color: T.textMuted, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
            {filteredRecords.length} registro{filteredRecords.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, border: `1px solid ${T.border}`, borderRadius: 8,
              margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4,
            }}>
              <FileText size={20} color={T.textMuted} />
            </div>
            <div style={{ color: T.textMuted, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
              {files.length === 0 ? 'Subí los PDFs para empezar' : 'Presioná "Procesar con IA" para extraer los datos'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.surface }}>
                    {['Tipo', 'Número', 'Fecha', 'Proveedor', 'Concepto', 'Subtotal U$', 'IVA Total', 'Total ₲'].map(h => (
                      <th key={h} style={{
                        padding: '9px 12px', color: T.textMuted, fontSize: 9,
                        fontWeight: 700, letterSpacing: '0.08em', textAlign: h === 'Tipo' || h === 'Número' || h === 'Fecha' || h === 'Proveedor' || h === 'Concepto' ? 'left' : 'right',
                        borderBottom: `1px solid ${T.border}`, fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
                      }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = T.cardB}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 12px' }}><TypeBadge tipo={r.tipo} /></td>
                      <td style={{ padding: '10px 12px', color: T.accent, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, whiteSpace: 'nowrap' }}>{r.numero}</td>
                      <td style={{ padding: '10px 12px', color: T.textMuted, fontFamily: "'DM Sans',sans-serif", fontSize: 12, whiteSpace: 'nowrap' }}>{r.fecha}</td>
                      <td style={{ padding: '10px 12px', color: T.textSecondary, fontFamily: "'DM Sans',sans-serif", fontSize: 12, whiteSpace: 'nowrap' }}>{r.proveedor}</td>
                      <td style={{ padding: '10px 12px', color: T.textSecondary, fontFamily: "'DM Sans',sans-serif", fontSize: 11, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.concepto}</td>
                      <td style={{ padding: '10px 12px', color: r.tipo === 'NC' ? T.accent : T.textPrimary, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {r.tipo === 'NC' ? '-' : ''}{fmtNum(r.subtotal_usd)}
                      </td>
                      <td style={{ padding: '10px 12px', color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, textAlign: 'right' }}>{fmtNum(r.iva_total)}</td>
                      <td style={{ padding: '10px 12px', color: T.textSecondary, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtGs(r.total_guaranies)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals bar */}
            <div style={{
              display: 'flex', gap: 24, padding: '12px 16px', flexWrap: 'wrap',
              borderTop: `1px solid ${T.borderL}`, background: T.surface,
            }}>
              {[
                { l: 'Total Facturas',      v: `${moneda} ${fmtNum(sumFac)}`, c: T.cyan },
                { l: 'Notas de Crédito',   v: `${moneda} ${fmtNum(sumNC)}`,  c: T.accent },
                { l: 'Neto Pagable',        v: `${moneda} ${fmtNum(neto)}`,   c: T.green },
                { l: 'IVA Neto (10%)',      v: `₲ ${fmtNum(ivaNet)}`, c: T.textSecondary },
              ].map(({ l, v, c }) => (
                <div key={l}>
                  <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 3, fontFamily: "'DM Sans',sans-serif" }}>{l.toUpperCase()}</div>
                  <div style={{ color: c, fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
