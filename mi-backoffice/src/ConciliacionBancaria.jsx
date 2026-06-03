import { useState, useEffect, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.mjs`;
import DB from './db.js';
import {
  Upload, FileText, CheckCircle, XCircle, RefreshCw,
  DollarSign, TrendingUp, TrendingDown, Trash2, Check,
  ChevronDown, ChevronUp, Building2, AlertTriangle
} from 'lucide-react';

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg:'#07080f', surface:'#0d1117', card:'#111827', cardB:'#141d2e',
  border:'#1a2535', borderL:'#243045',
  accent:'#f59e0b', accentBg:'rgba(245,158,11,0.08)', accentBorder:'rgba(245,158,11,0.25)',
  cyan:'#22d3ee', cyanBg:'rgba(34,211,238,0.08)',
  green:'#34d399', greenBg:'rgba(52,211,153,0.08)',
  red:'#f87171', redBg:'rgba(248,113,113,0.08)',
  purple:'#a78bfa', purpleBg:'rgba(167,139,250,0.08)',
  blue:'#60a5fa', blueBg:'rgba(96,165,250,0.08)',
  orange:'#fb923c',
  textPrimary:'#e2e8f0', textSecondary:'#7d9db5', textMuted:'#3d5470',
};

// ── CUENTAS PREDEFINIDAS ──────────────────────────────────────────────────────
const CUENTAS_DEFAULT = [
  { id: 'ueno_gs',   banco: 'Ueno',  moneda: 'GS',  label: 'Ueno — Guaraníes',  color: T.purple, icon: '🟣' },
  { id: 'ueno_usd',  banco: 'Ueno',  moneda: 'USD', label: 'Ueno — Dólares',    color: T.blue,   icon: '🔵' },
  { id: 'atlas_gs',  banco: 'Atlas', moneda: 'GS',  label: 'Atlas — Guaraníes', color: T.green,  icon: '🟢' },
  { id: 'atlas_usd', banco: 'Atlas', moneda: 'USD', label: 'Atlas — Dólares',   color: T.cyan,   icon: '🔹' },
];

// ── FORMATTERS ────────────────────────────────────────────────────────────────
const fmtGs  = n => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n || 0))}`;
const fmtUSD = n => `U$ ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 2 }).format(n || 0)}`;
const fmt    = (n, moneda) => moneda === 'USD' ? fmtUSD(n) : fmtGs(n);

// ── PROMPT DE EXTRACCIÓN ──────────────────────────────────────────────────────
const buildPrompt = (banco, moneda) => `Sos un extractor de datos de extractos bancarios paraguayos.
Banco: ${banco} | Moneda: ${moneda}

Analizá el texto del extracto y devolvé ÚNICAMENTE un JSON válido, sin texto adicional, sin backticks:

{
  "banco": "${banco}",
  "moneda": "${moneda}",
  "cuenta": "número o identificador de cuenta si es visible",
  "periodo": "YYYY-MM del período del extracto",
  "saldo_inicial": número o null,
  "saldo_final": número o null,
  "movimientos": [
    {
      "fecha": "YYYY-MM-DD",
      "descripcion": "descripción completa de la transacción",
      "monto": número (POSITIVO=ingreso/crédito, NEGATIVO=egreso/débito),
      "tipo": "credito" o "debito",
      "saldo": número o null,
      "referencia": "número de referencia o null"
    }
  ]
}

Reglas importantes:
- Los créditos (depósitos, transferencias entrantes) tienen monto POSITIVO
- Los débitos (gastos, transferencias salientes, comisiones) tienen monto NEGATIVO
- Si el extracto está en ${moneda === 'USD' ? 'dólares' : 'guaraníes'}, los montos deben ser en esa moneda
- Responde SOLO el JSON, sin ningún texto adicional`;

// ── EXTRAER TEXTO DEL PDF ─────────────────────────────────────────────────────
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

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function ConciliacionBancaria() {
  const [cuentaActiva, setCuentaActiva] = useState('ueno_gs');
  const [movimientos,  setMovimientos]  = useState({});   // { cuenta_id: [...] }
  const [procesando,   setProcesando]   = useState(false);
  const [msgProc,      setMsgProc]      = useState('');
  const [errorProc,    setErrorProc]    = useState('');
  const [search,       setSearch]       = useState('');
  const [soloNoConcil, setSoloNoConcil] = useState(false);
  const [expandIds,    setExpandIds]    = useState({});

  // Cargar movimientos de IndexedDB al iniciar
  useEffect(() => {
    const cargar = async () => {
      const todos = await DB.obtenerTodosMovimientos().catch(() => []);
      const agrupado = {};
      CUENTAS_DEFAULT.forEach(c => { agrupado[c.id] = []; });
      todos.forEach(m => {
        if (!agrupado[m.cuenta_id]) agrupado[m.cuenta_id] = [];
        agrupado[m.cuenta_id].push(m);
      });
      // Ordenar por fecha desc dentro de cada cuenta
      Object.keys(agrupado).forEach(k => {
        agrupado[k].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      });
      setMovimientos(agrupado);
    };
    cargar();
  }, []);

  const cuenta = CUENTAS_DEFAULT.find(c => c.id === cuentaActiva);
  const movsCuenta = useMemo(() => movimientos[cuentaActiva] || [], [movimientos, cuentaActiva]);

  const movsFiltrados = useMemo(() => movsCuenta.filter(m => {
    const ms = !search || (m.descripcion || '').toLowerCase().includes(search.toLowerCase()) ||
               (m.referencia || '').toLowerCase().includes(search.toLowerCase());
    const mc = !soloNoConcil || !m.conciliado;
    return ms && mc;
  }), [movsCuenta, search, soloNoConcil]);

  // Saldos calculados
  const saldos = useMemo(() => {
    const ingresos = movsCuenta.filter(m => m.monto > 0).reduce((a, m) => a + m.monto, 0);
    const egresos  = movsCuenta.filter(m => m.monto < 0).reduce((a, m) => a + m.monto, 0);
    const conciliados = movsCuenta.filter(m => m.conciliado).length;
    return { ingresos, egresos, neto: ingresos + egresos, total: movsCuenta.length, conciliados };
  }, [movsCuenta]);

  // Resumen global por banco
  const resumenGlobal = useMemo(() => {
    return CUENTAS_DEFAULT.map(c => {
      const movs = movimientos[c.id] || [];
      const neto = movs.reduce((a, m) => a + (m.monto || 0), 0);
      return { ...c, neto, count: movs.length };
    });
  }, [movimientos]);

  // ── PROCESAR PDF ────────────────────────────────────────────────────────────
  const procesarPDF = useCallback(async (file) => {
    if (!file || !cuenta) return;
    setProcesando(true);
    setErrorProc('');
    setMsgProc('Leyendo PDF...');

    try {
      const texto = await extractPdfText(file);
      setMsgProc('Extrayendo movimientos con IA...');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8000,
          system: buildPrompt(cuenta.banco, cuenta.moneda),
          messages: [{ role: 'user', content: `Extracto bancario:\n\n${texto}` }],
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error?.message || `API error ${res.status}`);

      const raw   = json.content?.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
      const datos = JSON.parse(raw);

      if (!datos.movimientos?.length) throw new Error('No se encontraron movimientos en el PDF.');

      setMsgProc(`Guardando ${datos.movimientos.length} movimientos...`);

      // Guardar en IndexedDB
      const nuevos = datos.movimientos.map((m, i) => ({
        id:         `${cuentaActiva}_${datos.periodo || 'sin-periodo'}_${i}_${Date.now()}`,
        cuenta_id:  cuentaActiva,
        fecha:      m.fecha || '',
        descripcion:m.descripcion || '',
        monto:      parseFloat(m.monto) || 0,
        tipo:       m.tipo || (m.monto >= 0 ? 'credito' : 'debito'),
        saldo:      m.saldo || null,
        referencia: m.referencia || '',
        conciliado: false,
        periodo:    datos.periodo || '',
        banco:      cuenta.banco,
        moneda:     cuenta.moneda,
        fecha_carga:new Date().toISOString(),
      }));

      for (const mov of nuevos) {
        await DB.guardarMovimiento(mov);
      }

      // Actualizar estado local
      setMovimientos(prev => {
        const actuales = prev[cuentaActiva] || [];
        const merged   = [...nuevos, ...actuales]
          .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        return { ...prev, [cuentaActiva]: merged };
      });

      setMsgProc(`✅ ${nuevos.length} movimientos importados de ${cuenta.banco} (${cuenta.moneda})`);
    } catch (e) {
      setErrorProc(`Error: ${e.message}`);
      setMsgProc('');
    } finally {
      setProcesando(false);
    }
  }, [cuenta, cuentaActiva]);

  // ── CONCILIAR / DESCONCILIAR ─────────────────────────────────────────────────
  const toggleConciliar = useCallback(async (movId) => {
    const mov = movsCuenta.find(m => m.id === movId);
    if (!mov) return;
    const actualizado = { ...mov, conciliado: !mov.conciliado };
    await DB.guardarMovimiento(actualizado);
    setMovimientos(prev => ({
      ...prev,
      [cuentaActiva]: prev[cuentaActiva].map(m => m.id === movId ? actualizado : m),
    }));
  }, [movsCuenta, cuentaActiva]);

  // ── ELIMINAR MOVIMIENTO ──────────────────────────────────────────────────────
  const eliminarMov = useCallback(async (movId) => {
    await DB.eliminarMovimiento(movId);
    setMovimientos(prev => ({
      ...prev,
      [cuentaActiva]: prev[cuentaActiva].filter(m => m.id !== movId),
    }));
  }, [cuentaActiva]);

  // ── LIMPIAR CUENTA ───────────────────────────────────────────────────────────
  const limpiarCuenta = useCallback(async () => {
    if (!window.confirm(`¿Eliminar TODOS los movimientos de ${cuenta?.label}?`)) return;
    const movs = movimientos[cuentaActiva] || [];
    for (const m of movs) await DB.eliminarMovimiento(m.id);
    setMovimientos(prev => ({ ...prev, [cuentaActiva]: [] }));
  }, [cuenta, cuentaActiva, movimientos]);

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: 14, minHeight: '70vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* ── SIDEBAR CUENTAS ── */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          fontFamily: "'DM Sans',sans-serif", marginBottom: 4 }}>CUENTAS BANCARIAS</div>

        {CUENTAS_DEFAULT.map(c => {
          const movs = movimientos[c.id] || [];
          const neto = movs.reduce((a, m) => a + (m.monto || 0), 0);
          const activa = cuentaActiva === c.id;
          return (
            <button key={c.id} onClick={() => { setCuentaActiva(c.id); setSearch(''); setSoloNoConcil(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                background: activa ? `${c.color}15` : T.surface,
                border: `1px solid ${activa ? c.color + '50' : T.border}`,
                borderLeft: activa ? `3px solid ${c.color}` : `3px solid transparent`,
                borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 12 }}>{c.icon}</span>
                <span style={{ color: activa ? c.color : T.textSecondary, fontSize: 11,
                  fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>
                  {c.banco}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700,
                  color: c.moneda === 'USD' ? T.green : T.accent,
                  background: c.moneda === 'USD' ? T.greenBg : T.accentBg,
                  padding: '1px 5px', borderRadius: 3, fontFamily: "'DM Sans',sans-serif" }}>
                  {c.moneda}
                </span>
              </div>
              <div style={{ color: neto >= 0 ? T.green : T.red, fontSize: 11,
                fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                {fmt(Math.abs(neto), c.moneda)}
              </div>
              <div style={{ color: T.textMuted, fontSize: 9, marginTop: 2,
                fontFamily: "'DM Sans',sans-serif" }}>
                {movs.length} mov · {movs.filter(m => !m.conciliado).length} pendientes
              </div>
            </button>
          );
        })}

        {/* Resumen consolidado */}
        <div style={{ marginTop: 8, background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>TOTAL CUENTAS GS</div>
          {['Ueno','Atlas'].map(banco => {
            const gs  = resumenGlobal.find(c => c.banco === banco && c.moneda === 'GS');
            const usd = resumenGlobal.find(c => c.banco === banco && c.moneda === 'USD');
            return (
              <div key={banco} style={{ marginBottom: 8 }}>
                <div style={{ color: T.textSecondary, fontSize: 10, fontWeight: 700,
                  fontFamily: "'DM Sans',sans-serif", marginBottom: 3 }}>{banco}</div>
                <div style={{ color: gs?.neto >= 0 ? T.green : T.red, fontSize: 10,
                  fontFamily: "'JetBrains Mono',monospace" }}>
                  GS: {fmtGs(gs?.neto || 0)}
                </div>
                <div style={{ color: usd?.neto >= 0 ? T.cyan : T.red, fontSize: 10,
                  fontFamily: "'JetBrains Mono',monospace" }}>
                  USD: {fmtUSD(usd?.neto || 0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header cuenta activa */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} color={cuenta?.color || T.accent} />
            <div>
              <div style={{ color: T.textPrimary, fontSize: 15, fontWeight: 800,
                fontFamily: "'Syne',sans-serif" }}>{cuenta?.label}</div>
              <div style={{ color: T.textMuted, fontSize: 10, fontFamily: "'DM Sans',sans-serif" }}>
                {saldos.total} movimientos · {saldos.conciliados} conciliados · {saldos.total - saldos.conciliados} pendientes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {movsCuenta.length > 0 && (
              <button onClick={limpiarCuenta}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
                  background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6,
                  color: T.textMuted, fontSize: 10, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                <Trash2 size={11} /> Limpiar cuenta
              </button>
            )}

            {/* UPLOAD PDF */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: procesando ? T.surface : `${cuenta?.color}15`,
              border: `1px solid ${procesando ? T.border : (cuenta?.color || T.accent) + '50'}`,
              borderRadius: 7, cursor: procesando ? 'not-allowed' : 'pointer',
              color: procesando ? T.textMuted : (cuenta?.color || T.accent),
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
              opacity: procesando ? 0.6 : 1,
            }}>
              {procesando
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Procesando…</>
                : <><Upload size={13} /> Cargar extracto PDF</>
              }
              <input type="file" accept=".pdf" style={{ display: 'none' }}
                disabled={procesando}
                onChange={e => { if (e.target.files[0]) procesarPDF(e.target.files[0]); e.target.value = ''; }} />
            </label>
          </div>
        </div>

        {/* Mensajes de procesamiento */}
        {msgProc && (
          <div style={{ background: T.greenBg, border: '1px solid rgba(52,211,153,0.3)',
            borderRadius: 8, padding: '8px 14px', color: T.green,
            fontSize: 11, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
            {procesando && <div style={{ width: 10, height: 10, borderRadius: '50%',
              background: T.green, animation: 'pulse 1.2s ease-in-out infinite' }}/>}
            {msgProc}
          </div>
        )}
        {errorProc && (
          <div style={{ background: T.redBg, border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '8px 14px', color: T.red,
            fontSize: 11, fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={13} /> {errorProc}
            <button onClick={() => setErrorProc('')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { l: 'Ingresos',  v: fmt(saldos.ingresos, cuenta?.moneda), c: T.green },
            { l: 'Egresos',   v: fmt(Math.abs(saldos.egresos), cuenta?.moneda), c: T.red },
            { l: 'Neto',      v: fmt(saldos.neto, cuenta?.moneda), c: saldos.neto >= 0 ? T.green : T.red },
            { l: 'Conciliados', v: `${saldos.conciliados} / ${saldos.total}`, c: T.cyan },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                marginBottom: 5, fontFamily: "'DM Sans',sans-serif" }}>{l.toUpperCase()}</div>
              <div style={{ color: c, fontSize: 16, fontWeight: 700,
                fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1,
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, padding: '7px 10px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar descripción o referencia…"
              style={{ background: 'none', border: 'none', outline: 'none', color: T.textPrimary,
                fontSize: 12, flex: 1, fontFamily: "'DM Sans',sans-serif" }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            color: soloNoConcil ? T.accent : T.textMuted, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>
            <input type="checkbox" checked={soloNoConcil} onChange={e => setSoloNoConcil(e.target.checked)}
              style={{ accentColor: T.accent }} />
            Solo pendientes
          </label>
        </div>

        {/* Tabla de movimientos */}
        {movsFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: T.textMuted,
            fontFamily: "'DM Sans',sans-serif" }}>
            <FileText size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              {movsCuenta.length === 0
                ? `Cargá un extracto PDF de ${cuenta?.banco} (${cuenta?.moneda}) para empezar`
                : 'No hay movimientos con ese criterio'}
            </div>
            {movsCuenta.length === 0 && (
              <div style={{ fontSize: 11, color: T.textMuted, opacity: 0.7 }}>
                El PDF puede ser el extracto mensual descargado desde el portal del banco
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Header tabla */}
            <div style={{ display: 'grid',
              gridTemplateColumns: '90px 1fr 120px 110px 100px 70px',
              padding: '8px 14px', background: T.surface,
              borderBottom: `1px solid ${T.border}` }}>
              {['Fecha', 'Descripción', 'Referencia', 'Monto', 'Saldo', 'Estado'].map(h => (
                <div key={h} style={{ color: T.textMuted, fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.08em', fontFamily: "'DM Sans',sans-serif" }}>{h.toUpperCase()}</div>
              ))}
            </div>

            {/* Filas */}
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              {movsFiltrados.map(m => {
                const esIngreso = m.monto >= 0;
                const expanded  = expandIds[m.id];
                return (
                  <div key={m.id}
                    style={{ borderBottom: `1px solid ${T.border}`,
                      background: m.conciliado ? 'rgba(52,211,153,0.03)' : 'transparent',
                      opacity: m.conciliado ? 0.75 : 1 }}>
                    <div style={{ display: 'grid',
                      gridTemplateColumns: '90px 1fr 120px 110px 100px 70px',
                      padding: '10px 14px', alignItems: 'center',
                      cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = T.cardB}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setExpandIds(p => ({ ...p, [m.id]: !p[m.id] }))}>

                      {/* Fecha */}
                      <div style={{ color: T.textMuted, fontSize: 11,
                        fontFamily: "'DM Sans',sans-serif" }}>{m.fecha || '—'}</div>

                      {/* Descripción */}
                      <div style={{ color: T.textPrimary, fontSize: 12,
                        fontFamily: "'DM Sans',sans-serif", overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {m.descripcion || '—'}
                      </div>

                      {/* Referencia */}
                      <div style={{ color: T.textMuted, fontSize: 10,
                        fontFamily: "'JetBrains Mono',monospace",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.referencia || '—'}
                      </div>

                      {/* Monto */}
                      <div style={{ color: esIngreso ? T.green : T.red, fontSize: 12,
                        fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                        {esIngreso ? '+' : ''}{fmt(m.monto, cuenta?.moneda)}
                      </div>

                      {/* Saldo */}
                      <div style={{ color: T.textSecondary, fontSize: 11,
                        fontFamily: "'JetBrains Mono',monospace" }}>
                        {m.saldo != null ? fmt(m.saldo, cuenta?.moneda) : '—'}
                      </div>

                      {/* Estado + acciones */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button onClick={e => { e.stopPropagation(); toggleConciliar(m.id); }}
                          title={m.conciliado ? 'Marcar como pendiente' : 'Marcar como conciliado'}
                          style={{
                            width: 22, height: 22, borderRadius: 4, border: 'none',
                            background: m.conciliado ? T.greenBg : T.surface,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${m.conciliado ? 'rgba(52,211,153,0.4)' : T.border}`,
                          }}>
                          {m.conciliado
                            ? <Check size={11} color={T.green} />
                            : <div style={{ width: 8, height: 8, borderRadius: 2, border: `1px solid ${T.textMuted}` }}/>}
                        </button>
                        <button onClick={e => { e.stopPropagation(); eliminarMov(m.id); }}
                          title="Eliminar movimiento"
                          style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid transparent`,
                            background: 'none', cursor: 'pointer', color: T.textMuted,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            ':hover': { color: T.red } }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Detalle expandido */}
                    {expanded && (
                      <div style={{ padding: '8px 14px 12px', background: T.cardB,
                        borderTop: `1px solid ${T.borderL}` }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {[
                            { l: 'Banco',     v: m.banco },
                            { l: 'Moneda',    v: m.moneda },
                            { l: 'Período',   v: m.periodo || '—' },
                            { l: 'Tipo',      v: m.tipo },
                            { l: 'Cargado',   v: m.fecha_carga ? m.fecha_carga.slice(0,10) : '—' },
                          ].map(({ l, v }) => (
                            <div key={l}>
                              <div style={{ color: T.textMuted, fontSize: 8, fontWeight: 700,
                                letterSpacing: '0.1em', fontFamily: "'DM Sans',sans-serif" }}>{l.toUpperCase()}</div>
                              <div style={{ color: T.textSecondary, fontSize: 11,
                                fontFamily: "'DM Sans',sans-serif", marginTop: 2 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 14px', background: T.surface,
              borderTop: `1px solid ${T.border}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ color: T.textMuted, fontSize: 10, fontFamily: "'DM Sans',sans-serif" }}>
                {movsFiltrados.length} de {movsCuenta.length} movimientos
              </span>
              <span style={{ color: T.green, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                Ingresos: {fmt(saldos.ingresos, cuenta?.moneda)}
              </span>
              <span style={{ color: T.red, fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
                Egresos: {fmt(Math.abs(saldos.egresos), cuenta?.moneda)}
              </span>
              <span style={{ color: saldos.neto >= 0 ? T.cyan : T.red, fontSize: 10,
                fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                Neto: {fmt(saldos.neto, cuenta?.moneda)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
