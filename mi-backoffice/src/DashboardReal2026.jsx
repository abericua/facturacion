const KPICard = ({ label, value, Icon, badge, color }) => ( <div style={{ background: T.card, border: String.fromCharCode(96)+'1px solid '+T.border+String.fromCharCode(96), borderRadius: 10, padding: '16px 18px', flex: 1, minWidth: 0 }}> <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}> <div style={{ minWidth: 0, flex: 1 }}> <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'DM Sans,sans-serif' }}> {label.toUpperCase()} </div> <div style={{ color: T.textPrimary, fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', letterSpacing: '-0.02em', lineHeight: 1 }}> {value} </div> {badge && ( <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg }}> {badge.text} </div> )} </div> <div style={{ background: String.fromCharCode(96)+color+'18'+String.fromCharCode(96), borderRadius: 8, padding: 9, color, flexShrink: 0 }}> <Icon size={18} /> </div> </div> </div> );
const ChartTip = ({active,payload,label}) => { if(!active||!payload?.length) return null; return ( <div style={{background:T.cardB,border:String.fromCharCode(96)+'1px solid '+T.borderL+String.fromCharCode(96),borderRadius:8,padding:'10px 14px',minWidth:130}}> <p style={{color:T.textSecondary,fontSize:11,marginBottom:7,fontFamily:'DM Sans,sans-serif',fontWeight:600}}>{label}</p> {payload.map((p,i)=>( <p key={i} style={{color:p.color,fontSize:12,fontFamily:'JetBrains Mono,monospace',fontWeight:600,marginBottom:2}}> <span style={{color:T.textMuted,fontSize:10,fontFamily:'DM Sans,sans-serif'}}>{p.name}: </span> {p.value} </p> ))} </div> ); };
const AlertBox = ({ type, icon: Icon, title, children }) => { const styles = { success: { bg: T.greenBg, border: T.green, color: T.green }, warning: { bg: T.accentBg, border: T.accent, color: T.accent }, error: { bg: T.redBg, border: T.red, color: T.red }, info: { bg: T.cyanBg, border: T.cyan, color: T.cyan } }; const s = styles[type] || styles.info; return ( <div style={{ background: s.bg, border: String.fromCharCode(96)+'1px solid '+s.border+String.fromCharCode(96), borderRadius: 10, padding: '14px 16px', marginTop: 16 }}> <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}> <div style={{ color: s.color, flexShrink: 0, marginTop: 2 }}> <Icon size={18} /> </div> <div style={{ flex: 1, minWidth: 0 }}> <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: 'DM Sans,sans-serif' }}> {title} </div> <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.5, fontFamily: 'DM Sans,sans-serif' }}> {children} </div> </div> </div> </div> ); };
import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  AlertTriangle, Edit3, CheckCircle, Shield, Package, Calendar
} from "lucide-react";
import DB from './db.js';
import SyncBridge from './SyncBridge.js';

import T from './theme.js';
import { MARGENES_MULT as MARGEN_POR_LINEA, MARGEN_DEFAULT, BANDA_PISO_PTS, BANDA_TECHO_PTS, RECARGO_DIGITAL } from './constants.js';

const MONTHS    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_MAP = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sept:8,sep:8,oct:9,nov:10,dic:11};

