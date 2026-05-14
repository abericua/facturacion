import { useState, useEffect, useMemo, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;
import {
  Building2, Plus, Upload, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, DollarSign, TrendingUp, TrendingDown,
  FileText, Search, Filter, ChevronDown, ChevronUp, X,
  ArrowRightLeft, Banknote, CreditCard, Zap, Clock, Check,
  Settings, Calendar, Activity, BarChart3, Save, Edit2, Trash2
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// THEME & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const T = {
  bg:'#07080f', surface:'#0d1117', card:'#111827', cardB:'#141d2e',
  border:'#1a2535', borderL:'#243045',
  accent:'#f59e0b', accentBg:'rgba(245,158,11,0.08)',
  cyan:'#22d3ee', cyanBg:'rgba(34,211,238,0.08)',
  green:'#34d399', greenBg:'rgba(52,211,153,0.08)',
  red:'#f87171', redBg:'rgba(248,113,113,0.08)',
  purple:'#a78bfa', purpleBg:'rgba(167,139,250,0.08)',
  orange:'#fb923c', orangeBg:'rgba(251,146,60,0.08)',
  textPrimary:'#e2e8f0', textSecondary:'#7d9db5', textMuted:'#3d5470',
};

const SS = 'solpro_bancos_v2';

// Perfiles de bancos paraguayos — config por defecto (se ajusta con extractos reales)
const BANCOS_PERFIL = {
  atlas: {
    nombre: 'Banco Atlas',
    color: '#1e40af',
    formato_pdf: 'estandar',
    keywords_credito: ['ACRED', 'TRANSF.RECIBIDA', 'DEPOSITO', 'CREDITO', 'INGRESO'],
    keywords_debito:  ['DEBITO', 'TRANSF.ENVIADA', 'PAGO', 'COMISION', 'CHEQUE'],
    keywords_comision:['COMISION', 'MANTENIMIENTO', 'ITF', 'IVA SOBRE', 'SELLOS'],
  },
  ueno: {
    nombre: 'Banco Ueno',
    color: '#10b981',
    formato_pdf: 'estandar',
    keywords_credito: ['ACREDITACION', 'DEPOSITO', 'TRANSFERENCIA RECIBIDA', 'PIX'],
    keywords_debito:  ['DEBITO', 'PAGO', 'TRANSFERENCIA ENVIADA', 'EXTRACCION'],
    keywords_comision:['COMISION', 'MANTENIMIENTO', 'ITF'],
  },
  fic: {
    nombre: 'Financiera FIC',
    color: '#a855f7',
    formato_pdf: 'estandar',
    keywords_credito: ['ACRED', 'DEPOSITO', 'TRANSF', 'INGRESO'],
    keywords_debito:  ['DEBITO', 'PAGO', 'EXTRACCION', 'COMISION'],
    keywords_comision:['COMISION', 'MANTENIMIENTO', 'IVA'],
  },
};

const CATEGORIAS = [
  'Ventas / Cobranzas','Compras / Proveedores','Salarios','Gastos Fijos',
  'Importaciones','IVA / Impuestos','Anticipos IRE','Comisión Bancaria',
  'Transferencia Propia','Marketing','Otros'
];

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════════════
const loadData = () => {
  try { const s=localStorage.getItem(SS); return s?JSON.parse(s):null; } catch { return null; }
};
const saveData = (d) => {
  try { localStorage.setItem(SS,JSON.stringify(d)); } catch {}
};

const INIT = {
  cuentas: [
    { id:'c1', banco:'atlas', nombre:'Atlas Cta Cte GS',  moneda:'GS',  numero:'****', saldo_inicial:0 },
    { id:'c2', banco:'atlas', nombre:'Atlas USD',         moneda:'USD', numero:'****', saldo_inicial:0 },
    { id:'c3', banco:'ueno',  nombre:'Ueno Cta Cte GS',   moneda:'GS',  numero:'****', saldo_inicial:0 },
    { id:'c4', banco:'fic',   nombre:'FIC GS',            moneda:'GS',  numero:'****', saldo_inicial:0 },
  ],
  perfiles: { ...BANCOS_PERFIL },
  extractos: {},          // { "c1-2026-04": [movimientos] }
  movimientos: [],        // movimientos contables (manuales o desde extracto)
  tipoCambio: {},         // { "2026-04-22": { compra: 7600, venta: 7700, bcp: 7650 } }
  revaluaciones: {},      // { "c2-2026-04": { saldo_usd, tc_cierre, saldo_gs, dif_cambio } }
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const fmtGs  = n => '₲ '+new Intl.NumberFormat('es-PY').format(Math.round(n||0));
const fmtUsd = n => 'USD '+new Intl.NumberFormat('es-PY',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const fmtNum = (n,m) => m==='USD' ? fmtUsd(n) : fmtGs(n);
const uid    = () => Math.random().toString(36).slice(2,10);
const hoy    = () => new Date().toISOString().slice(0,10);
const mesAct = () => hoy().slice(0,7);

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES UI BASE
// ═══════════════════════════════════════════════════════════════════════════
const TabBtn = ({id,label,active,onClick}) => (
  <button onClick={()=>onClick(id)} style={{
    padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
    background: active ? T.accent : 'transparent',
    color: active ? '#000' : T.textSecondary,
    fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:11,
    letterSpacing:'0.06em', transition:'all 0.15s', whiteSpace:'nowrap'
  }}>{label}</button>
);

const KPI = ({label,value,sub,color=T.accent,Icon}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px',display:'flex',gap:12,alignItems:'flex-start'}}>
    {Icon && <div style={{background:`${color}18`,borderRadius:8,padding:8,flexShrink:0}}><Icon size={18} color={color}/></div>}
    <div style={{minWidth:0,flex:1}}>
      <div style={{color:T.textMuted,fontSize:8,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:3}}>{label}</div>
      <div style={{color,fontSize:17,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",overflow:'hidden',textOverflow:'ellipsis'}}>{value}</div>
      {sub && <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{sub}</div>}
    </div>
  </div>
);

const Badge = ({txt,color,bg,style={}}) => (
  <span style={{fontSize:8,fontWeight:700,color,background:bg||`${color}18`,padding:'2px 8px',borderRadius:4,fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.06em',whiteSpace:'nowrap',...style}}>{txt}</span>
);

const Input = ({label,value,onChange,type='text',placeholder='',style={}}) => (
  <div style={{display:'flex',flexDirection:'column',gap:4}}>
    {label && <label style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',
        color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none',...style}}/>
  </div>
);

const Select = ({label,value,onChange,options,style={}}) => (
  <div style={{display:'flex',flexDirection:'column',gap:4}}>
    {label && <label style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>{label}</label>}
    <select value={value} onChange={onChange}
      style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',
        color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none',...style}}>
      {options.map(o=> typeof o==='string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  </div>
);

const Btn = ({onClick,children,color=T.accent,variant='solid',Icon,size='md',disabled=false}) => {
  const sizes = { sm:'5px 11px', md:'8px 16px', lg:'10px 22px' };
  const isOutline = variant==='outline';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:isOutline?'transparent':color,
      border: isOutline?`1px solid ${color}`:'none',
      borderRadius:7, padding:sizes[size], color:isOutline?color:'#000',
      fontWeight:700, fontSize:size==='sm'?10:11, cursor:disabled?'not-allowed':'pointer',
      fontFamily:"'DM Sans',sans-serif",
      display:'inline-flex',alignItems:'center',gap:6,
      opacity:disabled?0.5:1, whiteSpace:'nowrap'
    }}>{Icon && <Icon size={size==='sm'?11:13}/>}{children}</button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PARSER PDF — extracción genérica + ajuste por banco
// ═══════════════════════════════════════════════════════════════════════════
async function extraerTextoPDF(file) {
  const ab  = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  let texto = '';
  for (let p=1; p<=pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc   = await page.getTextContent();
    let lastY  = null;
    for (const item of tc.items) {
      const y = item.transform ? item.transform[5] : null;
      if (lastY!==null && y!==null && Math.abs(y-lastY)>3) texto+='\n';
      texto += item.str + ' ';
      lastY = y;
    }
    texto += '\n--- PAGE ---\n';
  }
  return texto;
}

function parsearPDFGenerico(texto, perfilBanco) {
  const lines = texto.split('\n').map(l=>l.trim()).filter(Boolean);
  const rows  = [];
  const reDate = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/;
  const reNum  = /[\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/g;

  const parseNum = s => {
    if (!s) return 0;
    const c = s.replace(/\s/g,'');
    if (c.match(/[,.]\d{2}$/)) {
      return parseFloat(c.replace(/[.,](?=\d{3})/g,'').replace(',','.')) || 0;
    }
    return parseFloat(c.replace(/[.,]/g,'')) || 0;
  };

  for (let i=0; i<lines.length; i++) {
    const line = lines[i];
    const dm = line.match(reDate);
    if (!dm) continue;

    const d=dm[1].padStart(2,'0'), mo=dm[2].padStart(2,'0');
    let yr=dm[3]; if (yr.length===2) yr=(parseInt(yr)<50?'20':'19')+yr;
    const fecha = `${yr}-${mo}-${d}`;

    let desc = line.replace(reDate,'').replace(reNum,'').replace(/\s+/g,' ').trim();
    if (desc.length<3 && i+1<lines.length && !lines[i+1].match(reDate)) {
      desc = lines[i+1].replace(reNum,'').trim().slice(0,80);
    }
    if (!desc) desc = 'Movimiento sin descripción';

    const nums = [];
    let m; const rn = new RegExp(reNum.source,'g');
    while ((m=rn.exec(line))!==null) {
      const v = parseNum(m[0]);
      if (v>0) nums.push(v);
    }
    if (nums.length===0) continue;

    // Determinar débito/crédito por keywords del banco
    const lineUp = line.toUpperCase();
    const esCredito = perfilBanco?.keywords_credito?.some(k=>lineUp.includes(k));
    const esDebito  = perfilBanco?.keywords_debito?.some(k=>lineUp.includes(k));

    let debito=0, credito=0;
    if (nums.length===1) {
      if (esCredito) credito=nums[0];
      else if (esDebito) debito=nums[0];
      else debito=nums[0];
    } else if (nums.length===2) {
      // Asumimos [monto, saldo]
      if (esCredito) credito=nums[0];
      else if (esDebito) debito=nums[0];
      else debito=nums[0];
    } else {
      // 3+ números: típicamente [debito o 0, credito o 0, saldo]
      if (nums[0]<1000 && nums[1]>0) credito=nums[1];
      else if (nums[1]<1000 && nums[0]>0) debito=nums[0];
      else if (esCredito) credito=nums[0];
      else debito=nums[0];
    }

    if (debito===0 && credito===0) continue;

    // Detectar comisiones bancarias automáticamente
    const esComision = perfilBanco?.keywords_comision?.some(k=>lineUp.includes(k));
    const categoria  = esComision ? 'Comisión Bancaria' : null;

    rows.push({
      id:uid(), fecha, descripcion:desc.slice(0,120),
      debito:Math.round(debito), credito:Math.round(credito),
      saldo:0, conciliado:false, mov_id:null,
      categoria, sugerida:!!categoria
    });
  }
  return rows;
}

function parseExtractoCsv(text, config) {
  const lines = text.trim().split('\n');
  const sep   = text.includes(';') ? ';' : ',';
  const rows  = [];
  const start = config.hasHeader ? 1 : 0;

  for (let i=start; i<lines.length; i++) {
    const vals = []; let cur='', inQ=false;
    for (let j=0; j<lines[i].length; j++) {
      if (lines[i][j]==='"') { inQ=!inQ; continue; }
      if (lines[i][j]===sep && !inQ) { vals.push(cur.trim()); cur=''; continue; }
      cur += lines[i][j];
    }
    vals.push(cur.trim());
    if (vals.length<2) continue;

    const get = i => (vals[i]||'').replace(/[",]/g,'').trim();
    const pn  = s => parseFloat(s.replace(/[^\d.,-]/g,'').replace(',','.'))||0;

    const fecha = get(config.colFecha);
    const desc  = get(config.colDesc);
    let debito=0, credito=0;
    if (config.colDebito!=='')  debito  = pn(get(config.colDebito));
    if (config.colCredito!=='') credito = pn(get(config.colCredito));

    if (!fecha && !desc) continue;
    rows.push({ id:uid(), fecha, descripcion:desc, debito, credito,
      saldo:0, conciliado:false, mov_id:null, categoria:null, sugerida:false });
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — CUENTAS
// ═══════════════════════════════════════════════════════════════════════════
function TabCuentas({ data, setData }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ banco:'atlas', nombre:'', moneda:'GS', numero:'', saldo_inicial:'' });

  const guardar = () => {
    if (!form.nombre) return;
    const cuenta = { ...form, saldo_inicial:parseFloat(form.saldo_inicial)||0 };
    let nd;
    if (editId) {
      nd = { ...data, cuentas: data.cuentas.map(c=>c.id===editId?{...c,...cuenta}:c) };
    } else {
      nd = { ...data, cuentas: [...data.cuentas, {...cuenta, id:uid()}] };
    }
    setData(nd); saveData(nd);
    setForm({ banco:'atlas', nombre:'', moneda:'GS', numero:'', saldo_inicial:'' });
    setShowForm(false); setEditId(null);
  };

  const eliminar = (id) => {
    if (!confirm('¿Eliminar esta cuenta? También se borrarán sus movimientos.')) return;
    const nd = {
      ...data,
      cuentas: data.cuentas.filter(c=>c.id!==id),
      movimientos: data.movimientos.filter(m=>m.cuenta_id!==id),
    };
    setData(nd); saveData(nd);
  };

  const editar = (c) => {
    setForm({ banco:c.banco, nombre:c.nombre, moneda:c.moneda, numero:c.numero, saldo_inicial:String(c.saldo_inicial) });
    setEditId(c.id); setShowForm(true);
  };

  const saldoCuenta = (cid) => {
    const movs = data.movimientos.filter(m=>m.cuenta_id===cid);
    const c    = data.cuentas.find(c=>c.id===cid);
    const ini  = c?.saldo_inicial||0;
    const ent  = movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
    const sal  = movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
    return ini + ent - sal;
  };

  const opcBancos = Object.entries(data.perfiles).map(([k,v])=>({value:k, label:v.nombre}));

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
          CUENTAS BANCARIAS · {data.cuentas.length}
        </span>
        <Btn onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({ banco:'atlas', nombre:'', moneda:'GS', numero:'', saldo_inicial:'' });}} Icon={Plus}>
          Nueva Cuenta
        </Btn>
      </div>

      {showForm && (
        <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:18}}>
          <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
            {editId?'EDITAR CUENTA':'NUEVA CUENTA BANCARIA'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr',gap:12,marginBottom:12}}>
            <Select label="BANCO" value={form.banco} onChange={e=>setForm({...form,banco:e.target.value})} options={opcBancos}/>
            <Input label="NOMBRE / ALIAS" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej: Atlas Cta Cte Principal"/>
            <Select label="MONEDA" value={form.moneda} onChange={e=>setForm({...form,moneda:e.target.value})} options={['GS','USD']}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <Input label="NRO. CUENTA (últimos 4)" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} placeholder="****-1234"/>
            <Input label="SALDO INICIAL" type="number" value={form.saldo_inicial} onChange={e=>setForm({...form,saldo_inicial:e.target.value})} placeholder="0"/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn onClick={guardar} Icon={Save}>Guardar</Btn>
            <Btn onClick={()=>{setShowForm(false);setEditId(null);}} variant="outline" color={T.textSecondary}>Cancelar</Btn>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:12}}>
        {data.cuentas.map(c => {
          const saldo = saldoCuenta(c.id);
          const movs  = data.movimientos.filter(m=>m.cuenta_id===c.id);
          const perfil = data.perfiles[c.banco] || { nombre:c.banco, color:T.cyan };
          return (
            <div key={c.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:16,position:'relative'}}>
              <div style={{position:'absolute',top:10,right:10,display:'flex',gap:4}}>
                <button onClick={()=>editar(c)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted}}><Edit2 size={13}/></button>
                <button onClick={()=>eliminar(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted}}><Trash2 size={13}/></button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div style={{background:`${perfil.color}22`,borderRadius:8,padding:8}}><Building2 size={18} color={perfil.color}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>{c.nombre}</div>
                  <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{perfil.nombre} · {c.numero||'****'}</div>
                </div>
                <Badge txt={c.moneda} color={c.moneda==='USD'?T.green:T.accent}/>
              </div>
              <div style={{borderTop:`1px solid ${T.border}`,paddingTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                <div>
                  <div style={{color:T.textMuted,fontSize:8,fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.08em'}}>SALDO</div>
                  <div style={{color:saldo>=0?T.green:T.red,fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{fmtNum(saldo,c.moneda)}</div>
                </div>
                <div>
                  <div style={{color:T.textMuted,fontSize:8,fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.08em'}}>MOVS.</div>
                  <div style={{color:T.textPrimary,fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{movs.length}</div>
                </div>
                <div>
                  <div style={{color:T.textMuted,fontSize:8,fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.08em'}}>CONCIL.</div>
                  <div style={{color:T.accent,fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{movs.filter(m=>m.conciliado).length}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — TIPO DE CAMBIO BCP
// ═══════════════════════════════════════════════════════════════════════════
function TabTipoCambio({ data, setData }) {
  const [fecha, setFecha] = useState(hoy());
  const [bcp,   setBcp]   = useState('');
  const [compra,setCompra]= useState('');
  const [venta, setVenta] = useState('');

  const guardar = () => {
    if (!bcp) return;
    const nd = {
      ...data,
      tipoCambio: {
        ...data.tipoCambio,
        [fecha]: {
          bcp: parseFloat(bcp)||0,
          compra: parseFloat(compra)||parseFloat(bcp)||0,
          venta: parseFloat(venta)||parseFloat(bcp)||0,
        }
      }
    };
    setData(nd); saveData(nd);
    setBcp(''); setCompra(''); setVenta('');
  };

  const eliminar = (f) => {
    const nd = { ...data, tipoCambio: Object.fromEntries(Object.entries(data.tipoCambio).filter(([k])=>k!==f)) };
    setData(nd); saveData(nd);
  };

  const tcEntries = Object.entries(data.tipoCambio||{}).sort((a,b)=>b[0].localeCompare(a[0]));

  // Promedio del mes actual y TC de cierre
  const mesAct  = hoy().slice(0,7);
  const tcMes   = tcEntries.filter(([f])=>f.startsWith(mesAct));
  const promMes = tcMes.length ? tcMes.reduce((s,[,v])=>s+v.bcp,0)/tcMes.length : 0;
  const tcCierre= tcMes.length ? tcMes[0][1].bcp : 0;
  const tcHoy   = data.tipoCambio[hoy()]?.bcp || (tcEntries[0]?.[1].bcp || 0);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
        COTIZACIONES BCP — REGISTRO DIARIO
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        <KPI label="TC HOY (BCP)"        value={tcHoy?fmtGs(tcHoy):'—'} color={T.green}  Icon={DollarSign}/>
        <KPI label={`PROMEDIO MES ${mesAct}`} value={promMes?fmtGs(promMes):'—'} color={T.cyan} Icon={Activity}/>
        <KPI label="TC CIERRE MES"       value={tcCierre?fmtGs(tcCierre):'—'} color={T.accent} Icon={Calendar} sub="Para revaluar saldos USD"/>
      </div>

      {/* Form */}
      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:16}}>
        <div style={{color:T.cyan,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>
          REGISTRAR TIPO DE CAMBIO
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:10,alignItems:'flex-end'}}>
          <Input label="FECHA" type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
          <Input label="BCP (referencia)" type="number" value={bcp} onChange={e=>setBcp(e.target.value)} placeholder="7650"/>
          <Input label="COMPRA" type="number" value={compra} onChange={e=>setCompra(e.target.value)} placeholder="7600"/>
          <Input label="VENTA"  type="number" value={venta} onChange={e=>setVenta(e.target.value)} placeholder="7700"/>
          <Btn onClick={guardar} Icon={Save}>Guardar</Btn>
        </div>
        <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:8,fontStyle:'italic'}}>
          💡 La cotización del BCP es la referencia oficial para revaluar saldos USD al cierre mensual (exigido por DNIT).
        </div>
      </div>

      {/* Tabla histórica */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center'}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            HISTORIAL DE COTIZACIONES · {tcEntries.length} días registrados
          </span>
        </div>
        {tcEntries.length===0 ? (
          <div style={{padding:40,textAlign:'center'}}>
            <DollarSign size={28} color={T.textMuted} style={{margin:'0 auto 10px'}}/>
            <div style={{color:T.textSecondary,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>Sin cotizaciones registradas</div>
          </div>
        ) : (
          <div style={{overflowY:'auto',maxHeight:400}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:T.surface,position:'sticky',top:0}}>
                  {['FECHA','BCP','COMPRA','VENTA','SPREAD',''].map(h=>(
                    <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                      textAlign:['BCP','COMPRA','VENTA','SPREAD'].includes(h)?'right':'left',
                      borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tcEntries.map(([f,v],i)=>(
                  <tr key={f} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                    <td style={{padding:'7px 12px',color:T.textPrimary,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{f}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',color:T.green,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(v.bcp)}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',color:T.cyan,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(v.compra)}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',color:T.accent,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(v.venta)}</td>
                    <td style={{padding:'7px 12px',textAlign:'right',color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(v.venta-v.compra)}</td>
                    <td style={{padding:'7px 12px'}}>
                      <button onClick={()=>eliminar(f)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted}}><X size={13}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — IMPORTAR EXTRACTO (con perfiles de banco)
// ═══════════════════════════════════════════════════════════════════════════
function TabImportar({ data, setData }) {
  const [cuentaId, setCuentaId] = useState(data.cuentas[0]?.id||'');
  const [periodo, setPeriodo]   = useState(mesAct());
  const [csvText, setCsvText]   = useState('');
  const [preview, setPreview]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [rawText, setRawText]   = useState('');
  const [modo, setModo]         = useState('pdf');
  const [config, setConfig]     = useState({ hasHeader:true, colFecha:0, colDesc:1, colDebito:2, colCredito:3 });
  const fileRef = useRef();

  const cuenta = data.cuentas.find(c=>c.id===cuentaId);
  const perfilBanco = cuenta ? data.perfiles[cuenta.banco] : null;

  const onFilePDF = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setError(''); setLoading(true); setPreview([]); setRawText('');
    try {
      const texto = await extraerTextoPDF(f);
      setRawText(texto);
      const rows  = parsearPDFGenerico(texto, perfilBanco);
      if (rows.length===0) {
        setError('No se detectaron movimientos. El PDF puede ser una imagen escaneada o tener un formato no reconocido. Revisá el texto extraído al final.');
      }
      setPreview(rows);
    } catch(err) {
      setError('Error al leer el PDF: '+err.message);
    }
    setLoading(false);
    e.target.value='';
  };

  const onFileCSV = (e) => {
    const f=e.target.files[0]; if (!f) return;
    const r=new FileReader();
    r.onload = ev => setCsvText(ev.target.result);
    r.readAsText(f, 'latin-1');
    e.target.value='';
  };

  const generarPreviewCSV = () => {
    setPreview(parseExtractoCsv(csvText, config));
  };

  const importar = () => {
    if (preview.length===0) return;
    const key = `${cuentaId}-${periodo}`;
    const existing = data.extractos[key]||[];
    const nd = { ...data, extractos:{...data.extractos,[key]:[...existing, ...preview]} };
    setData(nd); saveData(nd);
    setCsvText(''); setPreview([]); setRawText(''); setError('');
    alert(`✅ ${preview.length} movimientos importados.`);
  };

  const editRow = (id,f,v) => setPreview(prev=>prev.map(r=>r.id===id?{...r,[f]:f==='debito'||f==='credito'?parseFloat(v)||0:v}:r));
  const delRow  = (id) => setPreview(prev=>prev.filter(r=>r.id!==id));

  const csvHeaders = useMemo(()=>{
    if (!csvText) return [];
    const sep = csvText.includes(';')?';':',';
    return (csvText.trim().split('\n')[0]||'').split(sep).map((h,i)=>`Col ${i}: ${h.replace(/"/g,'').trim().slice(0,18)}`);
  },[csvText]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>IMPORTAR EXTRACTO BANCARIO</div>

      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:16}}>
        <div style={{color:T.cyan,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>
          PASO 1 — CUENTA, PERÍODO Y FORMATO
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr 1fr',gap:10,marginBottom:12}}>
          <Select label="CUENTA" value={cuentaId} onChange={e=>setCuentaId(e.target.value)}
            options={data.cuentas.map(c=>{
              const p=data.perfiles[c.banco]; return {value:c.id, label:`${p?.nombre||''} — ${c.nombre} (${c.moneda})`};
            })}/>
          <Input label="PERÍODO" type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>FORMATO</label>
            <div style={{display:'flex',gap:6}}>
              {['pdf','csv'].map(m=>(
                <button key={m} onClick={()=>{setModo(m);setPreview([]);setError('');}}
                  style={{flex:1,padding:'8px',border:`1px solid ${modo===m?T.accent:T.border}`,borderRadius:7,
                    background:modo===m?T.accentBg:'transparent',color:modo===m?T.accent:T.textSecondary,
                    fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                  {m==='pdf'?'📄 PDF':'📊 CSV'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {perfilBanco && (
          <div style={{background:`${perfilBanco.color}10`,border:`1px solid ${perfilBanco.color}30`,borderRadius:7,padding:'8px 12px',display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <Building2 size={14} color={perfilBanco.color}/>
            <div style={{fontSize:10,color:T.textSecondary,fontFamily:"'DM Sans',sans-serif"}}>
              <strong style={{color:perfilBanco.color}}>Perfil activo: {perfilBanco.nombre}</strong> — el sistema usará las palabras clave configuradas para identificar débitos/créditos/comisiones automáticamente
            </div>
          </div>
        )}

        {modo==='pdf' && (
          <div style={{background:`${T.accent}06`,border:`1px dashed ${T.accent}40`,borderRadius:8,padding:18,textAlign:'center'}}>
            <Btn onClick={()=>fileRef.current.click()} Icon={Upload} disabled={loading}>
              {loading?'Procesando PDF...':'Subir PDF del extracto'}
            </Btn>
            <input ref={fileRef} type="file" accept=".pdf" onChange={onFilePDF} style={{display:'none'}}/>
            <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:8}}>
              El PDF se procesa localmente — no se envía a ningún servidor
            </div>
          </div>
        )}

        {modo==='csv' && (
          <div>
            <Btn onClick={()=>fileRef.current.click()} variant="outline" color={T.cyan} Icon={Upload}>Seleccionar archivo CSV</Btn>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFileCSV} style={{display:'none'}}/>
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)}
              placeholder={"Fecha,Descripcion,Debito,Credito\n01/04/2026,TRANSFERENCIA,0,5000000"}
              style={{width:'100%',minHeight:80,marginTop:10,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:10,color:T.textPrimary,fontSize:10,fontFamily:"'JetBrains Mono',monospace",outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
            {csvText && (
              <div style={{marginTop:10}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:8}}>
                  <Select label="COL. FECHA" value={config.colFecha} onChange={e=>setConfig({...config,colFecha:parseInt(e.target.value)})} options={csvHeaders.map((_,i)=>({value:i,label:csvHeaders[i]}))}/>
                  <Select label="COL. DESCRIPCIÓN" value={config.colDesc} onChange={e=>setConfig({...config,colDesc:parseInt(e.target.value)})} options={csvHeaders.map((_,i)=>({value:i,label:csvHeaders[i]}))}/>
                  <Select label="COL. DÉBITO" value={config.colDebito} onChange={e=>setConfig({...config,colDebito:parseInt(e.target.value)})} options={[{value:'',label:'—'},...csvHeaders.map((_,i)=>({value:i,label:csvHeaders[i]}))]}/>
                  <Select label="COL. CRÉDITO" value={config.colCredito} onChange={e=>setConfig({...config,colCredito:parseInt(e.target.value)})} options={[{value:'',label:'—'},...csvHeaders.map((_,i)=>({value:i,label:csvHeaders[i]}))]}/>
                </div>
                <Btn onClick={generarPreviewCSV}>Previsualizar →</Btn>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{background:T.redBg,border:`1px solid ${T.red}40`,borderRadius:7,padding:'10px 12px',display:'flex',gap:8,alignItems:'flex-start',marginTop:10}}>
            <AlertTriangle size={13} color={T.red} style={{flexShrink:0,marginTop:1}}/>
            <span style={{color:T.red,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{error}</span>
          </div>
        )}
      </div>

      {/* Preview editable */}
      {preview.length>0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{color:T.green,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>
              📋 PREVIEW · {preview.length} MOVIMIENTOS · {preview.filter(r=>r.sugerida).length} CON CATEGORÍA SUGERIDA
            </span>
            <Btn onClick={importar} Icon={CheckCircle} color={T.green}>Importar {preview.length} mov.</Btn>
          </div>
          <div style={{overflowY:'auto',maxHeight:340}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:T.surface}}>
                  {['FECHA','DESCRIPCIÓN','DÉBITO','CRÉDITO','SUGERIDO',''].map(h=>(
                    <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                      textAlign:['DÉBITO','CRÉDITO'].includes(h)?'right':'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                    <td style={{padding:'4px 8px'}}>
                      <input value={r.fecha} onChange={e=>editRow(r.id,'fecha',e.target.value)}
                        style={{background:'transparent',border:'none',color:T.textSecondary,fontSize:10,fontFamily:"'JetBrains Mono',monospace",width:88,outline:'none'}}/>
                    </td>
                    <td style={{padding:'4px 8px',maxWidth:240}}>
                      <input value={r.descripcion} onChange={e=>editRow(r.id,'descripcion',e.target.value)}
                        style={{background:'transparent',border:'none',color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif",width:'100%',outline:'none'}}/>
                    </td>
                    <td style={{padding:'4px 8px',textAlign:'right'}}>
                      <input type="number" value={r.debito||''} onChange={e=>editRow(r.id,'debito',e.target.value)}
                        style={{background:'transparent',border:'none',color:r.debito>0?T.red:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:110,textAlign:'right',outline:'none'}}/>
                    </td>
                    <td style={{padding:'4px 8px',textAlign:'right'}}>
                      <input type="number" value={r.credito||''} onChange={e=>editRow(r.id,'credito',e.target.value)}
                        style={{background:'transparent',border:'none',color:r.credito>0?T.green:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:110,textAlign:'right',outline:'none'}}/>
                    </td>
                    <td style={{padding:'4px 8px'}}>
                      {r.sugerida && r.categoria && <Badge txt={r.categoria} color={T.purple}/>}
                    </td>
                    <td style={{padding:'4px 8px'}}>
                      <button onClick={()=>delRow(r.id)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted}}><X size={12}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rawText && (
            <details style={{borderTop:`1px solid ${T.border}`}}>
              <summary style={{padding:'10px 14px',color:T.textMuted,fontSize:9,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:700,letterSpacing:'0.08em'}}>
                VER TEXTO EXTRAÍDO DEL PDF (verificación)
              </summary>
              <pre style={{margin:0,padding:'10px 14px',background:T.surface,color:T.textMuted,fontSize:9,fontFamily:"'JetBrains Mono',monospace",maxHeight:200,overflow:'auto',whiteSpace:'pre-wrap'}}>
                {rawText.slice(0,3000)}{rawText.length>3000?'\n...':''}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — CONCILIACIÓN
// ═══════════════════════════════════════════════════════════════════════════
function TabConciliacion({ data, setData }) {
  const [cuentaId, setCuentaId] = useState(data.cuentas[0]?.id||'');
  const [periodo,  setPeriodo]  = useState(mesAct());
  const [buscar,   setBuscar]   = useState('');
  const [showSolo, setShowSolo] = useState('todos');

  const cuenta   = data.cuentas.find(c=>c.id===cuentaId);
  const key      = `${cuentaId}-${periodo}`;
  const extracto = data.extractos[key]||[];

  const autoMatch = () => {
    const movs = data.movimientos.filter(m=>m.cuenta_id===cuentaId && !m.conciliado);
    let newExt  = [...extracto];
    let newMovs = [...data.movimientos];

    newExt = newExt.map(e => {
      if (e.conciliado) return e;
      const monto = e.credito>0 ? e.credito : -e.debito;
      const match = movs.find(m => {
        const mm = m.tipo==='ingreso'?m.monto:-m.monto;
        return Math.abs(mm-monto)/Math.max(Math.abs(monto),1) <= 0.01;
      });
      if (match) {
        newMovs = newMovs.map(m => m.id===match.id?{...m,conciliado:true}:m);
        return {...e, conciliado:true, mov_id:match.id};
      }
      return e;
    });

    const nd = { ...data, extractos:{...data.extractos,[key]:newExt}, movimientos:newMovs };
    setData(nd); saveData(nd);
    alert(`✅ ${newExt.filter(e=>e.conciliado).length} movimientos conciliados.`);
  };

  const conciliarManual = (extId, categoria) => {
    let newExt = extracto.map(e=>e.id===extId?{...e,conciliado:true,categoria}:e);
    const ext = extracto.find(e=>e.id===extId);
    let newMovs = [...data.movimientos];
    if (ext && (ext.debito>0||ext.credito>0) && !ext.mov_id) {
      const tcEntry = data.tipoCambio[ext.fecha] || data.tipoCambio[hoy()];
      const tc = tcEntry?.bcp || 7650;
      const monto = ext.debito>0?ext.debito:ext.credito;
      const tipo  = ext.debito>0?'egreso':'ingreso';
      const monto_gs = cuenta?.moneda==='USD'?monto*tc:monto;
      newMovs.push({
        id:uid(), cuenta_id:cuentaId, fecha:ext.fecha||hoy(),
        descripcion:ext.descripcion, monto, tipo,
        categoria, moneda:cuenta?.moneda||'GS',
        tc, monto_gs, conciliado:true, origen:'extracto'
      });
    }
    const nd = { ...data, extractos:{...data.extractos,[key]:newExt}, movimientos:newMovs };
    setData(nd); saveData(nd);
  };

  const desconciliar = (extId) => {
    let newExt = extracto.map(e=>e.id===extId?{...e,conciliado:false,mov_id:null}:e);
    const nd = { ...data, extractos:{...data.extractos,[key]:newExt} };
    setData(nd); saveData(nd);
  };

  const filtered = useMemo(()=>{
    let r = extracto;
    if (buscar) r = r.filter(x=>x.descripcion?.toLowerCase().includes(buscar.toLowerCase()));
    if (showSolo==='pendientes') r=r.filter(x=>!x.conciliado);
    if (showSolo==='conciliados') r=r.filter(x=>x.conciliado);
    return r;
  },[extracto,buscar,showSolo]);

  const totalEnt = extracto.reduce((s,e)=>s+e.credito,0);
  const totalSal = extracto.reduce((s,e)=>s+e.debito,0);
  const concil   = extracto.filter(e=>e.conciliado).length;
  const pend     = extracto.length - concil;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 14px',display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
        <Select label="CUENTA" value={cuentaId} onChange={e=>setCuentaId(e.target.value)}
          options={data.cuentas.map(c=>({value:c.id,label:`${c.nombre} (${c.moneda})`}))} style={{minWidth:200}}/>
        <Input label="PERÍODO" type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>
        <Btn onClick={autoMatch} color={T.purple} Icon={Zap}>Auto-Conciliar</Btn>
      </div>

      {extracto.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          <KPI label="ENTRADAS"    value={fmtNum(totalEnt,cuenta?.moneda)} color={T.green} Icon={TrendingUp}/>
          <KPI label="SALIDAS"     value={fmtNum(totalSal,cuenta?.moneda)} color={T.red}   Icon={TrendingDown}/>
          <KPI label="CONCILIADOS" value={`${concil} / ${extracto.length}`} color={T.accent} Icon={CheckCircle}/>
          <KPI label="PENDIENTES"  value={pend} color={pend>0?T.orange:T.green} Icon={Clock}
            sub={pend>0?`${Math.round((concil/extracto.length)*100)}% completado`:'Todo conciliado ✓'}/>
        </div>
      )}

      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>MOVIMIENTOS DEL EXTRACTO</span>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar..."
            style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 10px',color:T.textPrimary,fontSize:11,outline:'none',fontFamily:"'DM Sans',sans-serif",width:160}}/>
          <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
            {['todos','pendientes','conciliados'].map(s=>(
              <button key={s} onClick={()=>setShowSolo(s)} style={{
                padding:'5px 10px',borderRadius:6,border:'none',cursor:'pointer',
                fontSize:9,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
                background:showSolo===s?T.accent:'transparent',
                color:showSolo===s?'#000':T.textSecondary
              }}>{s.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {extracto.length===0 ? (
          <div style={{padding:50,textAlign:'center'}}>
            <Upload size={32} color={T.textMuted} style={{margin:'0 auto 10px'}}/>
            <div style={{color:T.textSecondary,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>Sin extracto para este período</div>
            <div style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginTop:4}}>Importá el extracto bancario en el tab anterior</div>
          </div>
        ) : (
          <div style={{overflowY:'auto',maxHeight:480}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:T.surface,position:'sticky',top:0}}>
                  {['ESTADO','FECHA','DESCRIPCIÓN','DÉBITO','CRÉDITO','CATEGORÍA','ACCIÓN'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                      textAlign:['DÉBITO','CRÉDITO'].includes(h)?'right':'left',
                      borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row,i)=>(
                  <FilaExtracto key={row.id} row={row} cuenta={cuenta}
                    onConciliar={(c)=>conciliarManual(row.id,c)}
                    onDesconciliar={()=>desconciliar(row.id)}
                    bg={i%2===0?'transparent':T.surface}/>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaExtracto({ row, cuenta, onConciliar, onDesconciliar, bg }) {
  const [cat, setCat] = useState(row.categoria || (row.debito>0?'Comisión Bancaria':'Ventas / Cobranzas'));
  return (
    <tr style={{borderBottom:`1px solid ${T.border}`,background:row.conciliado?`${T.green}08`:bg}}>
      <td style={{padding:'7px 12px'}}>
        {row.conciliado
          ? <Badge txt="CONCIL." color={T.green} bg={`${T.green}18`}/>
          : <Badge txt="PEND." color={T.orange} bg={`${T.orange}18`}/>}
      </td>
      <td style={{padding:'7px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap'}}>{row.fecha}</td>
      <td style={{padding:'7px 12px',maxWidth:220}}>
        <div style={{color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.descripcion}</div>
        {row.sugerida && <div style={{color:T.purple,fontSize:8,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>↗ categoría sugerida</div>}
      </td>
      <td style={{padding:'7px 12px',textAlign:'right'}}>
        {row.debito>0 && <span style={{color:T.red,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtNum(row.debito,cuenta?.moneda||'GS')}</span>}
      </td>
      <td style={{padding:'7px 12px',textAlign:'right'}}>
        {row.credito>0 && <span style={{color:T.green,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtNum(row.credito,cuenta?.moneda||'GS')}</span>}
      </td>
      <td style={{padding:'7px 12px'}}>
        {!row.conciliado && (
          <select value={cat} onChange={e=>setCat(e.target.value)}
            style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:'3px 6px',color:T.textPrimary,fontSize:9,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
            {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
          </select>
        )}
        {row.conciliado && row.categoria && <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{row.categoria}</span>}
      </td>
      <td style={{padding:'7px 12px'}}>
        {!row.conciliado
          ? <button onClick={()=>onConciliar(cat)} style={{background:`${T.green}18`,border:`1px solid ${T.green}40`,borderRadius:6,padding:'4px 10px',color:T.green,fontSize:9,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:700,display:'flex',alignItems:'center',gap:4}}><Check size={10}/> Conciliar</button>
          : <button onClick={onDesconciliar} style={{background:`${T.red}10`,border:'none',borderRadius:6,padding:'4px 10px',color:T.textMuted,fontSize:9,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Deshacer</button>
        }
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5 — REVALUACIÓN USD
// ═══════════════════════════════════════════════════════════════════════════
function TabRevaluacion({ data, setData }) {
  const [periodo, setPeriodo] = useState(mesAct());

  const cuentasUSD = data.cuentas.filter(c=>c.moneda==='USD');

  // TC del último día del período seleccionado
  const tcCierre = useMemo(()=>{
    const tcs = Object.entries(data.tipoCambio||{}).filter(([f])=>f.startsWith(periodo));
    if (tcs.length===0) return null;
    const sorted = tcs.sort((a,b)=>b[0].localeCompare(a[0]));
    return { fecha:sorted[0][0], tc:sorted[0][1].bcp };
  },[data.tipoCambio,periodo]);

  // Saldo de cada cuenta USD a la fecha de cierre
  const calcSaldoUSD = (cid) => {
    const movs = data.movimientos.filter(m=>m.cuenta_id===cid);
    const c    = data.cuentas.find(x=>x.id===cid);
    return (c?.saldo_inicial||0)
      + movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0)
      - movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  };

  const ejecutarRevaluacion = () => {
    if (!tcCierre) { alert('No hay TC registrado para este mes'); return; }
    if (!confirm(`Revaluar saldos USD al ${tcCierre.fecha} con TC ${fmtGs(tcCierre.tc)}?`)) return;

    const nuevasReval = { ...data.revaluaciones };
    const nuevosMovs  = [...data.movimientos];

    cuentasUSD.forEach(c => {
      const saldoUsd = calcSaldoUSD(c.id);
      const saldoGsActual = saldoUsd * tcCierre.tc;
      const key = `${c.id}-${periodo}`;
      const reval_anterior = data.revaluaciones[`${c.id}-${periodo.slice(0,4)}-${String(parseInt(periodo.slice(5))-1).padStart(2,'0')}`];
      const saldoGsAnterior = reval_anterior?.saldo_gs || (saldoUsd * (tcCierre.tc));
      const difCambio = saldoGsActual - saldoGsAnterior;

      nuevasReval[key] = {
        cuenta_id:c.id, periodo, fecha:tcCierre.fecha,
        saldo_usd:saldoUsd, tc_cierre:tcCierre.tc,
        saldo_gs:saldoGsActual, dif_cambio:difCambio,
      };

      // Crear asiento de diferencia de cambio si hay variación
      if (Math.abs(difCambio)>1) {
        nuevosMovs.push({
          id:uid(), cuenta_id:c.id, fecha:tcCierre.fecha,
          descripcion:`Revaluación cierre ${periodo} — TC ${fmtGs(tcCierre.tc)}`,
          monto:Math.abs(difCambio)/tcCierre.tc, // monto en USD equivalente
          tipo:difCambio>0?'ingreso':'egreso',
          categoria:'Diferencia de Cambio', moneda:'USD',
          tc:tcCierre.tc, monto_gs:Math.abs(difCambio),
          conciliado:true, origen:'revaluacion'
        });
      }
    });

    const nd = { ...data, revaluaciones:nuevasReval, movimientos:nuevosMovs };
    setData(nd); saveData(nd);
    alert(`✅ Revaluación ejecutada para ${cuentasUSD.length} cuenta(s) USD.`);
  };

  const revalsPeriodo = cuentasUSD.map(c => ({
    cuenta:c,
    reval: data.revaluaciones[`${c.id}-${periodo}`],
    saldoUsd: calcSaldoUSD(c.id),
  }));

  const totalUsd = revalsPeriodo.reduce((s,r)=>s+r.saldoUsd,0);
  const totalGs  = tcCierre ? totalUsd*tcCierre.tc : 0;
  const totalDif = revalsPeriodo.reduce((s,r)=>s+(r.reval?.dif_cambio||0),0);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>REVALUACIÓN MENSUAL DE SALDOS USD</span>
        <Input type="month" value={periodo} onChange={e=>setPeriodo(e.target.value)}/>
        <Btn onClick={ejecutarRevaluacion} Icon={RefreshCw} color={T.purple} disabled={!tcCierre || cuentasUSD.length===0}>
          Ejecutar Revaluación
        </Btn>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <KPI label="CUENTAS USD"         value={cuentasUSD.length} color={T.green}  Icon={DollarSign}/>
        <KPI label="TC CIERRE"           value={tcCierre?fmtGs(tcCierre.tc):'—'} color={T.cyan} Icon={Calendar} sub={tcCierre?.fecha}/>
        <KPI label="SALDO TOTAL USD"     value={fmtUsd(totalUsd)} color={T.accent} Icon={Banknote}/>
        <KPI label="DIF. CAMBIO PERÍODO" value={fmtGs(totalDif)} color={totalDif>=0?T.green:T.red} Icon={totalDif>=0?TrendingUp:TrendingDown}/>
      </div>

      {!tcCierre && (
        <div style={{background:T.redBg,border:`1px solid ${T.red}40`,borderRadius:8,padding:'10px 14px',display:'flex',gap:10,alignItems:'center'}}>
          <AlertTriangle size={14} color={T.red}/>
          <span style={{color:T.red,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
            No hay tipo de cambio registrado para {periodo}. Cargá el TC del BCP en la pestaña "Tipo de Cambio" para poder revaluar.
          </span>
        </div>
      )}

      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>DETALLE POR CUENTA — {periodo}</span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:T.surface}}>
              {['CUENTA','SALDO USD','TC APLICADO','SALDO EN GS','DIF. CAMBIO','ESTADO'].map(h=>(
                <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                  textAlign:['SALDO USD','TC APLICADO','SALDO EN GS','DIF. CAMBIO'].includes(h)?'right':'left',
                  borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {revalsPeriodo.length===0 ? (
              <tr><td colSpan={6} style={{padding:30,textAlign:'center',color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>No hay cuentas USD configuradas</td></tr>
            ) : revalsPeriodo.map((r,i)=>(
              <tr key={r.cuenta.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                <td style={{padding:'8px 12px',color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{r.cuenta.nombre}</td>
                <td style={{padding:'8px 12px',textAlign:'right',color:T.green,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtUsd(r.saldoUsd)}</td>
                <td style={{padding:'8px 12px',textAlign:'right',color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{r.reval?fmtGs(r.reval.tc_cierre):tcCierre?fmtGs(tcCierre.tc):'—'}</td>
                <td style={{padding:'8px 12px',textAlign:'right',color:T.accent,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{r.reval?fmtGs(r.reval.saldo_gs):tcCierre?fmtGs(r.saldoUsd*tcCierre.tc):'—'}</td>
                <td style={{padding:'8px 12px',textAlign:'right'}}>
                  {r.reval ? (
                    <span style={{color:r.reval.dif_cambio>=0?T.green:T.red,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                      {r.reval.dif_cambio>=0?'+':''}{fmtGs(r.reval.dif_cambio)}
                    </span>
                  ) : <span style={{color:T.textMuted,fontSize:10}}>—</span>}
                </td>
                <td style={{padding:'8px 12px'}}>
                  {r.reval
                    ? <Badge txt="REVALUADO" color={T.green}/>
                    : <Badge txt="PENDIENTE" color={T.orange}/>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{background:`${T.cyan}06`,border:`1px solid ${T.cyan}30`,borderRadius:8,padding:'12px 16px'}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
          <Activity size={14} color={T.cyan} style={{flexShrink:0,marginTop:2}}/>
          <div style={{fontSize:10,color:T.textSecondary,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5}}>
            <strong style={{color:T.cyan}}>¿Cómo funciona?</strong> La revaluación mensual es exigida por la DNIT para empresas con saldos en moneda extranjera.
            El sistema toma el saldo en USD de cada cuenta, lo multiplica por el TC del BCP del último día del mes, y registra automáticamente
            la <strong>diferencia de cambio</strong> como ganancia o pérdida cambiaria en el P&L. Esa diferencia es deducible para el IRE.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6 — MOVIMIENTOS
// ═══════════════════════════════════════════════════════════════════════════
function TabMovimientos({ data, setData }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ cuenta_id:data.cuentas[0]?.id||'', fecha:hoy(), descripcion:'', monto:'', tipo:'ingreso', categoria:CATEGORIAS[0], moneda:'GS', tc:'' });
  const [buscar, setBuscar]   = useState('');
  const [filtCta, setFiltCta] = useState('todas');

  const guardar = () => {
    if (!form.monto || !form.descripcion) return;
    const cuenta = data.cuentas.find(c=>c.id===form.cuenta_id);
    const tc     = parseFloat(form.tc || data.tipoCambio[hoy()]?.bcp || 7650);
    const monto  = parseFloat(form.monto)||0;
    const monto_gs = cuenta?.moneda==='USD'?monto*tc:monto;
    const mov = { ...form, id:uid(), monto, tc, monto_gs, conciliado:false, origen:'manual' };
    const nd = { ...data, movimientos:[...data.movimientos, mov] };
    setData(nd); saveData(nd);
    setForm({ cuenta_id:form.cuenta_id, fecha:hoy(), descripcion:'', monto:'', tipo:'ingreso', categoria:CATEGORIAS[0], moneda:cuenta?.moneda||'GS', tc:'' });
    setShowForm(false);
  };

  const eliminar = (id) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    const nd = { ...data, movimientos:data.movimientos.filter(m=>m.id!==id) };
    setData(nd); saveData(nd);
  };

  const movsFilt = useMemo(()=>{
    let r = data.movimientos;
    if (filtCta!=='todas') r=r.filter(m=>m.cuenta_id===filtCta);
    if (buscar) r=r.filter(m=>m.descripcion?.toLowerCase().includes(buscar.toLowerCase())||m.categoria?.toLowerCase().includes(buscar.toLowerCase()));
    return [...r].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  },[data.movimientos,filtCta,buscar]);

  const totIng = movsFilt.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto_gs,0);
  const totEgr = movsFilt.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto_gs,0);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>MOVIMIENTOS CONTABLES</span>
        <select value={filtCta} onChange={e=>setFiltCta(e.target.value)}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 10px',color:T.textPrimary,fontSize:11,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
          <option value="todas">Todas las cuentas</option>
          {data.cuentas.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar..."
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 10px',color:T.textPrimary,fontSize:11,outline:'none',fontFamily:"'DM Sans',sans-serif",width:160}}/>
        <Btn onClick={()=>setShowForm(!showForm)} Icon={Plus}>Registrar Movimiento</Btn>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        <KPI label="INGRESOS GS" value={fmtGs(totIng)} color={T.green} Icon={TrendingUp}/>
        <KPI label="EGRESOS GS"  value={fmtGs(totEgr)} color={T.red}   Icon={TrendingDown}/>
        <KPI label="RESULTADO"   value={fmtGs(totIng-totEgr)} color={totIng>totEgr?T.green:T.red} Icon={ArrowRightLeft}/>
      </div>

      {showForm && (
        <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:16}}>
          <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>NUEVO MOVIMIENTO</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
            <Select label="CUENTA" value={form.cuenta_id} onChange={e=>{
              const c=data.cuentas.find(x=>x.id===e.target.value);
              setForm({...form,cuenta_id:e.target.value,moneda:c?.moneda||'GS'});
            }} options={data.cuentas.map(c=>({value:c.id,label:c.nombre}))}/>
            <Select label="TIPO" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})} options={['ingreso','egreso']}/>
            <Select label="CATEGORÍA" value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} options={CATEGORIAS}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr 1fr 1fr',gap:10,marginBottom:12}}>
            <Input label="FECHA" type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/>
            <Input label="DESCRIPCIÓN" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} placeholder="Ej: Cobro factura #001"/>
            <Input label={`MONTO (${form.moneda})`} type="number" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})} placeholder="0"/>
            {form.moneda==='USD' && <Input label="T.C." type="number" value={form.tc} onChange={e=>setForm({...form,tc:e.target.value})} placeholder="7650"/>}
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn onClick={guardar} Icon={Save}>Guardar</Btn>
            <Btn onClick={()=>setShowForm(false)} variant="outline" color={T.textSecondary}>Cancelar</Btn>
          </div>
        </div>
      )}

      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{overflowY:'auto',maxHeight:440}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:T.surface,position:'sticky',top:0}}>
                {['FECHA','DESCRIPCIÓN','CATEGORÍA','CUENTA','MONTO','MONTO GS','TIPO','✓',''].map(h=>(
                  <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                    textAlign:['MONTO','MONTO GS'].includes(h)?'right':'left',
                    borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movsFilt.map((m,i)=>{
                const c=data.cuentas.find(x=>x.id===m.cuenta_id);
                return (
                  <tr key={m.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                    <td style={{padding:'6px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap'}}>{m.fecha}</td>
                    <td style={{padding:'6px 12px',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      <span style={{color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{m.descripcion}</span>
                      {m.origen==='revaluacion' && <Badge txt="REVAL" color={T.purple} style={{marginLeft:6}}/>}
                    </td>
                    <td style={{padding:'6px 12px'}}><Badge txt={m.categoria||'—'} color={T.textSecondary}/></td>
                    <td style={{padding:'6px 12px',color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{c?.nombre||'—'}</td>
                    <td style={{padding:'6px 12px',textAlign:'right',color:m.tipo==='ingreso'?T.green:T.red,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtNum(m.monto,m.moneda)}</td>
                    <td style={{padding:'6px 12px',textAlign:'right',color:m.tipo==='ingreso'?T.green:T.red,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(m.monto_gs)}</td>
                    <td style={{padding:'6px 12px'}}><Badge txt={m.tipo.toUpperCase()} color={m.tipo==='ingreso'?T.green:T.red}/></td>
                    <td style={{padding:'6px 12px'}}>{m.conciliado?<CheckCircle size={13} color={T.green}/>:<Clock size={13} color={T.orange}/>}</td>
                    <td style={{padding:'6px 12px'}}>
                      <button onClick={()=>eliminar(m.id)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted}}><X size={13}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ConciliacionBancaria() {
  const [data, setData] = useState(()=>{
    const stored = loadData();
    if (stored) {
      // Asegurar que perfiles esté presente (migración desde v1)
      if (!stored.perfiles) stored.perfiles = { ...BANCOS_PERFIL };
      if (!stored.revaluaciones) stored.revaluaciones = {};
      return stored;
    }
    return INIT;
  });
  const [tab,  setTab]  = useState('cuentas');

  const totalGs  = data.cuentas.filter(c=>c.moneda==='GS').reduce((s,c)=>{
    const movs=data.movimientos.filter(m=>m.cuenta_id===c.id);
    return s+(c.saldo_inicial||0)+movs.filter(m=>m.tipo==='ingreso').reduce((a,b)=>a+b.monto,0)-movs.filter(m=>m.tipo==='egreso').reduce((a,b)=>a+b.monto,0);
  },0);
  const totalUsd = data.cuentas.filter(c=>c.moneda==='USD').reduce((s,c)=>{
    const movs=data.movimientos.filter(m=>m.cuenta_id===c.id);
    return s+(c.saldo_inicial||0)+movs.filter(m=>m.tipo==='ingreso').reduce((a,b)=>a+b.monto,0)-movs.filter(m=>m.tipo==='egreso').reduce((a,b)=>a+b.monto,0);
  },0);
  const pendExt = Object.values(data.extractos).flat().filter(e=>!e.conciliado).length;

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.12em',marginBottom:2}}>MÓDULO BANCARIO v2</div>
          <h1 style={{margin:0,color:T.textPrimary,fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>
            Conciliación <span style={{color:T.accent}}>Atlas · Ueno · FIC</span>
          </h1>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{textAlign:'right'}}>
            <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em'}}>SALDO GS</div>
            <div style={{color:T.accent,fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(totalGs)}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em'}}>SALDO USD</div>
            <div style={{color:T.green,fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtUsd(totalUsd)}</div>
          </div>
          {pendExt>0 && (
            <div style={{background:T.redBg,border:`1px solid ${T.red}40`,borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:5}}>
              <AlertTriangle size={12} color={T.red}/>
              <span style={{color:T.red,fontSize:9,fontWeight:700}}>{pendExt} sin conciliar</span>
            </div>
          )}
        </div>
      </div>

      <div style={{display:'flex',gap:3,background:T.card,borderRadius:10,padding:4,border:`1px solid ${T.border}`,width:'fit-content',flexWrap:'wrap'}}>
        <TabBtn id="cuentas"      label="🏦 Cuentas"      active={tab==='cuentas'}      onClick={setTab}/>
        <TabBtn id="tc"           label="💱 Tipo de Cambio" active={tab==='tc'}         onClick={setTab}/>
        <TabBtn id="importar"     label="📥 Importar"     active={tab==='importar'}     onClick={setTab}/>
        <TabBtn id="conciliacion" label="⚖️ Conciliación" active={tab==='conciliacion'} onClick={setTab}/>
        <TabBtn id="revaluacion"  label="🔄 Revaluación USD" active={tab==='revaluacion'} onClick={setTab}/>
        <TabBtn id="movimientos"  label="📋 Movimientos"  active={tab==='movimientos'}  onClick={setTab}/>
      </div>

      {tab==='cuentas'      && <TabCuentas      data={data} setData={setData}/>}
      {tab==='tc'           && <TabTipoCambio   data={data} setData={setData}/>}
      {tab==='importar'     && <TabImportar     data={data} setData={setData}/>}
      {tab==='conciliacion' && <TabConciliacion data={data} setData={setData}/>}
      {tab==='revaluacion'  && <TabRevaluacion  data={data} setData={setData}/>}
      {tab==='movimientos'  && <TabMovimientos  data={data} setData={setData}/>}
    </div>
  );
}
