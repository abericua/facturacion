import { useState, useEffect, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Trash2,
  Save, Edit3, Check, X, AlertTriangle, Download,
  ChevronLeft, ChevronRight, FileText, CreditCard,
  Building, Users, Package, Truck, BarChart2
} from "lucide-react";

// ── THEME ──────────────────────────────────────────────────────────────────────
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

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmtGs  = n => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n||0))}`;
const fmtN   = n => new Intl.NumberFormat('es-PY').format(Math.round(n||0));
const fmtPct = n => `${(n||0).toFixed(1)}%`;

// ── CATEGORÍAS DE EGRESOS ──────────────────────────────────────────────────────
const CATEGORIAS_EGRESO = [
  { id:'gastos_fijos',   label:'Gastos Fijos',           icon:Building,  color:T.blue,   sub:'Alquiler, servicios, internet, etc.' },
  { id:'salarios',       label:'Salarios',                icon:Users,     color:T.purple, sub:'Sueldos y cargas sociales' },
  { id:'compras_local',  label:'Compras Locales',         icon:Package,   color:T.cyan,   sub:'Sol Control, Todo Costura' },
  { id:'importaciones',  label:'Importaciones y Exterior',icon:Truck,     color:T.orange, sub:'Epson, FOB, flete, impuestos, seguros' },
  { id:'creditos',       label:'Pagos de Créditos',       icon:CreditCard,color:T.red,    sub:'Cuotas de préstamos bancarios' },
  { id:'marketing',      label:'Marketing y Publicidad',  icon:BarChart2, color:T.accent, sub:'Redes sociales, eventos, promociones' },
  { id:'otros',          label:'Otros Egresos',           icon:FileText,  color:T.textSecondary, sub:'Gastos varios no categorizados' },
];

// ── STORAGE ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'solpro_finanzas_v1';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { ingresos:{}, egresos:{} };
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

function monthKey(year, month) { return `${year}-${String(month+1).padStart(2,'0')}`; }

// ── COMPONENTES AUXILIARES ─────────────────────────────────────────────────────
const SL = ({children}) => (
  <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',
    marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>{children}</div>
);

const TabBtn = ({id, label, active, onClick, color}) => (
  <button onClick={() => onClick(id)} style={{
    padding:'10px 18px', border:'none', background:'transparent',
    color: active ? (color||T.accent) : T.textSecondary,
    fontSize:12, fontWeight:active?700:400, cursor:'pointer',
    borderBottom: active ? `2px solid ${color||T.accent}` : '2px solid transparent',
    fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap', transition:'all 0.15s',
  }}>{label}</button>
);

function KPICard({label, value, sub, color, trend, icon:Icon}) {
  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>{label}</div>
        {Icon && <Icon size={14} color={color||T.accent}/>}
      </div>
      <div style={{color:color||T.textPrimary,fontSize:22,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,marginBottom:4}}>{value}</div>
      {sub && <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{sub}</div>}
      {trend !== undefined && (
        <div style={{display:'flex',alignItems:'center',gap:4,marginTop:6}}>
          {trend >= 0 ? <TrendingUp size={11} color={T.green}/> : <TrendingDown size={11} color={T.red}/>}
          <span style={{color:trend>=0?T.green:T.red,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
            {trend>=0?'+':''}{fmtPct(trend)} vs mes anterior
          </span>
        </div>
      )}
    </div>
  );
}

// ── TAB P&L ────────────────────────────────────────────────────────────────────
function TabPL({data, onSave}) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [editIngreso, setEditIngreso] = useState(false);
  const [tempIngreso, setTempIngreso] = useState('');

  const key = monthKey(year, month);
  const ingreso  = data.ingresos[key] || 0;
  const egrTot   = useMemo(() => {
    const eg = data.egresos[key] || {};
    return CATEGORIAS_EGRESO.reduce((s,c) => {
      const items = eg[c.id]?.items || [];
      return s + items.reduce((si,i)=>si+i.monto,0);
    }, 0);
  }, [data, key]);

  const resultado = ingreso - egrTot;
  const margen    = ingreso > 0 ? (resultado/ingreso)*100 : 0;

  // Datos para la gráfica anual
  const chartData = useMemo(() => MESES_CORTO.map((m,i) => {
    const k  = monthKey(year, i);
    const ing = data.ingresos[k] || 0;
    const eg  = data.egresos[k]  || {};
    const egTot = CATEGORIAS_EGRESO.reduce((s,c) => { const items=eg[c.id]?.items||[]; return s+items.reduce((si,i)=>si+i.monto,0); }, 0);
    return { mes:m, Ingresos:Math.round(ing/1000000), Egresos:Math.round(egTot/1000000), Resultado:Math.round((ing-egTot)/1000000) };
  }), [data, year]);

  const prevKey = month === 0 ? monthKey(year-1, 11) : monthKey(year, month-1);
  const prevIng = data.ingresos[prevKey] || 0;
  const trendIng = prevIng > 0 ? ((ingreso-prevIng)/prevIng)*100 : 0;

  function saveIngreso() {
    const val = parseFloat(tempIngreso.replace(/\./g,'').replace(',','.')) || 0;
    onSave({ ...data, ingresos: { ...data.ingresos, [key]: val } });
    setEditIngreso(false);
  }

  function prevMonth() { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  // Desglose de egresos del mes
  const egresosDetalle = useMemo(() => {
    const eg = data.egresos[key] || {};
    return CATEGORIAS_EGRESO.map(c => {
      const items = eg[c.id]?.items || [];
      const monto = items.reduce((s,i)=>s+i.monto,0);
      return { ...c, monto, items };
    }).filter(c => c.monto > 0);
  }, [data, key]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 14px'}}>
        <div style={{color:T.textSecondary,fontSize:11,marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{label}</div>
        {payload.map(p=>(
          <div key={p.name} style={{display:'flex',justifyContent:'space-between',gap:16,marginBottom:2}}>
            <span style={{color:p.color,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{p.name}</span>
            <span style={{color:T.textPrimary,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>₲ {fmtN(p.value)}M</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* Selector de mes */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px',
        display:'flex',alignItems:'center',gap:12}}>
        <button onClick={prevMonth} style={{background:'transparent',border:`1px solid ${T.border}`,
          borderRadius:6,padding:'4px 8px',color:T.textMuted,cursor:'pointer'}}>
          <ChevronLeft size={14}/>
        </button>
        <span style={{color:T.textPrimary,fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif",
          flex:1,textAlign:'center'}}>{MESES[month]} {year}</span>
        <button onClick={nextMonth} style={{background:'transparent',border:`1px solid ${T.border}`,
          borderRadius:6,padding:'4px 8px',color:T.textMuted,cursor:'pointer'}}>
          <ChevronRight size={14}/>
        </button>
        <select value={year} onChange={e=>setYear(Number(e.target.value))}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,
            padding:'5px 8px',color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}>
          {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <KPICard label="INGRESOS DEL MES" value={fmtGs(ingreso)}
          color={T.green} icon={TrendingUp} trend={trendIng}
          sub="Ventas cobradas en el mes"/>
        <KPICard label="EGRESOS TOTALES" value={fmtGs(egrTot)}
          color={T.red} icon={TrendingDown}
          sub="Todos los gastos del mes"/>
        <KPICard label="RESULTADO NETO" value={fmtGs(resultado)}
          color={resultado>=0?T.green:T.red} icon={DollarSign}
          sub={resultado>=0?'Ganancia del mes':'Perdida del mes'}/>
        <KPICard label="MARGEN NETO" value={fmtPct(margen)}
          color={margen>=20?T.green:margen>=10?T.accent:T.red}
          sub="Resultado / Ingresos"/>
      </div>

      {/* Carga de ingresos */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <SL>INGRESOS DEL MES — {MESES[month].toUpperCase()} {year}</SL>
          {!editIngreso && (
            <button onClick={()=>{setTempIngreso(String(ingreso));setEditIngreso(true);}}
              style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:5,
                padding:'4px 10px',color:T.accent,fontSize:10,fontWeight:700,cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4}}>
              <Edit3 size={10}/> {ingreso>0?'Editar':'Cargar ingresos'}
            </button>
          )}
        </div>
        {editIngreso ? (
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{color:T.textMuted,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>₲</span>
            <input type="text" value={tempIngreso} autoFocus
              onChange={e=>setTempIngreso(e.target.value)}
              placeholder="0"
              style={{flex:1,background:T.surface,border:`1px solid ${T.green}`,borderRadius:7,
                padding:'10px 14px',color:T.green,fontSize:18,fontFamily:"'JetBrains Mono',monospace",
                fontWeight:700,outline:'none'}}/>
            <button onClick={saveIngreso}
              style={{background:T.greenBg,border:'1px solid rgba(52,211,153,0.35)',borderRadius:7,
                padding:'8px 14px',color:T.green,fontSize:12,fontWeight:700,cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:5}}>
              <Check size={13}/> Guardar
            </button>
            <button onClick={()=>setEditIngreso(false)}
              style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,
                padding:'8px 12px',color:T.textMuted,cursor:'pointer'}}>
              <X size={13}/>
            </button>
          </div>
        ) : (
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <span style={{color:ingreso>0?T.green:T.textMuted,fontSize:32,fontWeight:800,
              fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>
              {ingreso>0?fmtGs(ingreso):'Sin datos — cargar ingresos'}
            </span>
            {ingreso>0 && prevIng>0 && (
              <span style={{color:trendIng>=0?T.green:T.red,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>
                {trendIng>=0?'+':''}{fmtPct(trendIng)} vs {MESES_CORTO[month===0?11:month-1]}
              </span>
            )}
          </div>
        )}
        {ingreso===0&&!editIngreso&&(
          <div style={{marginTop:8,display:'flex',alignItems:'center',gap:6,
            background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:6,padding:'8px 12px'}}>
            <AlertTriangle size={12} color={T.accent}/>
            <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
              Carga el total cobrado en {MESES[month]} — ventas en efectivo, transferencias y QR juntos.
            </span>
          </div>
        )}
      </div>

      {/* Desglose egresos del mes */}
      {egresosDetalle.length > 0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SL>DESGLOSE EGRESOS — {MESES[month].toUpperCase()} {year}</SL>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:10}}>
            {egresosDetalle.map(c => {
              const pct = egrTot > 0 ? (c.monto/egrTot)*100 : 0;
              const CatIcon = c.icon;
              return (
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,
                  padding:'8px 10px',borderRadius:7,background:T.surface}}>
                  <CatIcon size={13} color={c.color}/>
                  <span style={{color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",flex:1}}>{c.label}</span>
                  <div style={{width:100,background:T.border,borderRadius:2,height:4,overflow:'hidden'}}>
                    <div style={{background:c.color,height:'100%',width:`${pct}%`,opacity:0.8}}/>
                  </div>
                  <span style={{color:T.textMuted,fontSize:9,fontFamily:"'JetBrains Mono',monospace",width:28,textAlign:'right'}}>{pct.toFixed(0)}%</span>
                  <span style={{color:c.color,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:120,textAlign:'right'}}>{fmtGs(c.monto)}</span>
                </div>
              );
            })}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'10px 10px 4px',borderTop:`1px solid ${T.border}`,marginTop:4}}>
              <span style={{color:T.textSecondary,fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>TOTAL EGRESOS</span>
              <span style={{color:T.red,fontSize:14,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(egrTot)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica anual */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <SL>FLUJO ANUAL {year} — EN MILLONES DE GUARANIES</SL>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{top:10,right:10,bottom:0,left:0}} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}
              tickFormatter={v=>`₲${v}M`}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Legend wrapperStyle={{fontSize:10,color:T.textSecondary,fontFamily:"'DM Sans',sans-serif"}}/>
            <Bar dataKey="Ingresos"  fill={T.green}  radius={[3,3,0,0]} maxBarSize={20} opacity={0.85}/>
            <Bar dataKey="Egresos"   fill={T.red}    radius={[3,3,0,0]} maxBarSize={20} opacity={0.75}/>
            <Bar dataKey="Resultado" fill={T.accent} radius={[3,3,0,0]} maxBarSize={20} opacity={0.9}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla resumen anual */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
          <SL>RESUMEN ANUAL {year}</SL>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:T.surface}}>
              {['Mes','Ingresos','Egresos','Resultado','Margen %'].map(h=>(
                <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                  letterSpacing:'0.08em',textAlign:h==='Mes'?'left':'right',
                  borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MESES.map((m,i)=>{
              const k   = monthKey(year,i);
              const ing = data.ingresos[k]||0;
              const eg  = data.egresos[k]||{};
              const egT = CATEGORIAS_EGRESO.reduce((s,c)=>{ const its=eg[c.id]?.items||[]; return s+its.reduce((si,i)=>si+i.monto,0); },0);
              const res = ing-egT;
              const mgn = ing>0?(res/ing)*100:0;
              const isCurrentMonth = i===month;
              return (
                <tr key={m} onClick={()=>setMonth(i)}
                  style={{borderBottom:`1px solid ${T.border}`,cursor:'pointer',
                    background:isCurrentMonth?T.accentBg:'transparent',
                    transition:'background 0.1s'}}>
                  <td style={{padding:'7px 12px'}}>
                    <span style={{color:isCurrentMonth?T.accent:T.textSecondary,fontSize:11,
                      fontFamily:"'DM Sans',sans-serif",fontWeight:isCurrentMonth?700:400}}>{m}</span>
                  </td>
                  <td style={{padding:'7px 12px',textAlign:'right'}}>
                    <span style={{color:ing>0?T.green:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
                      {ing>0?fmtGs(ing):'—'}
                    </span>
                  </td>
                  <td style={{padding:'7px 12px',textAlign:'right'}}>
                    <span style={{color:egT>0?T.red:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
                      {egT>0?fmtGs(egT):'—'}
                    </span>
                  </td>
                  <td style={{padding:'7px 12px',textAlign:'right'}}>
                    <span style={{color:res>0?T.green:res<0?T.red:T.textMuted,fontSize:11,
                      fontFamily:"'JetBrains Mono',monospace",fontWeight:res!==0?700:400}}>
                      {ing>0||egT>0?fmtGs(res):'—'}
                    </span>
                  </td>
                  <td style={{padding:'7px 12px',textAlign:'right'}}>
                    <span style={{color:mgn>=20?T.green:mgn>=10?T.accent:mgn<0?T.red:T.textMuted,
                      fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>
                      {ing>0?fmtPct(mgn):'—'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {/* Totales */}
            {(() => {
              const totIng = MESES.reduce((_,__,i)=>_+(data.ingresos[monthKey(year,i)]||0),0);
              const totEg  = MESES.reduce((_,__,i)=>{
                const eg=data.egresos[monthKey(year,i)]||{};
                return _+CATEGORIAS_EGRESO.reduce((s,c)=>{ const its=eg[c.id]?.items||[]; return s+its.reduce((si,i)=>si+i.monto,0); },0);
              },0);
              const totRes = totIng-totEg;
              const totMgn = totIng>0?(totRes/totIng)*100:0;
              return (
                <tr style={{background:T.surface,borderTop:`2px solid ${T.border}`}}>
                  <td style={{padding:'9px 12px'}}>
                    <span style={{color:T.textPrimary,fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>TOTAL {year}</span>
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right'}}>
                    <span style={{color:T.green,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{totIng>0?fmtGs(totIng):'—'}</span>
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right'}}>
                    <span style={{color:T.red,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{totEg>0?fmtGs(totEg):'—'}</span>
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right'}}>
                    <span style={{color:totRes>=0?T.green:T.red,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{totIng>0?fmtGs(totRes):'—'}</span>
                  </td>
                  <td style={{padding:'9px 12px',textAlign:'right'}}>
                    <span style={{color:totMgn>=20?T.green:totMgn>=10?T.accent:T.textMuted,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{totIng>0?fmtPct(totMgn):'—'}</span>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── TAB EGRESOS ────────────────────────────────────────────────────────────────
function TabEgresos({data, onSave}) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [openCat,  setOpenCat]  = useState(null);
  const [newItem,  setNewItem]  = useState({desc:'', monto:''});

  const key   = monthKey(year, month);
  const egMes = data.egresos[key] || {};

  function prevMonth() { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  // items de una categoría: [{id, desc, monto}]
  function getItems(catId) { return egMes[catId]?.items || []; }
  function getTotal(catId) { return getItems(catId).reduce((s,i)=>s+i.monto,0); }

  function addItem(catId) {
    if (!newItem.desc || !newItem.monto) return;
    const monto = parseFloat(String(newItem.monto).replace(/\./g,'').replace(',','.')) || 0;
    const item  = { id: Date.now(), desc: newItem.desc.trim(), monto };
    const items = [...getItems(catId), item];
    const newEg = { ...egMes, [catId]: { items } };
    onSave({ ...data, egresos: { ...data.egresos, [key]: newEg } });
    setNewItem({desc:'', monto:''});
  }

  function deleteItem(catId, itemId) {
    const items = getItems(catId).filter(i=>i.id!==itemId);
    const newEg = { ...egMes, [catId]: { items } };
    onSave({ ...data, egresos: { ...data.egresos, [key]: newEg } });
  }

  const total = CATEGORIAS_EGRESO.reduce((s,c)=>s+getTotal(c.id),0);

  // Gráfica comparativa egresos últimos 6 meses
  const chartData = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      if (m < 0) { m += 12; y -= 1; }
      const k  = monthKey(y, m);
      const eg = data.egresos[k] || {};
      const row = { mes: MESES_CORTO[m] };
      CATEGORIAS_EGRESO.forEach(c => {
        const items = eg[c.id]?.items || [];
        row[c.label] = Math.round(items.reduce((s,i)=>s+i.monto,0)/1000);
      });
      result.push(row);
    }
    return result;
  }, [data, year, month]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Selector mes */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px',
        display:'flex',alignItems:'center',gap:12}}>
        <button onClick={prevMonth} style={{background:'transparent',border:`1px solid ${T.border}`,
          borderRadius:6,padding:'4px 8px',color:T.textMuted,cursor:'pointer'}}><ChevronLeft size={14}/></button>
        <span style={{color:T.textPrimary,fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif",flex:1,textAlign:'center'}}>{MESES[month]} {year}</span>
        <button onClick={nextMonth} style={{background:'transparent',border:`1px solid ${T.border}`,
          borderRadius:6,padding:'4px 8px',color:T.textMuted,cursor:'pointer'}}><ChevronRight size={14}/></button>
        <select value={year} onChange={e=>setYear(Number(e.target.value))}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,
            padding:'5px 8px',color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}>
          {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Categorías con ítems */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {CATEGORIAS_EGRESO.map(cat => {
          const CatIcon = cat.icon;
          const items   = getItems(cat.id);
          const catTotal= getTotal(cat.id);
          const isOpen  = openCat === cat.id;
          return (
            <div key={cat.id} style={{background:T.card,border:`1px solid ${isOpen?cat.color:T.border}`,
              borderRadius:10,overflow:'hidden',borderLeft:`3px solid ${cat.color}`,
              transition:'border-color 0.15s'}}>
              {/* Header categoría */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',cursor:'pointer'}}
                onClick={()=>setOpenCat(isOpen?null:cat.id)}>
                <CatIcon size={14} color={cat.color}/>
                <div style={{flex:1}}>
                  <div style={{color:T.textPrimary,fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>{cat.label}</div>
                  <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{cat.sub}</div>
                </div>
                {items.length>0 && (
                  <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginRight:8}}>
                    {items.length} ítem{items.length>1?'s':''}
                  </span>
                )}
                <span style={{color:catTotal>0?cat.color:T.textMuted,fontSize:15,fontWeight:800,
                  fontFamily:"'JetBrains Mono',monospace",marginRight:10}}>
                  {catTotal>0?fmtGs(catTotal):'Sin datos'}
                </span>
                <span style={{color:T.textMuted,fontSize:12}}>{isOpen?'▲':'▼'}</span>
              </div>

              {/* Panel expandido */}
              {isOpen && (
                <div style={{borderTop:`1px solid ${T.border}`,padding:'12px 16px',
                  display:'flex',flexDirection:'column',gap:8}}>

                  {/* Lista de ítems */}
                  {items.length>0 && (
                    <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:4}}>
                      {items.map(item=>(
                        <div key={item.id} style={{display:'flex',alignItems:'center',gap:8,
                          padding:'7px 10px',background:T.surface,borderRadius:6}}>
                          <div style={{width:4,height:4,borderRadius:'50%',background:cat.color,flexShrink:0}}/>
                          <span style={{color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",flex:1}}>{item.desc}</span>
                          <span style={{color:cat.color,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginRight:6}}>
                            {fmtGs(item.monto)}
                          </span>
                          <button onClick={()=>deleteItem(cat.id, item.id)}
                            style={{background:'transparent',border:'none',color:T.textMuted,
                              cursor:'pointer',padding:'2px',display:'flex',alignItems:'center'}}>
                            <Trash2 size={11}/>
                          </button>
                        </div>
                      ))}
                      {/* Subtotal */}
                      <div style={{display:'flex',justifyContent:'flex-end',padding:'6px 10px 2px',
                        borderTop:`1px solid ${T.border}`}}>
                        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginRight:8}}>Subtotal</span>
                        <span style={{color:cat.color,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                          {fmtGs(catTotal)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Formulario nuevo ítem */}
                  <div style={{display:'flex',gap:8,alignItems:'center',
                    background:T.surface,borderRadius:7,padding:'8px 10px',
                    border:`1px dashed ${cat.color}50`}}>
                    <input
                      type="text"
                      placeholder="Descripción del gasto..."
                      value={newItem.desc}
                      onChange={e=>setNewItem(p=>({...p,desc:e.target.value}))}
                      style={{flex:2,background:'transparent',border:'none',outline:'none',
                        color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}/>
                    <span style={{color:T.textMuted,fontSize:11}}>₲</span>
                    <input
                      type="text"
                      placeholder="Monto"
                      value={newItem.monto}
                      onChange={e=>setNewItem(p=>({...p,monto:e.target.value}))}
                      onKeyDown={e=>e.key==='Enter'&&addItem(cat.id)}
                      style={{flex:1,background:'transparent',border:'none',outline:'none',
                        color:cat.color,fontSize:13,fontFamily:"'JetBrains Mono',monospace",
                        fontWeight:700,textAlign:'right'}}/>
                    <button onClick={()=>addItem(cat.id)}
                      style={{background:`${cat.color}20`,border:`1px solid ${cat.color}50`,
                        borderRadius:5,padding:'5px 10px',color:cat.color,fontSize:10,
                        fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",
                        display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap'}}>
                      <Plus size={11}/> Agregar
                    </button>
                  </div>
                  <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
                    Presioná Enter o clic en Agregar para registrar el ítem
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div style={{background:T.card,border:'1px solid rgba(248,113,113,0.2)',borderRadius:10,
        padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',
        borderLeft:`4px solid ${T.red}`}}>
        <div>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',
            fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>TOTAL EGRESOS — {MESES[month].toUpperCase()} {year}</div>
          <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
            {CATEGORIAS_EGRESO.filter(c=>getTotal(c.id)>0).length} de {CATEGORIAS_EGRESO.length} categorías con datos
          </div>
        </div>
        <span style={{color:T.red,fontSize:26,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>
          {fmtGs(total)}
        </span>
      </div>

      {/* Gráfica últimos 6 meses */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <SL>EGRESOS POR CATEGORIA — ULTIMOS 6 MESES (EN MILES ₲)</SL>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{top:10,right:10,bottom:0,left:0}} barGap={1}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}
              tickFormatter={v=>`₲${fmtN(v)}k`}/>
            <Tooltip contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,
              fontFamily:"'DM Sans',sans-serif",fontSize:11}}/>
            <Legend wrapperStyle={{fontSize:9,color:T.textSecondary}}/>
            {CATEGORIAS_EGRESO.map(c=>(
              <Bar key={c.id} dataKey={c.label} stackId="a" fill={c.color} maxBarSize={32} opacity={0.85}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
// ── TAB IVA ────────────────────────────────────────────────────────────────────
function TabIVA({data, onSave}) {
  const now = new Date();
  const [year,     setYear]     = useState(now.getFullYear());
  const [seccion,  setSeccion]  = useState('mensual'); // mensual | historial | ire
  const [month,    setMonth]    = useState(now.getMonth());
  const [editDB,   setEditDB]   = useState(false);
  const [editCF,   setEditCF]   = useState(false);
  const [tempDB,   setTempDB]   = useState('');
  const [tempCF,   setTempCF]   = useState('');
  const [formPago,    setFormPago]    = useState({mes:'',anio:'',monto:'',fecha:'',obs:''});
  const [showPago,    setShowPago]    = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [pdfResult,   setPdfResult]   = useState(null);
  const [pdfError,    setPdfError]    = useState('');
  const [ireLoading,  setIreLoading]  = useState(false);
  const [ireError,    setIreError]    = useState('');
  const [ireFound,    setIreFound]    = useState(null);

  const ivaData  = data.iva     || {};
  const pagosIVA = data.pagosIva|| [];
  const ireData  = data.ire     || {};

  const key    = monthKey(year, month);
  const mesIVA = ivaData[key] || {debito:0, credito:0, pagado:false};
  const saldo  = mesIVA.debito - mesIVA.credito;

  function prevMonth() { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  function saveIVAField(field, val) {
    const v = parseFloat(String(val).replace(/\./g,'').replace(',','.')) || 0;
    onSave({ ...data, iva: { ...ivaData, [key]: { ...mesIVA, [field]: v } } });
    if(field==='debito') setEditDB(false);
    else setEditCF(false);
  }

  function marcarPagado() {
    onSave({ ...data, iva: { ...ivaData, [key]: { ...mesIVA, pagado:!mesIVA.pagado } } });
  }

  function addPago() {
    if(!formPago.monto) return;
    const monto = parseFloat(String(formPago.monto).replace(/\./g,'').replace(',','.')) || 0;
    const pago  = { id:Date.now(), ...formPago, monto };
    onSave({ ...data, pagosIva: [...pagosIVA, pago] });
    setFormPago({mes:'',anio:'',monto:'',fecha:'',obs:''});
    setShowPago(false);
  }

  function deletePago(id) {
    onSave({ ...data, pagosIva: pagosIVA.filter(p=>p.id!==id) });
  }

  function saveIRE(field, val) {
    const v = parseFloat(String(val).replace(/\./g,'').replace(',','.')) || 0;
    onSave({ ...data, ire: { ...ireData, [year]: { ...(ireData[year]||{}), [field]: v } } });
  }

  const ireAnio = ireData[year] || {};
  const ireItems = [
    {id:'base_imponible', label:'Base Imponible (Renta Neta)', color:T.cyan},
    {id:'tasa',           label:'Tasa IRE aplicada (%)',        color:T.textSecondary, isPct:true},
    {id:'anticipo',       label:'Anticipos pagados en el año',  color:T.purple},
    {id:'saldo_pagar',    label:'Saldo IRE a pagar',            color:T.red},
    {id:'pagado',         label:'IRE efectivamente pagado',     color:T.green},
  ];
  const [editIRE, setEditIRE] = useState({});
  const [tempIRE, setTempIRE] = useState({});

  // Resumen anual IVA
  const resumenAnual = useMemo(() => MESES.map((m,i) => {
    const k   = monthKey(year,i);
    const d   = ivaData[k] || {debito:0,credito:0,pagado:false};
    const sal = d.debito - d.credito;
    return { mes:m, mesCorto:MESES_CORTO[i], debito:d.debito, credito:d.credito,
             saldo:sal, pagado:d.pagado, key:k, idx:i };
  }), [ivaData, year]);

  const totalDebito  = resumenAnual.reduce((s,r)=>s+r.debito,0);
  const totalCredito = resumenAnual.reduce((s,r)=>s+r.credito,0);
  const totalSaldo   = resumenAnual.reduce((s,r)=>s+Math.max(0,r.saldo),0);
  const mesesPagados = resumenAnual.filter(r=>r.pagado&&r.saldo>0).length;

  // ── Convierte "54.275.773" → 54275773
  function gs(str) {
    if (!str) return 0;
    return parseInt(String(str).replace(/[^0-9]/g,'')) || 0;
  }

  // ── Parser específico para Formulario 120 de Marangatu (SET Paraguay)
  // Casillas clave: 44=IVA Débito, 45=IVA Crédito, 58=Saldo a pagar
  function parsearFormulario120(texto) {
    const r = {};
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // RUC: "RUC 80102833 DV 7" o "Contribuyente: 80102833"
    const rucM = texto.match(/RUC\s+(\d{6,8})\s+DV\s+(\d)/i)
              || texto.match(/Contribuyente:\s*(\d{6,8})/i);
    if (rucM) r.ruc = rucM[2] ? rucM[1]+'-'+rucM[2] : rucM[1];

    // Razón social
    const rsM = texto.match(/Raz[oó]n\s+Social\/Primer\s+Apellido\s*([A-ZÁÉÍÓÚÑ][^\n]{4,60})/i);
    if (rsM) r.razon_social = rsM[1].trim().split(/\s{3,}/)[0];

    // Período: el formulario tiene "Mes Año" seguido de dígitos separados por espacios
    // Ejemplo: "Mes Año 0 1 2 0 2 6"
    const periodoM = texto.match(/Mes\s+A[nñ]o\s+([\d][\d\s]{5,15})/i);
    if (periodoM) {
      const digits = periodoM[1].replace(/\s/g,'').padStart(6,'0');
      const mes  = parseInt(digits.substring(0,2));
      const anio = parseInt(digits.substring(2,6));
      if (mes>=1 && mes<=12 && anio>=2020 && anio<=2035) {
        r.mes  = MESES[mes-1];
        r.anio = anio;
      }
    }
    // Fallback: fecha de presentación "Fecha: 13/02/2026" → mes anterior
    if (!r.mes) {
      const fM = texto.match(/Fecha:\s*\d{1,2}\/(\d{2})\/(\d{4})/i);
      if (fM) {
        // La fecha de presentación es el mes siguiente, así que restamos 1
        let mes = parseInt(fM[1]) - 1; // mes de la declaracion es el anterior
        if (mes < 1) mes = 12;
        r.mes  = MESES[mes-1];
        r.anio = parseInt(fM[2]);
      }
    }

    // Extractor genérico por número de casilla
    // Busca " 44 54.275.773" — número de casilla seguido de monto con puntos
    function casilla(num) {
      // Patrón: casilla seguida de monto con al menos 4 dígitos (con o sin puntos)
      const re = new RegExp('\\b' + num + '\\s+(\\d[\\d.]{2,})', 'g');
      let best = 0;
      let m;
      while ((m = re.exec(texto)) !== null) {
        const val = gs(m[1]);
        if (val > best) best = val; // tomar el mayor si aparece varias veces
      }
      return best;
    }

    // IVA Débito: casilla 44 (Rubro 4), fallback casilla 24 (total Rubro 1 col III)
    r.debito_fiscal  = casilla(44) || casilla(24);

    // IVA Crédito: casilla 45 (Rubro 4), fallback casilla 43 (total Rubro 3)
    r.credito_fiscal = casilla(45) || casilla(43);

    // Saldo a pagar: casilla 58 (a favor del fisco)
    r.saldo_pagar = casilla(58);

    // Saldo a favor del contribuyente: casilla 54 (si saldo_pagar es 0)
    if (!r.saldo_pagar) {
      const sf = casilla(54);
      if (sf > 0) { r.saldo_pagar = sf; r.es_saldo_favor = true; }
    }

    // Ventas netas del mes: casilla 18 (Total ventas brutas del Rubro 1)
    r.ventas_netas  = casilla(18);

    // Compras netas: suma de bases imponibles Rubro 3 (casillas 32+33+35+36)
    r.compras_netas = casilla(32) + casilla(33) + casilla(35) + casilla(36);

    // Detectar tipo de formulario
    if (texto.includes('IMPUESTO AL VALOR AGREGADO') || texto.includes('Formulario:120')) {
      r.formulario = 'Formulario 120 — IVA';
    }

    return r;
  }

  // ── Proceso PDF: extrae texto con pdfjs y parsea con Formulario 120
  async function procesarPDF(file) {
    setPdfLoading(true);
    setPdfError('');
    setPdfResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let texto = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc   = await page.getTextContent();
        // Preservar saltos de línea según posición Y de cada elemento
        let lastY = null;
        for (const item of tc.items) {
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) texto += '\n';
          texto += item.str + ' ';
          lastY = y;
        }
        texto += '\n';
      }

      const parsed = parsearFormulario120(texto);

      if (!parsed.debito_fiscal && !parsed.credito_fiscal && !parsed.saldo_pagar) {
        setPdfError('No se encontraron montos de IVA. El PDF puede ser una imagen escaneada — usá "Cargar" para ingresar los datos manualmente.');
        setPdfLoading(false);
        return;
      }

      // Auto-aplicar inmediatamente
      const MESES_LOW = ['enero','febrero','marzo','abril','mayo','junio',
                         'julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const mesIdx = MESES_LOW.indexOf((parsed.mes||'').toLowerCase());
      const anioAplicar = parsed.anio || year;
      const mesAplicar  = mesIdx >= 0 ? mesIdx : month;

      const k2 = monthKey(anioAplicar, mesAplicar);
      const ivaActual2 = (data.iva||{})[k2] || {debito:0,credito:0,pagado:false};
      onSave({
        ...data,
        iva: {
          ...(data.iva||{}),
          [k2]: {
            ...ivaActual2,
            debito:        parsed.debito_fiscal  || ivaActual2.debito,
            credito:       parsed.credito_fiscal || ivaActual2.credito,
            ventas_netas:  parsed.ventas_netas   || ivaActual2.ventas_netas  || 0,
            compras_netas: parsed.compras_netas  || ivaActual2.compras_netas || 0,
          }
        }
      });

      if (parsed.anio) setYear(parsed.anio);
      if (mesIdx >= 0) setMonth(mesIdx);
      setPdfResult({ ...parsed, aplicado: true, k: k2 });

    } catch(e) {
      setPdfError('Error: ' + e.message + '. Intentá con otro PDF o cargá manualmente.');
    }
    setPdfLoading(false);
  }


  function aplicarDatosPDF() {
    if (!pdfResult) return;
    const k = monthKey(
      pdfResult.anio || year,
      ['enero','febrero','marzo','abril','mayo','junio',
       'julio','agosto','septiembre','octubre','noviembre','diciembre']
       .indexOf((pdfResult.mes||'').toLowerCase())
    );
    const ivaActual = ivaData[k] || {debito:0, credito:0, pagado:false};
    onSave({
      ...data,
      iva: {
        ...ivaData,
        [k]: {
          ...ivaActual,
          debito:  pdfResult.debito_fiscal  || 0,
          credito: pdfResult.credito_fiscal || 0,
        }
      }
    });
    setPdfResult(null);
  }

  // ── Parser específico para Formulario 500 (IRE) de Marangatu
  function parsearFormulario500(texto) {
    const r = {};

    // RUC
    const rucM = texto.match(/RUC\s+(\d{6,8})\s+DV\s+(\d)/i)
              || texto.match(/Contribuyente:\s*(\d{6,8})/i);
    if (rucM) r.ruc = rucM[2] ? rucM[1]+'-'+rucM[2] : rucM[1];

    // Razón social
    const rsM = texto.match(/Raz[oó]n\s+Social\/Primer\s+Apellido\s*([A-ZÁÉÍÓÚÑ][^\n]{4,60})/i);
    if (rsM) r.razon_social = rsM[1].trim().split(/\s{3,}/)[0];

    // Año del ejercicio: "Periodo / Ejercicio Fiscal 2 0 2 5" — solo año (IRE es anual)
    const anioM = texto.match(/(?:Periodo|Per[ií]odo)\s*\/?\s*Ejercicio\s+Fiscal\s+([\d\s]{4,9})/i)
               || texto.match(/Ejercicio\s+Fiscal\s+([\d\s]{4,9})/i);
    if (anioM) {
      const digits = anioM[1].replace(/\s/g,'');
      const anio = parseInt(digits.substring(0,4));
      if (anio >= 2020 && anio <= 2035) r.anio = anio;
    }

    // Extractor por número de casilla (igual que Form 120)
    function casilla(num) {
      const re = new RegExp('\\b' + num + '\\s+(\\d[\\d.]{2,})', 'g');
      let best = 0; let m;
      while ((m = re.exec(texto)) !== null) {
        const val = gs(m[1]);
        if (val > best) best = val;
      }
      return best;
    }

    // ── Rubro 1: Estado de Resultados completo ──
    r.ingresos_brutos    = casilla(77);   // Total Ingresos Brutos
    r.devoluciones       = casilla(24);   // Devoluciones y descuentos
    r.ingresos_netos     = casilla(78);   // Ingresos Netos (A)
    r.ingresos_gravados  = casilla(79);   // Ingresos Netos Gravados (B)
    r.costos             = casilla(80);   // Costos totales (C)
    r.costos_deducibles  = casilla(81);   // Costos deducibles (D)
    r.renta_bruta        = casilla(82);   // Renta Bruta (E = B - D)
    r.gastos_total       = casilla(83);   // Total Gastos (F)
    r.gastos_deducibles  = casilla(84);   // Gastos Deducibles (G)
    r.renta_neta_antes   = casilla(85);   // Renta Neta antes ajustes (H)
    r.renta_neta         = casilla(86);   // Renta Neta después ajustes (I)
    // Resultado del ejercicio (Rubro 4)
    r.utilidad_contable  = casilla(93);   // Utilidad Contable (ganancia)
    r.perdida_contable   = casilla(91);   // Pérdida Contable (si es negativo)
    r.utilidad_fiscal    = casilla(94);   // Utilidad Fiscal
    // Renta Neta Final (Rubro 5-6)
    r.renta_neta_final   = casilla(103);  // Renta Neta del Ejercicio
    r.base_imponible     = casilla(106);  // Renta Neta Imponible ← campo principal
    // Impuesto y liquidación (Rubro 8)
    r.impuesto_det       = casilla(120);  // Total Impuesto Determinado
    r.retenciones        = casilla(111);  // Retenciones computables
    r.anticipo_ingresado = casilla(113);  // Anticipos ingresados
    r.saldo_pagar        = casilla(123);  // Saldo a ingresar a favor del fisco
    r.anticipo_siguiente = casilla(126);  // Anticipos para siguiente ejercicio
    // Info complementaria
    r.personal           = casilla(131);  // Personal en relación de dependencia

    // Calcular tasa efectiva
    if (r.base_imponible > 0 && r.impuesto_det > 0) {
      r.tasa = Math.round((r.impuesto_det / r.base_imponible) * 1000) / 10;
    } else {
      r.tasa = 10; // default IRE general
    }

    r.formulario = 'Formulario 500 — IRE';
    return r;
  }

  async function procesarPDFIRE(file) {
    setIreLoading(true);
    setIreError('');
    setIreFound(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let texto = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc   = await page.getTextContent();
        let lastY = null;
        for (const item of tc.items) {
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) texto += '\n';
          texto += item.str + ' ';
          lastY = y;
        }
        texto += '\n';
      }

      // Verificar que es un Formulario 500
      if (!texto.includes('500') && !texto.includes('RENTA EMPRESARIAL')) {
        setIreError('Este PDF no parece ser un Formulario 500 (IRE). Verificá que sea la declaración correcta.');
        setIreLoading(false);
        return;
      }

      const parsed = parsearFormulario500(texto);

      if (!parsed.base_imponible && !parsed.impuesto_det) {
        setIreError('No se encontraron los datos del IRE. El PDF puede ser una imagen escaneada.');
        setIreLoading(false);
        return;
      }

      const anioAplicar = parsed.anio || year;
      const ireActual   = (data.ire || {})[anioAplicar] || {};

      onSave({
        ...data,
        ire: {
          ...(data.ire || {}),
          [anioAplicar]: {
            ...ireActual,
            // Datos fiscales básicos
            base_imponible:   parsed.base_imponible   || ireActual.base_imponible || 0,
            tasa:             parsed.tasa              || ireActual.tasa           || 10,
            anticipo:         parsed.anticipo_ingresado|| ireActual.anticipo       || 0,
            saldo_pagar:      parsed.saldo_pagar       || ireActual.saldo_pagar    || 0,
            // Estado de Resultados completo (F500)
            ingresos_brutos:  parsed.ingresos_brutos   || ireActual.ingresos_brutos  || 0,
            ingresos_netos:   parsed.ingresos_netos    || ireActual.ingresos_netos   || 0,
            costos:           parsed.costos            || ireActual.costos           || 0,
            renta_bruta:      parsed.renta_bruta       || ireActual.renta_bruta      || 0,
            gastos_total:     parsed.gastos_total      || ireActual.gastos_total     || 0,
            gastos_deducibles:parsed.gastos_deducibles || ireActual.gastos_deducibles|| 0,
            renta_neta:       parsed.renta_neta_final  || parsed.renta_neta || ireActual.renta_neta || 0,
            impuesto_det:     parsed.impuesto_det      || ireActual.impuesto_det     || 0,
            retenciones:      parsed.retenciones       || ireActual.retenciones      || 0,
            utilidad_contable:parsed.utilidad_contable || ireActual.utilidad_contable|| 0,
            personal:         parsed.personal          || ireActual.personal         || 0,
          }
        }
      });

      if (parsed.anio) setYear(parsed.anio);
      setIreFound({ ...parsed, aplicado: true });

    } catch(e) {
      setIreError('Error: ' + e.message);
    }
    setIreLoading(false);
  }

    const chartData = useMemo(() => resumenAnual.map(r=>({
    mes: r.mesCorto,
    'Debito':  Math.round(r.debito/1000),
    'Credito': Math.round(r.credito/1000),
    'Saldo':   Math.round(Math.max(0,r.saldo)/1000),
  })), [resumenAnual]);

  const SBtn = ({id, label, color}) => (
    <button onClick={()=>setSeccion(id)} style={{
      padding:'8px 16px', border:'none', background:'transparent',
      color: seccion===id ? (color||T.purple) : T.textSecondary,
      fontSize:11, fontWeight:seccion===id?700:400, cursor:'pointer',
      borderBottom: seccion===id ? `2px solid ${color||T.purple}` : '2px solid transparent',
      fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap',
    }}>{label}</button>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* Sub-navegación */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{borderBottom:`1px solid ${T.border}`,display:'flex'}}>
          <SBtn id="mensual"   label="📅 IVA Mensual"        color={T.purple}/>
          <SBtn id="resumen"   label="📊 Resumen Anual"      color={T.cyan}/>
          <SBtn id="historial" label="💳 Historial de Pagos" color={T.green}/>
          <SBtn id="ire"       label="🏛 IRE Anual"          color={T.accent}/>
        </div>

        <div style={{padding:16}}>

          {/* ── SECCIÓN MENSUAL ── */}
          {seccion==='mensual' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Selector mes */}
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <button onClick={prevMonth} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 8px',color:T.textMuted,cursor:'pointer'}}><ChevronLeft size={14}/></button>
                <span style={{color:T.textPrimary,fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif",flex:1,textAlign:'center'}}>{MESES[month]} {year}</span>
                <button onClick={nextMonth} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 8px',color:T.textMuted,cursor:'pointer'}}><ChevronRight size={14}/></button>
                <select value={year} onChange={e=>setYear(Number(e.target.value))}
                  style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 8px',color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
                  {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Carga PDF */}
              <div style={{background:T.surface,border:`1px solid ${T.purpleBg}`,borderRadius:10,padding:'14px 16px',borderLeft:`3px solid ${T.purple}`}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <div>
                    <div style={{color:T.textPrimary,fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>
                      Cargar declaracion jurada PDF
                    </div>
                    <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
                      Subi el PDF de la SET y se extraen los datos automaticamente
                    </div>
                  </div>
                  <label style={{background:T.purpleBg,border:`1px solid ${T.purple}40`,borderRadius:7,
                    padding:'8px 14px',color:T.purple,fontSize:11,fontWeight:700,cursor:'pointer',
                    fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6,
                    opacity:pdfLoading?0.6:1,pointerEvents:pdfLoading?'none':'auto'}}>
                    {pdfLoading ? '⏳ Leyendo PDF...' : '📄 Subir PDF'}
                    <input type="file" accept=".pdf" style={{display:'none'}}
                      onChange={e=>{ if(e.target.files[0]) procesarPDF(e.target.files[0]); e.target.value=''; }}/>
                  </label>
                </div>

                {pdfLoading && (
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',
                    background:T.purpleBg,borderRadius:6}}>
                    <div style={{width:14,height:14,border:`2px solid ${T.purple}`,borderTopColor:'transparent',
                      borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                    <span style={{color:T.purple,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
                      Claude esta leyendo tu declaracion jurada...
                    </span>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}

                {pdfError && (
                  <div style={{background:T.redBg,border:'1px solid rgba(248,113,113,0.3)',borderRadius:6,
                    padding:'8px 12px',color:T.red,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
                    {pdfError}
                  </div>
                )}

                {pdfResult && (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{color:T.green,fontSize:10,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
                      display:'flex',alignItems:'center',gap:5}}>
                      <Check size={12}/> {pdfResult.aplicado ? '✅ Datos aplicados automaticamente al mes!' : 'PDF leido — verificá los datos'}
                    </div>
                    <div style={{background:T.card,borderRadius:7,padding:'10px 12px',
                      display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {[
                        {label:'Mes detectado',     val: pdfResult.mes + ' ' + pdfResult.anio,          color:T.cyan},
                        {label:'RUC',               val: pdfResult.ruc || '—',                           color:T.textSecondary},
                        {label:'Debito Fiscal',     val: pdfResult.debito_fiscal ? fmtGs(pdfResult.debito_fiscal) : '—',  color:T.red},
                        {label:'Credito Fiscal',    val: pdfResult.credito_fiscal ? fmtGs(pdfResult.credito_fiscal) : '—', color:T.green},
                        {label:'Saldo a Pagar',     val: pdfResult.saldo_pagar ? fmtGs(pdfResult.saldo_pagar) : '—',     color:T.accent},
                        {label:'Razon Social',      val: pdfResult.razon_social || '—',                  color:T.textSecondary},
                      ].map(({label,val,color})=>(
                        <div key={label}>
                          <div style={{color:T.textMuted,fontSize:8,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>{label.toUpperCase()}</div>
                          <div style={{color,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,marginTop:2}}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {pdfResult.notas && (
                      <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",fontStyle:'italic'}}>
                        {pdfResult.notas}
                      </div>
                    )}
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>setPdfResult(null)}
                        style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,
                          padding:'7px 14px',color:T.textMuted,cursor:'pointer',fontSize:11,
                          fontFamily:"'DM Sans',sans-serif"}}>Cerrar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* KPIs */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                <KPICard label="IVA VENTAS (DEBITO)" value={fmtGs(mesIVA.debito)} color={T.red} sub="IVA cobrado a clientes"/>
                <KPICard label="IVA COMPRAS (CREDITO)" value={fmtGs(mesIVA.credito)} color={T.green} sub="IVA pagado a proveedores"/>
                <KPICard label="SALDO A PAGAR SET" value={fmtGs(Math.max(0,saldo))} color={saldo>0?T.red:T.green} sub={saldo>0?'Debes pagar a la SET':'Saldo a favor'}/>
              </div>

              {/* Carga débito / crédito */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  {field:'debito',  label:'DEBITO FISCAL — IVA VENTAS',  color:T.red,   edit:editDB, setEdit:setEditDB, temp:tempDB, setTemp:setTempDB, val:mesIVA.debito, hint:'IVA 10% cobrado en ventas del mes'},
                  {field:'credito', label:'CREDITO FISCAL — IVA COMPRAS', color:T.green, edit:editCF, setEdit:setEditCF, temp:tempCF, setTemp:setTempCF, val:mesIVA.credito, hint:'IVA pagado en compras y gastos del mes'},
                ].map(f=>(
                  <div key={f.field} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px',borderLeft:`3px solid ${f.color}`}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <SL>{f.label}</SL>
                      {!f.edit && <button onClick={()=>{f.setTemp(String(f.val));f.setEdit(true);}}
                        style={{background:`${f.color}18`,border:`1px solid ${f.color}40`,borderRadius:5,
                          padding:'3px 8px',color:f.color,fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                        {f.val>0?'Editar':'Cargar'}
                      </button>}
                    </div>
                    {f.edit?(
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        <input type="text" value={f.temp} autoFocus onChange={e=>f.setTemp(e.target.value)}
                          placeholder="0"
                          style={{background:T.card,border:`1px solid ${f.color}`,borderRadius:6,
                            padding:'8px 12px',color:f.color,fontSize:16,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,outline:'none'}}/>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>saveIVAField(f.field,f.temp)}
                            style={{flex:1,background:T.greenBg,border:'1px solid rgba(52,211,153,0.3)',borderRadius:5,padding:'6px',color:T.green,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Guardar</button>
                          <button onClick={()=>f.setEdit(false)}
                            style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:5,padding:'6px 10px',color:T.textMuted,cursor:'pointer'}}><X size={12}/></button>
                        </div>
                      </div>
                    ):(
                      <div>
                        <div style={{color:f.val>0?f.color:T.textMuted,fontSize:22,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(f.val)}</div>
                        <div style={{color:T.textMuted,fontSize:10,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>{f.hint}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Resultado + botón pagado */}
              <div style={{background:saldo>0?T.redBg:T.greenBg,border:`1px solid ${saldo>0?'rgba(248,113,113,0.3)':'rgba(52,211,153,0.3)'}`,
                borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:3}}>
                    {saldo>0?'SALDO IVA A PAGAR A LA SET':'SALDO IVA A FAVOR'}
                  </div>
                  <span style={{color:saldo>0?T.red:T.green,fontSize:22,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(Math.abs(saldo))}</span>
                </div>
                <button onClick={marcarPagado}
                  style={{background:mesIVA.pagado?T.greenBg:T.surface,
                    border:`1px solid ${mesIVA.pagado?'rgba(52,211,153,0.4)':T.border}`,
                    borderRadius:7,padding:'8px 14px',color:mesIVA.pagado?T.green:T.textMuted,
                    fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",
                    display:'flex',alignItems:'center',gap:6}}>
                  {mesIVA.pagado?<Check size={13}/>:null}
                  {mesIVA.pagado?'Marcado como PAGADO':'Marcar como pagado'}
                </button>
              </div>
            </div>
          )}

          {/* ── SECCIÓN RESUMEN ANUAL ── */}
          {seccion==='resumen' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'space-between'}}>
                <SL>RESUMEN IVA — AÑO {year}</SL>
                <select value={year} onChange={e=>setYear(Number(e.target.value))}
                  style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 8px',color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
                  {[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {/* KPIs anuales */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                <KPICard label="DEBITO TOTAL" value={fmtGs(totalDebito)} color={T.red} sub={`Año ${year}`}/>
                <KPICard label="CREDITO TOTAL" value={fmtGs(totalCredito)} color={T.green} sub={`Año ${year}`}/>
                <KPICard label="SALDO TOTAL A PAGAR" value={fmtGs(totalSaldo)} color={T.accent} sub="Suma de saldos mensuales"/>
                <KPICard label="MESES PAGADOS" value={`${mesesPagados} / 12`} color={T.cyan} sub="Con marca de pago"/>
              </div>
              {/* Gráfica */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{top:5,right:5,bottom:0,left:0}} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                    <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}k`}/>
                    <Tooltip contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11}}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Bar dataKey="Debito"  fill={T.red}    radius={[3,3,0,0]} maxBarSize={18} opacity={0.8}/>
                    <Bar dataKey="Credito" fill={T.green}  radius={[3,3,0,0]} maxBarSize={18} opacity={0.8}/>
                    <Bar dataKey="Saldo"   fill={T.accent} radius={[3,3,0,0]} maxBarSize={18} opacity={0.9}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Tabla mensual */}
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:T.card}}>
                      {['Mes','Debito Fiscal','Credito Fiscal','Saldo a Pagar','Estado'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                          letterSpacing:'0.08em',textAlign:h==='Mes'||h==='Estado'?'left':'right',
                          borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumenAnual.map(r=>(
                      <tr key={r.key} onClick={()=>{setMonth(r.idx);setSeccion('mensual');}}
                        style={{borderBottom:`1px solid ${T.border}`,cursor:'pointer',transition:'background 0.1s'}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.card}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'7px 12px'}}>
                          <span style={{color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>{r.mes}</span>
                        </td>
                        <td style={{padding:'7px 12px',textAlign:'right'}}>
                          <span style={{color:r.debito>0?T.red:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{r.debito>0?fmtGs(r.debito):'—'}</span>
                        </td>
                        <td style={{padding:'7px 12px',textAlign:'right'}}>
                          <span style={{color:r.credito>0?T.green:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{r.credito>0?fmtGs(r.credito):'—'}</span>
                        </td>
                        <td style={{padding:'7px 12px',textAlign:'right'}}>
                          <span style={{color:r.saldo>0?T.accent:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:r.saldo>0?700:400}}>{r.debito>0?fmtGs(Math.max(0,r.saldo)):'—'}</span>
                        </td>
                        <td style={{padding:'7px 12px'}}>
                          {r.saldo>0?(
                            <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,fontFamily:"'DM Sans',sans-serif",
                              color:r.pagado?T.green:T.red,background:r.pagado?T.greenBg:T.redBg}}>
                              {r.pagado?'PAGADO':'PENDIENTE'}
                            </span>
                          ):<span style={{color:T.textMuted,fontSize:10}}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SECCIÓN HISTORIAL DE PAGOS ── */}
          {seccion==='historial' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <SL>HISTORIAL DE PAGOS IVA A LA SET</SL>
                <button onClick={()=>setShowPago(!showPago)}
                  style={{background:T.greenBg,border:'1px solid rgba(52,211,153,0.35)',borderRadius:7,
                    padding:'7px 12px',color:T.green,fontSize:11,fontWeight:700,cursor:'pointer',
                    fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:5}}>
                  <Plus size={12}/> Registrar pago
                </button>
              </div>

              {showPago && (
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    {[
                      {key:'mes',    label:'MES QUE CORRESPONDE',   placeholder:'Enero 2026',     span:false},
                      {key:'monto',  label:'MONTO PAGADO (₲)',       placeholder:'0',              span:false},
                      {key:'fecha',  label:'FECHA DE PAGO',          placeholder:'',    type:'date',span:false},
                      {key:'obs',    label:'OBSERVACION',            placeholder:'Ej: Pago via BCP web', span:true},
                    ].map(f=>(
                      <div key={f.key} style={f.span?{gridColumn:'span 2'}:{}}>
                        <SL>{f.label}</SL>
                        <input type={f.type||'text'} value={formPago[f.key]} placeholder={f.placeholder}
                          onChange={e=>setFormPago(p=>({...p,[f.key]:e.target.value}))}
                          style={{width:'100%',background:T.card,border:`1px solid ${T.border}`,borderRadius:6,
                            padding:'7px 10px',color:T.textPrimary,fontSize:12,outline:'none',
                            fontFamily:"'DM Sans',sans-serif",boxSizing:'border-box'}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={addPago}
                      style={{flex:1,background:T.greenBg,border:'1px solid rgba(52,211,153,0.35)',borderRadius:7,
                        padding:'8px',color:T.green,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                      Guardar pago
                    </button>
                    <button onClick={()=>setShowPago(false)}
                      style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,
                        padding:'8px 14px',color:T.textMuted,cursor:'pointer'}}>Cancelar</button>
                  </div>
                </div>
              )}

              {pagosIVA.length>0?(
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:T.card}}>
                        {['Mes que corresponde','Fecha de pago','Monto pagado','Observacion',''].map(h=>(
                          <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                            letterSpacing:'0.08em',textAlign:h==='Monto pagado'?'right':'left',
                            borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagosIVA.map(p=>(
                        <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}>
                          <td style={{padding:'8px 12px'}}><span style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{p.mes}</span></td>
                          <td style={{padding:'8px 12px'}}><span style={{color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>{p.fecha||'—'}</span></td>
                          <td style={{padding:'8px 12px',textAlign:'right'}}><span style={{color:T.green,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(p.monto)}</span></td>
                          <td style={{padding:'8px 12px'}}><span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{p.obs||'—'}</span></td>
                          <td style={{padding:'8px 12px'}}>
                            <button onClick={()=>deletePago(p.id)}
                              style={{background:'transparent',border:'none',color:T.textMuted,cursor:'pointer'}}>
                              <Trash2 size={11}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{padding:'10px 14px',borderTop:`1px solid ${T.border}`,display:'flex',justifyContent:'flex-end',gap:8}}>
                    <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>Total pagado registrado:</span>
                    <span style={{color:T.green,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                      {fmtGs(pagosIVA.reduce((s,p)=>s+p.monto,0))}
                    </span>
                  </div>
                </div>
              ):(
                <div style={{background:T.surface,border:`2px dashed ${T.border}`,borderRadius:10,
                  padding:'30px',textAlign:'center'}}>
                  <p style={{color:T.textSecondary,fontSize:12,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Sin pagos registrados aun</p>
                  <p style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>Registra cada pago que hacés a la SET con la fecha y el monto exacto</p>
                </div>
              )}
            </div>
          )}

          {/* ── SECCIÓN IRE ── */}
          {seccion==='ire' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:10,justifyContent:'space-between'}}>
                <div>
                  <SL>IRE — IMPUESTO A LA RENTA EMPRESARIAL</SL>
                  <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>Tasa general: 10% sobre la renta neta. Ejercicio fiscal: enero a diciembre.</div>
                </div>
                <select value={year} onChange={e=>setYear(Number(e.target.value))}
                  style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 8px',color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
                  {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* PDF Upload IRE */}
              <div style={{background:T.surface,border:`1px solid ${T.accentBorder}`,borderRadius:10,
                padding:'14px 16px',borderLeft:`3px solid ${T.accent}`}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{color:T.textPrimary,fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>
                      Cargar Formulario 500 (IRE) — PDF
                    </div>
                    <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
                      Subi el PDF del Formulario 500 de Marangatu y se cargan todos los datos automaticamente
                    </div>
                  </div>
                  <label style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:7,
                    padding:'8px 14px',color:T.accent,fontSize:11,fontWeight:700,cursor:'pointer',
                    fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6,
                    opacity:ireLoading?0.6:1,pointerEvents:ireLoading?'none':'auto'}}>
                    {ireLoading ? '⏳ Leyendo...' : '📄 Subir Form 500'}
                    <input type="file" accept=".pdf" style={{display:'none'}}
                      onChange={e=>{ if(e.target.files[0]) procesarPDFIRE(e.target.files[0]); e.target.value=''; }}/>
                  </label>
                </div>

                {ireLoading && (
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,padding:'8px 10px',
                    background:T.accentBg,borderRadius:6}}>
                    <div style={{width:14,height:14,border:`2px solid ${T.accent}`,borderTopColor:'transparent',
                      borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                    <span style={{color:T.accent,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
                      Leyendo el Formulario 500...
                    </span>
                  </div>
                )}

                {ireError && (
                  <div style={{marginTop:10,background:T.redBg,border:'1px solid rgba(248,113,113,0.3)',
                    borderRadius:6,padding:'8px 12px',color:T.red,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
                    {ireError}
                  </div>
                )}

                {ireFound && (
                  <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{color:T.green,fontSize:10,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
                      display:'flex',alignItems:'center',gap:5}}>
                      <Check size={12}/> Datos del IRE {ireFound.anio} aplicados automaticamente
                    </div>
                    <div style={{background:T.card,borderRadius:7,padding:'10px 12px',
                      display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {[
                        {label:'Año del ejercicio', val: String(ireFound.anio||'—'),              color:T.cyan},
                        {label:'Tasa IRE',           val: ireFound.tasa ? ireFound.tasa+'%' : '—', color:T.textSecondary},
                        {label:'Ingresos Netos',     val: ireFound.ingresos_netos ? fmtGs(ireFound.ingresos_netos) : '—', color:T.green},
                        {label:'Renta Neta Impon.',  val: ireFound.base_imponible ? fmtGs(ireFound.base_imponible) : '—', color:T.cyan},
                        {label:'Impuesto Determ.',   val: ireFound.impuesto_det ? fmtGs(ireFound.impuesto_det) : '—',    color:T.red},
                        {label:'Anticipos pagados',  val: ireFound.anticipo_ingresado ? fmtGs(ireFound.anticipo_ingresado) : '—', color:T.purple},
                        {label:'Retenciones',        val: ireFound.retenciones ? fmtGs(ireFound.retenciones) : '—',      color:T.blue},
                        {label:'Saldo a pagar',      val: ireFound.saldo_pagar ? fmtGs(ireFound.saldo_pagar) : '—',      color:T.accent},
                      ].map(({label,val,color})=>(
                        <div key={label}>
                          <div style={{color:T.textMuted,fontSize:8,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>{label.toUpperCase()}</div>
                          <div style={{color,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,marginTop:2}}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setIreFound(null)}
                      style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,
                        padding:'6px 14px',color:T.textMuted,cursor:'pointer',fontSize:11,alignSelf:'flex-start',
                        fontFamily:"'DM Sans',sans-serif"}}>Cerrar</button>
                  </div>
                )}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {ireItems.map(item=>{
                  const val    = ireAnio[item.id]||0;
                  const isEdit = editIRE[item.id];
                  return (
                    <div key={item.id} style={{background:T.surface,border:`1px solid ${T.border}`,
                      borderRadius:8,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,
                      borderLeft:`3px solid ${item.color}`}}>
                      <span style={{color:T.textSecondary,fontSize:12,fontFamily:"'DM Sans',sans-serif",flex:1}}>{item.label}</span>
                      {isEdit?(
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          {!item.isPct && <span style={{color:T.textMuted,fontSize:11}}>₲</span>}
                          <input type="text" autoFocus
                            value={tempIRE[item.id]||''}
                            onChange={e=>setTempIRE(p=>({...p,[item.id]:e.target.value}))}
                            style={{background:T.card,border:`1px solid ${item.color}`,borderRadius:5,
                              padding:'5px 8px',color:item.color,fontSize:14,fontFamily:"'JetBrains Mono',monospace",
                              fontWeight:700,outline:'none',width:120,textAlign:'right'}}/>
                          {item.isPct && <span style={{color:T.textMuted,fontSize:11}}>%</span>}
                          <button onClick={()=>{saveIRE(item.id,tempIRE[item.id]);setEditIRE(p=>({...p,[item.id]:false}));}}
                            style={{background:T.greenBg,border:'1px solid rgba(52,211,153,0.3)',borderRadius:5,padding:'5px 8px',color:T.green,cursor:'pointer'}}><Check size={12}/></button>
                          <button onClick={()=>setEditIRE(p=>({...p,[item.id]:false}))}
                            style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:5,padding:'5px 7px',color:T.textMuted,cursor:'pointer'}}><X size={12}/></button>
                        </div>
                      ):(
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <span style={{color:val>0?item.color:T.textMuted,fontSize:15,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                            {val>0?(item.isPct?`${val}%`:fmtGs(val)):'Sin dato'}
                          </span>
                          <button onClick={()=>{setTempIRE(p=>({...p,[item.id]:String(val)}));setEditIRE(p=>({...p,[item.id]:true}));}}
                            style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'3px 8px',
                              color:T.textMuted,fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',gap:3,fontFamily:"'DM Sans',sans-serif"}}>
                            <Edit3 size={9}/> {val>0?'Editar':'Cargar'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Nota informativa */}
              <div style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:8,
                padding:'12px 16px',display:'flex',gap:8}}>
                <AlertTriangle size={13} color={T.accent} style={{flexShrink:0,marginTop:1}}/>
                <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
                  <span style={{color:T.accent,fontWeight:700}}>Recordatorio IRE: </span>
                  El IRE se paga una vez al año — vencimiento según la SET (generalmente marzo/abril del año siguiente). Los anticipos pagados durante el ejercicio se descuentan del saldo final. Consulta siempre con tu contador.
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── TAB CxC ────────────────────────────────────────────────────────────────────
function TabCxC({data, onSave}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({cliente:'',concepto:'',monto:'',fecha:'',vencimiento:''});
  const cuentas = data.cuentas || [];

  function addCuenta() {
    if(!form.cliente||!form.monto) return;
    const nueva = { ...form, id: Date.now(), monto: parseFloat(String(form.monto).replace(/\./g,''))||0, pagado:false };
    onSave({ ...data, cuentas: [...cuentas, nueva] });
    setForm({cliente:'',concepto:'',monto:'',fecha:'',vencimiento:''});
    setShowForm(false);
  }
  function togglePago(id) {
    onSave({ ...data, cuentas: cuentas.map(c=>c.id===id?{...c,pagado:!c.pagado}:c) });
  }
  function deleteCuenta(id) {
    onSave({ ...data, cuentas: cuentas.filter(c=>c.id!==id) });
  }

  const pendientes = cuentas.filter(c=>!c.pagado);
  const cobradas   = cuentas.filter(c=>c.pagado);
  const totalPend  = pendientes.reduce((s,c)=>s+c.monto,0);
  const totalCob   = cobradas.reduce((s,c)=>s+c.monto,0);

  function diasVencido(venc) {
    if(!venc) return 0;
    const hoy = new Date();
    const v   = new Date(venc);
    return Math.floor((hoy-v)/(1000*60*60*24));
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        <KPICard label="TOTAL POR COBRAR" value={fmtGs(totalPend)} color={T.red}
          sub={`${pendientes.length} cuentas pendientes`}/>
        <KPICard label="TOTAL COBRADO" value={fmtGs(totalCob)} color={T.green}
          sub={`${cobradas.length} cuentas saldadas`}/>
        <KPICard label="VENCIDAS" value={pendientes.filter(c=>diasVencido(c.vencimiento)>0).length + ' cuentas'}
          color={T.accent} sub="Con fecha de cobro superada"/>
      </div>

      {/* Botón agregar */}
      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <button onClick={()=>setShowForm(!showForm)}
          style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:7,
            padding:'8px 14px',color:T.accent,fontSize:12,fontWeight:700,cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:6}}>
          <Plus size={13}/> Nueva cuenta por cobrar
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{background:T.card,border:`1px solid ${T.accentBorder}`,borderRadius:10,padding:'16px 18px'}}>
          <SL>NUEVA CUENTA POR COBRAR</SL>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
            {[
              {key:'cliente',    label:'Cliente / Razón social', placeholder:'Nombre del cliente'},
              {key:'concepto',   label:'Concepto',               placeholder:'Qué se vendió'},
              {key:'monto',      label:'Monto (₲)',              placeholder:'0'},
              {key:'fecha',      label:'Fecha de venta',         placeholder:'',type:'date'},
              {key:'vencimiento',label:'Fecha de cobro acordada',placeholder:'',type:'date'},
            ].map(f=>(
              <div key={f.key} style={f.key==='cliente'||f.key==='concepto'?{gridColumn:'span 2'}:{}}>
                <SL>{f.label.toUpperCase()}</SL>
                <input type={f.type||'text'} value={form[f.key]} placeholder={f.placeholder}
                  onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                  style={{width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,
                    padding:'7px 10px',color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",
                    outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button onClick={addCuenta}
              style={{flex:1,background:T.greenBg,border:'1px solid rgba(52,211,153,0.35)',
                borderRadius:7,padding:'9px',color:T.green,fontSize:12,fontWeight:700,cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif"}}>Guardar cuenta</button>
            <button onClick={()=>setShowForm(false)}
              style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,
                padding:'9px 14px',color:T.textMuted,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista pendientes */}
      {pendientes.length > 0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <SL>CUENTAS PENDIENTES DE COBRO</SL>
            <span style={{color:T.red,fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(totalPend)}</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:T.surface}}>
                {['Cliente','Concepto','Monto','Vencimiento','Estado','Accion'].map(h=>(
                  <th key={h} style={{padding:'7px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                    letterSpacing:'0.08em',textAlign:h==='Monto'||h==='Accion'?'right':'left',
                    borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendientes.map(c=>{
                const dias = diasVencido(c.vencimiento);
                return (
                  <tr key={c.id} style={{borderBottom:`1px solid ${T.border}`}}>
                    <td style={{padding:'8px 12px'}}>
                      <span style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{c.cliente}</span>
                    </td>
                    <td style={{padding:'8px 12px'}}>
                      <span style={{color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>{c.concepto}</span>
                    </td>
                    <td style={{padding:'8px 12px',textAlign:'right'}}>
                      <span style={{color:T.red,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(c.monto)}</span>
                    </td>
                    <td style={{padding:'8px 12px'}}>
                      <span style={{color:dias>0?T.red:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
                        {c.vencimiento||'—'}{dias>0?` (+${dias}d)`:''}
                      </span>
                    </td>
                    <td style={{padding:'8px 12px'}}>
                      <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:3,fontFamily:"'DM Sans',sans-serif",
                        color:dias>0?T.red:T.accent,background:dias>0?T.redBg:T.accentBg}}>
                        {dias>0?'VENCIDA':'PENDIENTE'}
                      </span>
                    </td>
                    <td style={{padding:'8px 12px',textAlign:'right'}}>
                      <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                        <button onClick={()=>togglePago(c.id)} title="Marcar como cobrada"
                          style={{background:T.greenBg,border:'1px solid rgba(52,211,153,0.3)',borderRadius:4,
                            padding:'3px 7px',color:T.green,cursor:'pointer',fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
                          Cobrada
                        </button>
                        <button onClick={()=>deleteCuenta(c.id)} title="Eliminar"
                          style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,
                            padding:'3px 6px',color:T.textMuted,cursor:'pointer'}}>
                          <Trash2 size={10}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cobradas */}
      {cobradas.length > 0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <SL>CUENTAS COBRADAS</SL>
            <span style={{color:T.green,fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(totalCob)}</span>
          </div>
          <div style={{padding:'8px 0'}}>
            {cobradas.map(c=>(
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'7px 16px',
                borderBottom:`1px solid ${T.border}`,opacity:0.6}}>
                <Check size={12} color={T.green}/>
                <span style={{color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",flex:1}}>{c.cliente} — {c.concepto}</span>
                <span style={{color:T.green,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(c.monto)}</span>
                <button onClick={()=>togglePago(c.id)}
                  style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,
                    padding:'2px 6px',color:T.textMuted,cursor:'pointer',fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
                  Deshacer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {cuentas.length===0&&!showForm&&(
        <div style={{background:T.card,border:`2px dashed ${T.border}`,borderRadius:10,
          padding:'40px',textAlign:'center'}}>
          <FileText size={28} color={T.textMuted} style={{margin:'0 auto 10px'}}/>
          <p style={{color:T.textSecondary,fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Sin cuentas por cobrar registradas</p>
          <p style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>Registra las ventas a credito y seguile el estado a cada cliente</p>
        </div>
      )}
    </div>
  );
}

// ── TAB ANÁLISIS FINANCIERO ──────────────────────────────────────────────────
function TabAnalisis({data}) {
  const [anioSel, setAnioSel] = useState(2025);
  const ireData = data.ire || {};
  const ivaData = data.iva || {};
  const ANOS    = [2023, 2024, 2025];

  const getIRE = y => ireData[y] || {};
  const hasIRE = y => (ireData[y]?.ingresos_netos || 0) > 0;

  const PL_ROWS = [
    { key:'ingresos_netos',    label:'Ingresos Netos',        color:T.green,  bold:true,   icon:'📥' },
    { key:'costos',            label:'(−) Costos',            color:T.red,    indent:true, icon:'📦' },
    { key:'renta_bruta',       label:'Renta Bruta',           color:T.cyan,   bold:true,   icon:'📊', margen:true },
    { key:'gastos_deducibles', label:'(−) Gastos Operativos', color:T.orange, indent:true, icon:'💸' },
    { key:'renta_neta',        label:'Renta Neta Fiscal',     color:T.accent, bold:true,   icon:'💰', margen:true },
    { key:'impuesto_det',      label:'(−) Impuesto IRE 10%',  color:T.red,    indent:true, icon:'🏛' },
    { key:'utilidad_contable', label:'Utilidad Contable',     color:T.purple, bold:true,   icon:'✅' },
  ];

  const ire     = getIRE(anioSel);
  const prevIRE = getIRE(anioSel - 1);
  const var_    = (a, b) => b > 0 ? (((a-b)/b)*100).toFixed(1) : '—';
  const mgn     = (val, base) => base > 0 ? ((val/base)*100).toFixed(1)+'%' : '—';

  const varIngresos = var_(ire.ingresos_netos, prevIRE.ingresos_netos);
  const cargaFiscal = ire.ingresos_netos > 0 ? (ire.impuesto_det/ire.ingresos_netos*100) : 0;

  const chartAnual = ANOS.filter(hasIRE).map(y => ({
    año: String(y),
    'Ingresos':    Math.round((getIRE(y).ingresos_netos||0)/1000000),
    'Renta Bruta': Math.round((getIRE(y).renta_bruta||0)/1000000),
    'Renta Neta':  Math.round((getIRE(y).renta_neta||0)/1000000),
  }));

  const chartMargenes = ANOS.filter(hasIRE).map(y => {
    const d = getIRE(y);
    return {
      año: String(y),
      'Margen Bruto %': d.ingresos_netos > 0 ? +((d.renta_bruta/d.ingresos_netos*100).toFixed(1)) : 0,
      'Margen Neto %':  d.ingresos_netos > 0 ? +((d.renta_neta/d.ingresos_netos*100).toFixed(1))  : 0,
    };
  });

  const ivaAnio = useMemo(() => MESES_CORTO.map((m, i) => {
    const k = monthKey(2026, i);
    const mes = ivaData[k] || {};
    const ventas  = mes.ventas_netas  || (mes.debito  > 0 ? Math.round(mes.debito  / 0.10) : 0);
    const compras = mes.compras_netas || (mes.credito > 0 ? Math.round(mes.credito / 0.10) : 0);
    const margen  = ventas > 0 ? +((( ventas - compras) / ventas * 100).toFixed(1)) : 0;
    return { mes:m, Ventas:Math.round(ventas/1000000), Compras:Math.round(compras/1000000), margen, tiene:ventas>0 };
  }), [ivaData]);

  const mesesConData   = ivaAnio.filter(m=>m.tiene).length;
  const totalV26       = ivaAnio.reduce((s,m)=>s+m.Ventas,0);
  const totalC26       = ivaAnio.reduce((s,m)=>s+m.Compras,0);
  const margenProm26   = totalV26 > 0 ? +((totalV26-totalC26)/totalV26*100).toFixed(1) : 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 14px'}}>
        <div style={{color:T.textSecondary,fontSize:11,marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{label}</div>
        {payload.map(p=>(
          <div key={p.name} style={{display:'flex',justifyContent:'space-between',gap:16,marginBottom:2}}>
            <span style={{color:p.color,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{p.name}</span>
            <span style={{color:T.textPrimary,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
              {String(p.name).includes('%') ? p.value+'%' : `₲ ${p.value}M`}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!ANOS.some(hasIRE)) return (
    <div style={{background:T.card,border:`2px dashed ${T.border}`,borderRadius:10,padding:'50px',textAlign:'center'}}>
      <div style={{fontSize:32,marginBottom:12}}>📊</div>
      <div style={{color:T.textSecondary,fontSize:14,fontFamily:"'DM Sans',sans-serif",fontWeight:700,marginBottom:8}}>Sin datos del IRE cargados</div>
      <div style={{color:T.textMuted,fontSize:12,fontFamily:"'DM Sans',sans-serif",maxWidth:400,margin:'0 auto'}}>
        Andá al tab <span style={{color:T.accent}}>IVA Mensual → IRE Anual</span> y subí los PDFs del Formulario 500.
        Los análisis aparecen aquí automáticamente.
      </div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* Selector año */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px',
        display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>AÑO IRE:</span>
        {ANOS.map(y=>(
          <button key={y} onClick={()=>setAnioSel(y)}
            style={{padding:'5px 14px',borderRadius:6,border:`1px solid ${anioSel===y?T.accent:T.border}`,
              background:anioSel===y?T.accentBg:'transparent',color:anioSel===y?T.accent:T.textSecondary,
              fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,cursor:'pointer',opacity:hasIRE(y)?1:0.4}}>
            {y}{!hasIRE(y)?' (sin datos)':''}
          </button>
        ))}
        <div style={{marginLeft:'auto',color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
          {ANOS.filter(hasIRE).map(y=>`F500 ${y}`).join(' · ')}
          {mesesConData>0 && ` · F120 2026 (${mesesConData} mes${mesesConData>1?'es':''})`}
        </div>
      </div>

      {/* KPIs */}
      {hasIRE(anioSel) && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            {label:'INGRESOS NETOS', val:fmtGs(ire.ingresos_netos), sub:`Var. ${anioSel-1}→${anioSel}: ${varIngresos!=='—'?(parseFloat(varIngresos)>0?'+':'')+varIngresos+'%':'sin dato prev'}`, col:T.green},
            {label:`RENTA BRUTA ${anioSel}`, val:fmtGs(ire.renta_bruta), sub:`Margen bruto: ${mgn(ire.renta_bruta,ire.ingresos_netos)}`, col:T.cyan},
            {label:`RENTA NETA ${anioSel}`,  val:fmtGs(ire.renta_neta),  sub:`Margen neto: ${mgn(ire.renta_neta,ire.ingresos_netos)}`,  col:T.accent},
            {label:'CARGA FISCAL IRE',       val:cargaFiscal.toFixed(1)+'%', sub:`Impuesto determinado: ${fmtGs(ire.impuesto_det)}`, col:T.red},
          ].map(k=>(
            <div key={k.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
              <div style={{color:T.textMuted,fontSize:8,fontWeight:700,letterSpacing:'0.1em',marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{k.label}</div>
              <div style={{color:k.col,fontSize:20,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,marginBottom:4}}>{k.val}</div>
              <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla Estado de Resultados */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            ESTADO DE RESULTADOS — DATOS DEL FORMULARIO 500 IRE
          </span>
          <span style={{marginLeft:'auto',color:T.textMuted,fontSize:9}}>En millones ₲</span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:T.surface}}>
              <th style={{padding:'8px 14px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",width:'32%'}}>CONCEPTO</th>
              {ANOS.map(y=>(
                <th key={y} style={{padding:'8px 12px',color:anioSel===y?T.accent:T.textMuted,fontSize:9,fontWeight:700,textAlign:'right',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{y}</th>
              ))}
              <th style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,textAlign:'right',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>Margen {anioSel}</th>
              <th style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,textAlign:'right',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>Δ {anioSel-1}→{anioSel}</th>
            </tr>
          </thead>
          <tbody>
            {PL_ROWS.map(row=>{
              const valSel  = ire[row.key]     || 0;
              const valPrev = prevIRE[row.key] || 0;
              const v_      = var_(valSel, valPrev);
              const vNum    = v_ !== '—' ? parseFloat(v_) : null;
              const vColor  = vNum === null ? T.textMuted : (row.indent ? (vNum<=0?T.green:T.red) : (vNum>=0?T.green:T.red));
              return (
                <tr key={row.key} style={{borderBottom:`1px solid ${T.border}`,background:row.bold?T.surface:'transparent'}}>
                  <td style={{padding:'8px 14px'}}>
                    <span style={{color:row.bold?T.textPrimary:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:row.bold?700:400,paddingLeft:row.indent?16:0}}>
                      {row.icon} {row.label}
                    </span>
                  </td>
                  {ANOS.map(y=>{
                    const v = getIRE(y)[row.key] || 0;
                    return (
                      <td key={y} style={{padding:'8px 12px',textAlign:'right'}}>
                        <span style={{color:v>0?row.color:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:row.bold?700:400}}>
                          {v>0 ? `₲${fmtN(Math.round(v/1000000))}M` : '—'}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{padding:'8px 12px',textAlign:'right'}}>
                    {row.margen && valSel > 0
                      ? <span style={{color:row.color,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{mgn(valSel,ire.ingresos_netos)}</span>
                      : <span style={{color:T.textMuted,fontSize:10}}>—</span>}
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>
                    {vNum !== null
                      ? <span style={{color:vColor,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{vNum>0?'+':''}{v_}%</span>
                      : <span style={{color:T.textMuted,fontSize:10}}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Gráficas */}
      {chartAnual.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
            <SL>INGRESOS vs RENTABILIDAD (MILLONES ₲)</SL>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartAnual} margin={{top:5,right:5,bottom:0,left:0}} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="año" tick={{fill:T.textMuted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}M`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{fontSize:10,color:T.textSecondary}}/>
                <Bar dataKey="Ingresos"    fill={T.green}  radius={[4,4,0,0]} maxBarSize={30} opacity={0.85}/>
                <Bar dataKey="Renta Bruta" fill={T.cyan}   radius={[4,4,0,0]} maxBarSize={30} opacity={0.85}/>
                <Bar dataKey="Renta Neta"  fill={T.accent} radius={[4,4,0,0]} maxBarSize={30} opacity={0.9}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
            <SL>MÁRGENES HISTÓRICOS</SL>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartMargenes} margin={{top:5,right:10,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="año" tick={{fill:T.textMuted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Legend wrapperStyle={{fontSize:10,color:T.textSecondary}}/>
                <Line dataKey="Margen Bruto %" stroke={T.cyan}   strokeWidth={2} dot={{r:4,fill:T.cyan}}/>
                <Line dataKey="Margen Neto %"  stroke={T.accent} strokeWidth={2} dot={{r:4,fill:T.accent}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Evolución mensual 2026 IVA */}
      {mesesConData > 0 && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <SL>VENTAS vs COMPRAS 2026 — DEL FORMULARIO 120 IVA (MILLONES ₲)</SL>
            <div style={{display:'flex',gap:16}}>
              {[{l:'Ventas YTD',v:`₲${fmtN(totalV26)}M`,c:T.green},{l:'Compras YTD',v:`₲${fmtN(totalC26)}M`,c:T.orange},{l:'Margen prom.',v:`${margenProm26}%`,c:T.accent}].map(k=>(
                <div key={k.l} style={{textAlign:'right'}}>
                  <div style={{color:T.textMuted,fontSize:8,fontFamily:"'DM Sans',sans-serif"}}>{k.l}</div>
                  <div style={{color:k.c,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ivaAnio.filter(m=>m.tiene)} margin={{top:5,right:5,bottom:0,left:0}} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}M`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend wrapperStyle={{fontSize:10}}/>
              <Bar dataKey="Ventas"  fill={T.green}  radius={[3,3,0,0]} maxBarSize={26} opacity={0.85}/>
              <Bar dataKey="Compras" fill={T.orange} radius={[3,3,0,0]} maxBarSize={26} opacity={0.75}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
            {ivaAnio.filter(m=>m.tiene).map(m=>(
              <div key={m.mes} style={{background:T.surface,borderRadius:6,padding:'6px 10px',flex:1,minWidth:60,textAlign:'center'}}>
                <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{m.mes}</div>
                <div style={{color:m.margen>=20?T.green:m.margen>=10?T.accent:T.red,fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{m.margen}%</div>
                <div style={{color:T.textMuted,fontSize:8,fontFamily:"'DM Sans',sans-serif"}}>margen</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mesesConData===0 && (
        <div style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:'12px 16px',display:'flex',gap:8}}>
          <span>💡</span>
          <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
            <span style={{color:T.accent,fontWeight:700}}>Para ver la evolución mensual 2026:</span> Andá al tab <em>IVA Mensual</em> y subí los PDFs del Formulario 120 de cada mes. El sistema extrae ventas, compras y margen automáticamente.
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────────
export default function FinanzasPro() {
  const [tab,  setTab]  = useState('pl');
  const [data, setData] = useState(loadData);

  function handleSave(newData) {
    setData(newData);
    saveData(newData);
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;} input::placeholder{color:#3d5470;}
        select option{background:#111827;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#0d1117;}
        ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:2px;}
      `}</style>

      {/* Header */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,
        padding:'14px 18px',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
          <DollarSign size={16} color={T.accent}/>
          <span style={{color:T.accent,fontSize:11,fontWeight:700,letterSpacing:'0.1em',
            fontFamily:"'DM Sans',sans-serif"}}>FINANZAS PRO — SOL PRO</span>
        </div>
        <p style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",margin:0}}>
          Los datos se guardan automaticamente en este navegador. Registra ingresos, egresos, IVA y cuentas por cobrar mes a mes.
        </p>
      </div>

      {/* Tabs */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,
        overflow:'hidden',marginBottom:14}}>
        <div style={{borderBottom:`1px solid ${T.border}`,display:'flex',gap:0}}>
          <TabBtn id="pl"      label="📊  P&L — Ingresos vs Egresos" active={tab==='pl'}      onClick={setTab} color={T.green}/>
          <TabBtn id="egresos" label="💸  Egresos y Gastos"           active={tab==='egresos'} onClick={setTab} color={T.red}/>
          <TabBtn id="iva"     label="🧾  IVA Mensual"                active={tab==='iva'}     onClick={setTab} color={T.purple}/>
          <TabBtn id="cxc"      label="📋  Cuentas por Cobrar"          active={tab==='cxc'}      onClick={setTab} color={T.cyan}/>
          <TabBtn id="analisis" label="📈  Análisis Financiero"          active={tab==='analisis'} onClick={setTab} color={T.purple}/>
        </div>
        <div style={{padding:16}}>
          {tab==='pl'       && <TabPL      data={data} onSave={handleSave}/>}
          {tab==='egresos'  && <TabEgresos data={data} onSave={handleSave}/>}
          {tab==='iva'      && <TabIVA     data={data} onSave={handleSave}/>}
          {tab==='cxc'      && <TabCxC     data={data} onSave={handleSave}/>}
          {tab==='analisis' && <TabAnalisis data={data}/>}
        </div>
      </div>
    </div>
  );
}