// ── DYNAMIC CATALOG MATCHING ──────────────────────────────────────────────────
function parsePricesCSV(text) {
  const lines = text.split('\n').filter(l=>l.trim());
  const map = [];
  for (let i=1; i<lines.length; i++) {
    // Basic CSV parse handling quotes:
    const row = lines[i];
    const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (cols.length < 5) continue;
    
    const nombre = cols[0].replace(/"/g, '').toUpperCase();
    const costo = parseFloat(cols[4]) || 0;
    const moneda = cols[5]?.replace(/"/g, '').trim() || 'GS';
    const linea = cols[3]?.replace(/"/g, '').trim() || 'OTRO';
    
    // Create keywords from name
    const kw = [
      nombre, 
      nombre.replace('IMPRESORA EPSON ', 'L').replace(' ', ''),
      nombre.replace('SURECOLOR ', 'F').replace(' ', ''),
      nombre.replace('COMBO: IMPRESORA EPSON ', '').replace(' + ', ' ')
    ];
    
    map.push({ kw, nombre, costo, moneda, linea });
  }
  return map;
}

// MARGEN_POR_LINEA, MARGEN_DEFAULT → importados desde ./constants.js

function getPrice(desc, priceMap) {
  const d = desc.toUpperCase();
  // 1. Try exact or keyword match against dynamic price map
  for (const p of priceMap) {
    if (p.kw.some(k => d.includes(k))) {
      const factor = MARGEN_POR_LINEA[p.linea?.toUpperCase()] ?? MARGEN_DEFAULT;
      const gs = p.moneda === 'GS' ? p.costo * factor : null;
      const usd = p.moneda === 'USD' ? p.costo * factor : null;
      return { gs, usd, label: p.nombre, linea: p.linea, matched: true, costo: p.costo, moneda: p.moneda };
    }
  }
  // 2. Fallbacks for standard formats if missing in map
  if (d.includes(' L') && /[0-9]{3,}/.test(d)) return { gs:1590000, usd:null, label:'IMP Epson', linea:'COMERCIAL', matched:false };
  if (d.includes(' T') || d.includes(' F')) return { gs:null, usd:2000, label:'Plotter', linea:'INDUSTRIAL', matched:false };
  return { gs:null, usd:null, label:'Sin precio', linea:'OTRO', matched:false };
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split('-');
  if (parts.length < 3) return null;
  const month = MONTH_MAP[parts[1]?.toLowerCase()];
  const year  = parseInt(parts[2]) < 100 ? 2000+parseInt(parts[2]) : parseInt(parts[2]);
  if (month===undefined||isNaN(year)) return null;
  return { month, year, quarter:Math.floor(month/3) };
}

function parseSalesCSV(text, priceMap) {
  const lines = text.split('\n').filter(l=>l.trim());
  const rows  = [];
  for (let i=1; i<lines.length; i++) {
    const cols  = lines[i].split(';');
    if (cols.length < 3) continue;
    const fecha = parseDate(cols[0]?.trim());
    const qty   = parseInt(cols[1]?.trim()) || 0;
    const desc  = cols[2]?.trim() || '';
    if (!fecha||qty<=0||!desc) continue;
    rows.push({ fecha, qty, desc, price:getPrice(desc, priceMap) });
  }
  return rows;
}


// ── FORMATTERS ────────────────────────────────────────────────────────────────
const fmtGs = n => `Gs ${new Intl.NumberFormat('es-PY').format(Math.round(n || 0))}`;
const fmtUSD    = n => `$${new Intl.NumberFormat('es-PY').format(Math.round(n))} USD`;
const fmtN      = n => new Intl.NumberFormat('es-PY').format(n);

// ── UI ────────────────────────────────────────────────────────────────────────

const KPI = ({label,value,sub,color,Icon,trend}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'13px 15px',flex:1,minWidth:0}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
      <div style={{minWidth:0,flex:1}}>
        <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{label.toUpperCase()}</div>
        <div style={{color:T.textPrimary,fontSize:17,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1,wordBreak:'break-word'}}>{value}</div>
        {sub&&<div style={{color:T.textMuted,fontSize:10,marginTop:5,fontFamily:"'DM Sans',sans-serif"}}>{sub}</div>}
      </div>
      {Icon&&<div style={{background:`${color}18`,borderRadius:8,padding:9,color,flexShrink:0}}><Icon size={16}/></div>}
    </div>
    {trend!==undefined&&(
      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:8,fontSize:11,color:trend>=0?T.green:T.red}}>
        {trend>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{trend>0?'+':''}{trend}%</span>
        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}> vs año anterior</span>
      </div>
    )}
  </div>
);

const SH = ({title}) => (
  <h2 style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:'0.04em',marginBottom:12}}>{title}</h2>
);

const TabBtn = ({id,label,active,setTab}) => (
  <button onClick={()=>setTab(id)} style={{padding:'8px 15px',border:'none',background:'transparent',
    color:active?T.accent:T.textSecondary,
    borderBottom:active?`2px solid ${T.accent}`:'2px solid transparent',
    cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:-1,whiteSpace:'nowrap'}}>
    {label}
  </button>
);

const Chip = ({label,active,color,onClick}) => (
  <button onClick={onClick} style={{padding:'4px 10px',borderRadius:4,
    border:`1px solid ${active?(color||T.accent):T.border}`,
    background:active?`${color||T.accent}15`:'transparent',
    color:active?(color||T.accent):T.textSecondary,
    fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
    {label}
  </button>
);

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function DashboardReal() {
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [usdMercado, setUsdMercado] = useState(7650);
  const [editUsd,    setEditUsd]    = useState(false);
  const [tempUsd,    setTempUsd]    = useState('7650');
  const [tcGuardado, setTcGuardado] = useState(false); // feedback visual al guardar
  const [tab,        setTab]        = useState('mensual');
  const [yearFilter, setYearFilter] = useState('Todos');
  const [compras, setCompras] = useState([]);
  const [ivaData, setIvaData] = useState([]);

  const bandaPiso  = usdMercado + BANDA_PISO_PTS;
  const bandaTecho = usdMercado + BANDA_TECHO_PTS;

  const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL || 'https://facturacion-production-3916.up.railway.app';
  const BRIDGE_KEY = import.meta.env.VITE_BRIDGE_KEY || 'sgsp-bridge-2026';
  const bh = { 'x-api-key': BRIDGE_KEY };

  // Cargar TC guardado al iniciar
  useEffect(()=>{
    DB.obtenerConfig('tipo_cambio_usd').then(cfg=>{
      if (cfg?.valor) { setUsdMercado(cfg.valor); setTempUsd(String(cfg.valor)); }
    }).catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    const cargarDatos = async () => {
      // 1. Intentar cargar desde caché local (IndexedDB) primero
      const cacheVentas   = await DB.obtenerCatalogo('_cache_ventas_csv').catch(()=>null);
      const cachePrecios  = await DB.obtenerCatalogo('_cache_precios_csv').catch(()=>null);

      if (cacheVentas?.productos && cachePrecios?.productos) {
        const map = parsePricesCSV(cachePrecios.productos);
        setData(parseSalesCSV(cacheVentas.productos, map));
        setLoading(false);
        // Igual intenta actualizar desde Railway en segundo plano
      }

      // 2. Traer desde Railway (actualiza caché aunque ya había datos locales)
      try {
        const [txtVentas, txtPrecios] = await Promise.all([
          fetch(`${BRIDGE_URL}/api/bridge/ventas/csv`,    { headers: bh }).then(r=>{ if(!r.ok) throw new Error('Sin ventas en Railway'); return r.text(); }),
          fetch(`${BRIDGE_URL}/api/bridge/productos/csv`, { headers: bh }).then(r=>{ if(!r.ok) throw new Error('Sin catálogo en Railway'); return r.text(); })
        ]);
        // Guardar en caché para la próxima sesión
        await DB.guardarCatalogo('_cache_ventas_csv',  txtVentas);
        await DB.guardarCatalogo('_cache_precios_csv', txtPrecios);
        const map = parsePricesCSV(txtPrecios);
        setData(parseSalesCSV(txtVentas, map));
        setLoading(false);
      } catch(e) {
        // Si falla Railway pero teníamos caché, no mostrar error
        if (!cacheVentas) { setError(e.message); setLoading(false); }
      }
    };
    cargarDatos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(() => {
    const recargarComprasIVA = () => {
      DB.obtenerTodasCompras().then(data => { if (data?.length) setCompras(data); }).catch(()=>{});
      DB.obtenerIVAPorAnio('2026').then(data => { if (data?.length) setIvaData(data); }).catch(()=>{});
    };

    // Carga inmediata desde IndexedDB
    recargarComprasIVA();

    // Re-lee cuando SyncBridge termina pullAll (fix race condition cross-device)
    const unsub = SyncBridge.subscribe(({ status }) => {
      if (status === 'ok') recargarComprasIVA();
    });
    return unsub;
  }, []);

  const years = useMemo(()=>['Todos',...([...new Set(data.map(d=>d.fecha.year))].sort())],[data]);

  const filtered = useMemo(()=>
    yearFilter==='Todos'?data:data.filter(d=>d.fecha.year===parseInt(yearFilter))
  ,[data,yearFilter]);

  const withRevenue = useMemo(()=>filtered.map(d=>{
    let revGs = 0;
    if (d.price.gs)  revGs = d.price.gs  * d.qty;
    if (d.price.usd) revGs = d.price.usd * d.qty * bandaPiso;
    return {...d, revGs};
  }),[filtered, bandaPiso]);

  const totalRevGs = useMemo(()=>withRevenue.reduce((a,b)=>a+b.revGs,0),[withRevenue]);
  const totalRevDigital = totalRevGs * (1 + RECARGO_DIGITAL);
  const totalQty        = useMemo(()=>withRevenue.reduce((a,b)=>a+b.qty,0),[withRevenue]);
  const matchedRows     = useMemo(()=>withRevenue.filter(d=>d.price.matched),[withRevenue]);
  const unmatched       = useMemo(()=>withRevenue.filter(d=>!d.price.matched),[withRevenue]);
  const matchPct        = withRevenue.length>0?Math.round((matchedRows.length/withRevenue.length)*100):0;
  const totalUSD        = useMemo(()=>filtered.filter(d=>d.price.usd).reduce((a,b)=>a+b.price.usd*b.qty,0),[filtered]);

  function parseFechaCompra(str) {
    if (!str) return null;
    const p = str.split('/');
    if (p.length < 3) return null;
    const month = parseInt(p[1]) - 1;
    const year  = parseInt(p[2]) < 100 ? 2000 + parseInt(p[2]) : parseInt(p[2]);
    return isNaN(month) || isNaN(year) ? null : { month, year };
  }

  const totalComprasGs = useMemo(() => {
    return compras.reduce((acc, c) => {
      const signo = c.tipo === 'NC' ? -1 : 1;
      const usd = (c.subtotal_usd || 0) * signo * usdMercado;
      const pyg = (c.subtotal_pyg || 0) * signo;
      return acc + usd + pyg;
    }, 0);
  }, [compras, usdMercado]);

  const monthlyCompras = useMemo(() => {
    const map = {};
    compras.forEach(c => {
      const f = parseFechaCompra(c.fecha);
      if (!f) return;
      const k = String(f.year) + '-' + String(f.month + 1).padStart(2, '0');
      if (!map[k]) map[k] = { key: k, label: MONTHS[f.month] + ' ' + f.year, costoGs: 0 };
      const signo = c.tipo === 'NC' ? -1 : 1;
      map[k].costoGs += (c.subtotal_usd || 0) * signo * usdMercado;
      map[k].costoGs += (c.subtotal_pyg || 0) * signo;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [compras, usdMercado]);

  const margenBrutoGs  = totalRevGs - totalComprasGs;
  const margenBrutoPct = totalRevGs > 0 ? ((margenBrutoGs / totalRevGs) * 100).toFixed(1) : '0.0';

  const totalVentasRealesGs = useMemo(() =>
    ivaData.reduce((a, r) => a + (r.datos?.total_ventas_brutas || 0), 0)
  , [ivaData]);

  const margenRealConF120 = totalVentasRealesGs > 0
    ? ((totalVentasRealesGs - totalComprasGs) / totalVentasRealesGs * 100).toFixed(1)
    : null;



  const revByYear = useMemo(()=>{
    const map={};
    data.forEach(d=>{
      const y=String(d.fecha.year); if(!map[y]) map[y]=0;
      if(d.price.gs)  map[y]+=d.price.gs*d.qty;
      if(d.price.usd) map[y]+=d.price.usd*d.qty*bandaPiso;
    });
    return map;
  },[data,bandaPiso]);

  const yr24     = revByYear['2024']||0;
  const yr25     = revByYear['2025']||0;
  const yoyTrend = yr24>0?Math.round(((yr25-yr24)/yr24)*100):0;

  const monthlyRevenue = useMemo(()=>{
    const map={};
    withRevenue.forEach(d=>{
      const k=`${d.fecha.year}-${String(d.fecha.month+1).padStart(2,'0')}`;
      if(!map[k]) map[k]={key:k,label:`${MONTHS[d.fecha.month]} ${d.fecha.year}`,revGs:0,qty:0};
      map[k].revGs+=d.revGs; map[k].qty+=d.qty;
    });
    return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
  },[withRevenue]);

  const monthlyMerged = useMemo(() => {
    const map = {};
    monthlyRevenue.forEach(m => { map[m.key] = { ...m, costoGs: 0 }; });
    monthlyCompras.forEach(c => {
      if (!map[c.key]) map[c.key] = { key: c.key, label: c.label, revGs: 0, qty: 0, costoGs: 0 };
      map[c.key].costoGs = c.costoGs;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [monthlyRevenue, monthlyCompras]);

  const quarterlyRevenue = useMemo(()=>{
    const map={};
    withRevenue.forEach(d=>{
      const k=`${d.fecha.year}-Q${d.fecha.quarter+1}`;
      if(!map[k]) map[k]={key:k,label:`${d.fecha.year} Q${d.fecha.quarter+1}`,revGs:0,qty:0};
      map[k].revGs+=d.revGs; map[k].qty+=d.qty;
    });
    return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
  },[withRevenue]);

  const annualRevenue = useMemo(()=>{
    const map={};
    withRevenue.forEach(d=>{
      const k=String(d.fecha.year);
      if(!map[k]) map[k]={year:k,revGs:0,qty:0};
      map[k].revGs+=d.revGs; map[k].qty+=d.qty;
    });
    return Object.values(map).sort((a,b)=>a.year.localeCompare(b.year));
  },[withRevenue]);

  const topProducts = useMemo(()=>{
    const map={};
    withRevenue.forEach(d=>{
      const k=d.price.matched?d.price.label:d.desc.substring(0,38);
      if(!map[k]) map[k]={label:k,revGs:0,qty:0,linea:d.price.linea};
      map[k].revGs+=d.revGs; map[k].qty+=d.qty;
    });
    return Object.values(map).filter(p=>p.revGs>0).sort((a,b)=>b.revGs-a.revGs).slice(0,10);
  },[withRevenue]);

  const byLinea = useMemo(()=>{
    const map={};
    withRevenue.forEach(d=>{
      const k=d.price.linea||'OTRO';
      if(!map[k]) map[k]={linea:k,revGs:0,qty:0};
      map[k].revGs+=d.revGs; map[k].qty+=d.qty;
    });
    return Object.values(map).sort((a,b)=>b.revGs-a.revGs);
  },[withRevenue]);

  const PIE_COLORS=[T.accent,T.cyan,T.green,T.purple,T.orange,T.red,T.blue,'#f472b6'];

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:14}}>
      <div style={{width:38,height:38,border:`3px solid ${T.border}`,borderTop:`3px solid ${T.accent}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <p style={{color:T.textSecondary,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Cargando datos con Política v5.0...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(error) return (
    <div style={{textAlign:'center',padding:40,color:T.red,fontFamily:"'DM Sans',sans-serif"}}>
      <AlertTriangle size={32} style={{marginBottom:10}}/><p style={{fontWeight:600}}>{error}</p>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap'); *{box-sizing:border-box;} input::placeholder{color:#3d5470;}`}</style>

      {/* BANDAS V5.0 */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:11}}>
          <Shield size={14} color={T.accent}/>
          <span style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>POLÍTICA DE PRECIOS V5.0 — REGLA DE ORO SOLPRO</span>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>

          {/* USD Mercado */}
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 14px',flex:1,minWidth:160}}>
            <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>USD MERCADO HOY</div>
            {editUsd ? (
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <span style={{color:T.textMuted,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>?</span>
                <input value={tempUsd} onChange={e=>setTempUsd(e.target.value)} autoFocus
                  style={{background:T.card,border:`1px solid ${T.accent}`,borderRadius:5,padding:'4px 8px',
                    color:T.textPrimary,fontSize:14,fontFamily:"'JetBrains Mono',monospace",width:90,outline:'none'}}/>
                <button onClick={async ()=>{
                  const tc = parseInt(tempUsd.replace(/\D/g,''))||7650;
                  setUsdMercado(tc);
                  setEditUsd(false);
                  // Guardar en IndexedDB para que persista entre sesiones
                  await DB.guardarConfig('tipo_cambio_usd', tc);
                  setTcGuardado(true);
                  setTimeout(()=>setTcGuardado(false), 2500);
                }}
                  style={{background:T.green,border:'none',borderRadius:4,padding:'5px 10px',color:'#000',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                  ✓ Guardar
                </button>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{color:T.textPrimary,fontSize:20,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(usdMercado)}</span>
                {tcGuardado && (
                  <span style={{fontSize:10,fontWeight:700,color:T.green,fontFamily:"'DM Sans',sans-serif",
                    background:T.greenBg,border:'1px solid rgba(52,211,153,0.3)',borderRadius:4,padding:'2px 8px'}}>
                    ✓ Guardado
                  </span>
                )}
                <button onClick={()=>{ setTempUsd(String(usdMercado)); setEditUsd(true); }}
                  style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'3px 8px',
                    color:T.textMuted,fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontFamily:"'DM Sans',sans-serif"}}>
                  <Edit3 size={9}/> Actualizar
                </button>
              </div>
            )}
            <div style={{color:T.textMuted,fontSize:10,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Actualizar antes de abrir cada día</div>
          </div>

          {/* Banda Piso */}
          <div style={{background:'rgba(52,211,153,0.05)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:8,padding:'10px 14px',flex:1,minWidth:155}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.green}}/>
              <span style={{color:T.green,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>BANDA PISO (VERDE) +{BANDA_PISO_PTS}</span>
            </div>
            <div style={{color:T.green,fontSize:20,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(bandaPiso)}</div>
            <div style={{color:T.textMuted,fontSize:10,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Costo Real de Reposición · Contado / QR</div>
          </div>

          {/* Banda Techo */}
          <div style={{background:'rgba(96,165,250,0.05)',border:'1px solid rgba(96,165,250,0.3)',borderRadius:8,padding:'10px 14px',flex:1,minWidth:155}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.blue}}/>
              <span style={{color:T.blue,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>BANDA TECHO (AZUL) +{BANDA_TECHO_PTS}</span>
            </div>
            <div style={{color:T.blue,fontSize:20,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(bandaTecho)}</div>
            <div style={{color:T.textMuted,fontSize:10,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Cobertura de Riesgo · Solo Crédito Industrial</div>
          </div>

          {/* Precio Digital */}
          <div style={{background:'rgba(167,139,250,0.05)',border:'1px solid rgba(167,139,250,0.3)',borderRadius:8,padding:'10px 14px',flex:1,minWidth:155}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:T.purple}}/>
              <span style={{color:T.purple,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>PRECIO DIGITAL (QR) +{RECARGO_DIGITAL*100}%</span>
            </div>
            <div style={{color:T.purple,fontSize:15,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>Contado × 1.04</div>
            <div style={{color:T.textMuted,fontSize:10,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>Cubre comisión · Billeteras / Tarjetas</div>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <Calendar size={13} color={T.textMuted}/>
        <span style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>PERÍODO:</span>
        {years.map(y=><Chip key={y} label={String(y)} active={yearFilter===String(y)} onClick={()=>setYearFilter(String(y))}/>)}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5}}>
          <CheckCircle size={12} color={T.green}/>
          <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
            <span style={{color:T.green,fontWeight:700}}>{matchPct}%</span> con precio
            {unmatched.length>0&&<span style={{color:T.accent}}> · {fmtN(unmatched.length)} sin precio</span>}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:10}}>
        <KPI label="Ingresos Contado (?)" value={fmtGs(totalRevGs)}
          sub={`${fmtN(totalQty)} uds · Banda Piso aplicada`} color={T.accent} Icon={TrendingUp} trend={yoyTrend}/>
        <KPI label="Ingresos QR/Digital" value={fmtGs(totalRevDigital)}
          sub="Precio Contado + 4% recargo" color={T.purple} Icon={DollarSign}/>
        <KPI label="Cartera Industrial USD" value={fmtUSD(totalUSD)}
          sub={`= ${fmtGs(totalUSD*bandaPiso)} al Banda Piso`} color={T.green} Icon={Shield}/>
        <KPI label="Operaciones" value={fmtN(filtered.length)}
          sub={`${fmtN(new Set(filtered.map(d=>d.desc)).size)} SKUs distintos`} color={T.cyan} Icon={Package}/>
        <KPI label="Compras 2026" value={fmtGs(totalComprasGs)} 
          sub={compras.length + ' comprobantes cargados'} 
          color={T.red} Icon={Package}/>
        <KPI 
          label={margenRealConF120 ? "Margen Real (F120)" : "Margen Bruto Real"}
          value={margenRealConF120 
            ? `${margenRealConF120}%`
            : fmtGs(margenBrutoGs)
          }
          sub={margenRealConF120 
            ? `Ingresos reales: ${fmtGs(totalVentasRealesGs)}`
            : `${margenBrutoPct}% sobre ingresos estimados`
          }
          color={parseFloat(margenRealConF120 || margenBrutoPct) >= 0 ? T.green : T.red}
          Icon={TrendingUp}
        />
      </div>

      {/* TABS */}
      <div style={{borderBottom:`1px solid ${T.border}`,display:'flex'}}>
        <TabBtn id="mensual"    label="📅 Mensual"    active={tab==='mensual'}    setTab={setTab}/>
        <TabBtn id="trimestral" label="📊 Trimestral" active={tab==='trimestral'} setTab={setTab}/>
        <TabBtn id="anual"      label="📆 Anual"      active={tab==='anual'}      setTab={setTab}/>
        <TabBtn id="lineas"     label="🏷️ Por Línea"  active={tab==='lineas'}     setTab={setTab}/>
      </div>

      {tab==='mensual'&&(
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SH title="Flujo de Ingresos Mensual — Precio Contado (? Banda Piso)"/>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={monthlyMerged} margin={{top:5,right:5,bottom:0,left:0}}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.red} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={T.red} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{fill:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false} interval={2}/>
              <YAxis tickFormatter={v=>fmtGs(v)} tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false} width={74}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="revGs" name="Ingresos" stroke={T.accent} fill="url(#gRev)" strokeWidth={2.5} dot={false}/>
              <Area type="monotone" dataKey="costoGs" name="Compras" stroke={T.red} fill="url(#gG)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab==='trimestral'&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Flujo Trimestral (?)"/>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={quarterlyRevenue} margin={{top:5,right:5,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="label" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v=>fmtGs(v)} tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false} width={74}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="revGs" name="Ingresos" fill={T.cyan} fillOpacity={0.85} radius={[5,5,0,0]} maxBarSize={50}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {quarterlyRevenue.map((q,i)=>{
              const cols=[T.green,T.cyan,T.accent,T.purple];
              return (
                <div key={q.key} style={{flex:1,minWidth:120,background:T.card,border:`1px solid ${T.border}`,borderRadius:9,padding:'12px 14px'}}>
                  <div style={{color:T.textMuted,fontSize:9,marginBottom:5,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>{q.label}</div>
                  <div style={{color:cols[i%4],fontSize:16,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(q.revGs)}</div>
                  <div style={{color:T.textMuted,fontSize:10,marginTop:2,fontFamily:"'DM Sans',sans-serif"}}>{fmtN(q.qty)} unidades</div>
                  <div style={{color:T.purple,fontSize:10,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>QR: {fmtGs(q.revGs*1.04)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==='anual'&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Ingresos Anuales — Comparativa"/>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={annualRevenue} margin={{top:5,right:5,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="year" tick={{fill:T.textMuted,fontSize:13}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v=>fmtGs(v)} tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false} width={74}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="revGs" name="Ingresos Contado" radius={[6,6,0,0]} maxBarSize={90}>
                  {annualRevenue.map((_,i)=><Cell key={i} fill={[T.accent,T.cyan,T.green][i%3]} opacity={0.9}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:'flex',gap:10}}>
            {annualRevenue.map((a,i)=>{
              const prev = annualRevenue[i-1];
              const pct  = prev&&prev.revGs>0?Math.round(((a.revGs-prev.revGs)/prev.revGs)*100):null;
              const col  = [T.accent,T.cyan,T.green][i%3];
              return (
                <div key={a.year} style={{flex:1,background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
                  <div style={{color:T.textMuted,fontSize:10,marginBottom:6,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>{a.year}</div>
                  <div style={{color:col,fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(a.revGs)}</div>
                  <div style={{color:T.textSecondary,fontSize:11,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>{fmtGs(a.revGs)}</div>
                  <div style={{color:T.purple,fontSize:11,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>QR: {fmtGs(a.revGs*1.04)}</div>
                  <div style={{color:T.textMuted,fontSize:10,marginTop:3}}>{fmtN(a.qty)} unidades</div>
                  {pct!==null&&(
                    <div style={{display:'flex',alignItems:'center',gap:4,marginTop:8,color:pct>=0?T.green:T.red,fontSize:12}}>
                      {pct>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>}
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{pct>0?'+':''}{pct}% vs {prev.year}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==='lineas'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Ingresos por Línea de Negocio"/>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byLinea} layout="vertical" margin={{top:5,right:10,bottom:0,left:80}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
                <XAxis type="number" tickFormatter={v=>fmtGs(v)} tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="linea" tick={{fill:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false} width={80}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="revGs" name="Ingresos" radius={[0,4,4,0]} maxBarSize={20}>
                  {byLinea.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} opacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Mix de Ingresos"/>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={byLinea} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={2} dataKey="revGs">
                  {byLinea.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} opacity={0.85}/>)}
                </Pie>
                <Tooltip formatter={v=>fmtGs(v)} contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:4}}>
              {byLinea.map((l,i)=>{
                const pct=totalRevGs>0?Math.round((l.revGs/totalRevGs)*100):0;
                return (
                  <div key={l.linea} style={{display:'flex',alignItems:'center',gap:7}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                    <span style={{color:T.textSecondary,fontSize:10,flex:1,fontFamily:"'DM Sans',sans-serif"}}>{l.linea}</span>
                    <span style={{color:T.textMuted,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(l.revGs)}</span>
                    <span style={{color:PIE_COLORS[i%PIE_COLORS.length],fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,width:28,textAlign:'right'}}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TOP 10 */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <SH title="🏆 Top 10 Productos por Ingresos Estimados"/>
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {topProducts.map((p,i)=>{
            const pct=totalRevGs>0?(p.revGs/totalRevGs)*100:0;
            const cols=[T.accent,T.green,T.cyan,T.purple,T.orange,T.red,T.blue,'#f472b6',T.green,T.cyan];
            return (
              <div key={p.label} style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{color:i<3?cols[i]:T.textMuted,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12,width:18,flexShrink:0}}>{i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3,alignItems:'center',gap:8}}>
                    <span style={{color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{p.label}</span>
                    <span style={{color:cols[i%cols.length],fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,flexShrink:0}}>{fmtGs(p.revGs)}</span>
                  </div>
                  <div style={{background:T.border,borderRadius:2,height:4,overflow:'hidden'}}>
                    <div style={{background:cols[i%cols.length],height:'100%',width:`${Math.min(100,pct)}%`,opacity:0.8}}/>
                  </div>
                  <div style={{display:'flex',gap:10,marginTop:2}}>
                    <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{p.linea}</span>
                    <span style={{color:T.textMuted,fontSize:9}}>{fmtN(p.qty)} uds · {pct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RESUMEN EJECUTIVO */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 18px'}}>
        <SH title="📋 Resumen Ejecutivo"/>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {[
            {label:'Mejor Mes',       value:monthlyRevenue.length?monthlyRevenue.reduce((a,b)=>a.revGs>b.revGs?a:b).label:'—',   color:T.green},
            {label:'Mejor Trimestre', value:quarterlyRevenue.length?quarterlyRevenue.reduce((a,b)=>a.revGs>b.revGs?a:b).label:'—',color:T.cyan},
            {label:'Ventas 2024',     value:fmtGs(yr24),                                                                           color:T.textSecondary},
            {label:'Ventas 2025',     value:fmtGs(yr25),                                                                           color:T.accent},
            {label:'Crecimiento',     value:`${yoyTrend>0?'+':''}${yoyTrend}%`,                                                    color:yoyTrend>=0?T.green:T.red},
            {label:'Banda Piso',      value:fmtGs(bandaPiso),                                                                    color:T.green},
            {label:'Banda Techo',     value:fmtGs(bandaTecho),                                                                   color:T.blue},
            {label:'USD Industrial',  value:fmtUSD(totalUSD),                                                                      color:T.purple},
          ].map(item=>(
            <div key={item.label} style={{flex:1,minWidth:120,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px'}}>
              <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.07em',marginBottom:5,fontFamily:"'DM Sans',sans-serif"}}>{item.label.toUpperCase()}</div>
              <div style={{color:item.color,fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {unmatched.length>0&&(
        <div style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:10,padding:'12px 16px',display:'flex',gap:10}}>
          <AlertTriangle size={15} color={T.accent} style={{flexShrink:0,marginTop:2}}/>
          <div>
            <div style={{color:T.accent,fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>
              {fmtN(unmatched.length)} transacciones sin precio — no incluidas en el cálculo de ingresos
            </div>
            <div style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
              Para ampliar la cobertura, agregá los productos faltantes en la sección PRICE_MAP del archivo DashboardReal.jsx.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



