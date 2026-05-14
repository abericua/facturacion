import FinanzasPro from './FinanzasPro.jsx';
import { useState } from "react";
import VentasAnalytics from './VentasAnalytics.jsx';
import DashboardReal from './DashboardReal.jsx';
import CalculadoraPrecios from './CalculadoraPrecios.jsx';
import ConciliacionBancaria from './ConciliacionBancaria.jsx';
import ImpositivoDNIT from './ImpositivoDNIT.jsx';
import CargadorDocumentos from './CargadorDocumentos.jsx';
import DashboardReal2026 from './DashboardReal2026.jsx';
import IPSCalculator from './IPSCalculator.jsx';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  LayoutDashboard, ShoppingCart, DollarSign, Package, Truck, Building2,
  Bell, Download, AlertTriangle, FileText, Users, Search,
  Star, BarChart2, TrendingUp, TrendingDown, Settings,
  ChevronRight, CheckCircle, Clock, XCircle, Plus, RefreshCw, FolderOpen, Calendar, Calculator
} from "lucide-react";

// ── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#07080f',
  surface:     '#0d1117',
  card:        '#111827',
  cardB:       '#141d2e',
  border:      '#1a2535',
  borderL:     '#243045',
  accent:      '#f59e0b',
  accentBg:    'rgba(245,158,11,0.08)',
  accentBorder:'rgba(245,158,11,0.25)',
  cyan:        '#22d3ee',
  cyanBg:      'rgba(34,211,238,0.08)',
  green:       '#34d399',
  greenBg:     'rgba(52,211,153,0.08)',
  red:         '#f87171',
  redBg:       'rgba(248,113,113,0.08)',
  purple:      '#a78bfa',
  purpleBg:    'rgba(167,139,250,0.08)',
  textPrimary: '#e2e8f0',
  textSecondary:'#7d9db5',
  textMuted:   '#3d5470',
};

// ── FORMATTERS ───────────────────────────────────────────────────────────────
const fmt  = (n) => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n||0))}`;
const fmtK = (n) => n>=1000000?`₲${(n/1000000).toFixed(1)}M`:n>=1000?`₲${(n/1000).toFixed(0)}K`:`₲${n}`;
const fmtN = (n) => new Intl.NumberFormat('es-PY').format(Math.round(n||0));

// ── STATUS CONFIG ─────────────────────────────────────────────────────────────
const ST = {
  entregado:   {label:'Entregado',   color:'#34d399', bg:'rgba(52,211,153,0.12)'},
  en_tránsito: {label:'En Tránsito', color:'#22d3ee', bg:'rgba(34,211,238,0.12)'},
  procesando:  {label:'Procesando',  color:'#f59e0b', bg:'rgba(245,158,11,0.12)'},
  cancelado:   {label:'Cancelado',   color:'#f87171', bg:'rgba(248,113,113,0.12)'},
  pagada:      {label:'Pagada',      color:'#34d399', bg:'rgba(52,211,153,0.12)'},
  pendiente:   {label:'Pendiente',   color:'#f59e0b', bg:'rgba(245,158,11,0.12)'},
  vencida:     {label:'Vencida',     color:'#f87171', bg:'rgba(248,113,113,0.12)'},
  activo:      {label:'Activo',      color:'#34d399', bg:'rgba(52,211,153,0.12)'},
  inactivo:    {label:'Inactivo',    color:'#f87171', bg:'rgba(248,113,113,0.12)'},
};

// ── DATA SOL PRO REAL ────────────────────────────────────────────────────────
// Datos basados en facturación 2025: ₲3.858.537 (con picos jul-sep)
// Margen neto: 3.97% | Renta bruta: 7.84%
const revenueData = [
  {mes:'Ene',ingresos:258000,gastos:248000,utilidad:10000},   // Post-fiestas bajo
  {mes:'Feb',ingresos:275000,gastos:265000,utilidad:10000},   // Inicio año lento
  {mes:'Mar',ingresos:298000,gastos:287000,utilidad:11000},   // Mejora gradual
  {mes:'Abr',ingresos:315000,gastos:303000,utilidad:12000},   // Cierre fiscal
  {mes:'May',ingresos:328000,gastos:315000,utilidad:13000},   // Pre-temporada alta
  {mes:'Jun',ingresos:342000,gastos:328000,utilidad:14000},   // Inicio temporada
  {mes:'Jul',ingresos:389000,gastos:371000,utilidad:18000},   // PICO VENTAS
  {mes:'Ago',ingresos:412000,gastos:393000,utilidad:19000},   // PICO MÁXIMO
  {mes:'Sep',ingresos:396000,gastos:377000,utilidad:19000},   // PICO VENTAS
  {mes:'Oct',ingresos:348000,gastos:334000,utilidad:14000},   // Post-temporada
  {mes:'Nov',ingresos:312000,gastos:300000,utilidad:12000},   // Descenso
  {mes:'Dic',ingresos:285000,gastos:274000,utilidad:11000},   // Cierre año
];

const categoryData = [
  {name:'Impresoras DTF',    value:42,color:'#f59e0b'},  // F6470, F170, F10070
  {name:'Tintas Serie F',    value:38,color:'#22d3ee'},  // T53K, T43M, T46C
  {name:'Equipos Sublimación',value:12,color:'#a78bfa'}, // Accesorios
  {name:'Servicio Técnico',  value:5, color:'#34d399'},  // CSA Epson
  {name:'Otros Insumos',     value:3, color:'#f87171'},  // Varios
];

const orders = [
  {id:'SOL-0426',cliente:'ALBERT SPORT',          monto:2850000, fecha:'24 Abr 2026',estado:'entregado',   items:3, ciudad:'Ñemby'},
  {id:'SOL-0425',cliente:'ATLANTIS SPORT',        monto:4120000, fecha:'22 Abr 2026',estado:'en_tránsito', items:2, ciudad:'Minga Guazú'},
  {id:'SOL-0424',cliente:'VULZ FC',               monto:1890000, fecha:'20 Abr 2026',estado:'procesando',  items:1, ciudad:'San Lorenzo'},
  {id:'SOL-0423',cliente:'GASTON SPORT',          monto:3650000, fecha:'18 Abr 2026',estado:'entregado',   items:2, ciudad:'Paso de Patria'},
  {id:'SOL-0422',cliente:'SAN SPORT',             monto:5280000, fecha:'16 Abr 2026',estado:'en_tránsito', items:3, ciudad:'Pte. Franco'},
  {id:'SOL-0421',cliente:'TDL',                   monto:2100000, fecha:'14 Abr 2026',estado:'procesando',  items:1, ciudad:'Horqueta'},
  {id:'SOL-0420',cliente:'ARNALDO SPORT',         monto:3920000, fecha:'12 Abr 2026',estado:'entregado',   items:2, ciudad:'Luque'},
  {id:'SOL-0419',cliente:'F+ PERSONALIZADOS',     monto:6840000, fecha:'10 Abr 2026',estado:'entregado',   items:4, ciudad:'CDE'},
  {id:'SOL-0418',cliente:'LA SPORT',              monto:1750000, fecha:'08 Abr 2026',estado:'procesando',  items:1, ciudad:'Pilar'},
  {id:'SOL-0417',cliente:'TS SPORT',              monto:4560000, fecha:'06 Abr 2026',estado:'en_tránsito', items:3, ciudad:'Jesús Tavarangue'},
  {id:'SOL-0416',cliente:'INSIGNE',               monto:3280000, fecha:'04 Abr 2026',estado:'entregado',   items:2, ciudad:'Minga Guazú'},
  {id:'SOL-0415',cliente:'ALTEX',                 monto:2940000, fecha:'02 Abr 2026',estado:'cancelado',   items:2, ciudad:'Yaguarón'},
];

const inventory = [
  {id:'PRD-001',nombre:'Laptop Empresarial ProX',       cat:'Electrónica', stock:23,min:10,precio:18500,proveedor:'TechSupply MX'},
  {id:'PRD-002',nombre:'Monitor 4K UltraWide',          cat:'Electrónica', stock:7, min:15,precio:8900, proveedor:'TechSupply MX'},
  {id:'PRD-003',nombre:'Silla Ergonómica Executive',    cat:'Hogar',       stock:45,min:20,precio:4200, proveedor:'Muebles Pro'},
  {id:'PRD-004',nombre:'Escritorio Stand-Up',           cat:'Hogar',       stock:12,min:10,precio:6800, proveedor:'Muebles Pro'},
  {id:'PRD-005',nombre:'Teclado Mecánico RGB',          cat:'Electrónica', stock:3, min:20,precio:1850, proveedor:'TechSupply MX'},
  {id:'PRD-006',nombre:'Audífonos Noise Cancel',        cat:'Electrónica', stock:18,min:10,precio:3400, proveedor:'AudioWorld'},
  {id:'PRD-007',nombre:'Impresora Láser Color',         cat:'Electrónica', stock:8, min:5, precio:12600,proveedor:'PrintMex'},
  {id:'PRD-008',nombre:'Proyector 4K Inalámbrico',      cat:'Electrónica', stock:4, min:8, precio:22000,proveedor:'TechSupply MX'},
  {id:'PRD-009',nombre:'Tablet Empresarial',            cat:'Electrónica', stock:31,min:15,precio:7200, proveedor:'TechSupply MX'},
  {id:'PRD-010',nombre:'Teléfono IP Empresarial',       cat:'Comunicación',stock:2, min:10,precio:2800, proveedor:'TeleCom Pro'},
  {id:'PRD-011',nombre:'Router Wi-Fi 6 Empresarial',    cat:'Redes',       stock:16,min:8, precio:4500, proveedor:'NetPro'},
  {id:'PRD-012',nombre:'Switch 24 Puertos PoE',         cat:'Redes',       stock:9, min:5, precio:8200, proveedor:'NetPro'},
];

const suppliers = [
  {id:'PROV-001',nombre:'TechSupply MX', contacto:'Carlos Mendoza', email:'cmendoza@techsupply.mx', cat:'Electrónica', estado:'activo',   rating:4.8,ordenes:3,monto:1240000},
  {id:'PROV-002',nombre:'Muebles Pro',   contacto:'Ana García',     email:'agarcia@mueblepro.mx',  cat:'Mobiliario',  estado:'activo',   rating:4.5,ordenes:1,monto:380000},
  {id:'PROV-003',nombre:'AudioWorld',    contacto:'Miguel Torres',  email:'mtorres@audioworld.com',cat:'Audio',       estado:'activo',   rating:4.2,ordenes:2,monto:215000},
  {id:'PROV-004',nombre:'PrintMex',      contacto:'Laura Sánchez',  email:'lsanchez@printmex.mx',  cat:'Impresión',   estado:'inactivo', rating:3.8,ordenes:0,monto:95000},
  {id:'PROV-005',nombre:'TeleCom Pro',   contacto:'Roberto Jiménez',email:'rjimenez@telecompro.mx',cat:'Comunicación',estado:'activo',   rating:4.6,ordenes:1,monto:178000},
  {id:'PROV-006',nombre:'NetPro',        contacto:'Patricia Luna',  email:'pluna@netpro.com',       cat:'Redes',       estado:'activo',   rating:4.9,ordenes:2,monto:520000},
];

const invoices = [
  {id:'FAC-2401',cliente:'Grupo Alfa S.A.',  monto:24580,fecha:'18 Dic',vence:'17 Ene',estado:'pagada',   tipo:'venta'},
  {id:'FAC-2402',cliente:'Comercial Beta',   monto:8940, fecha:'18 Dic',vence:'17 Ene',estado:'pendiente',tipo:'venta'},
  {id:'FAC-2403',cliente:'TechSupply MX',    monto:47200,fecha:'17 Dic',vence:'16 Ene',estado:'pendiente',tipo:'compra'},
  {id:'FAC-2404',cliente:'Inversiones Delta',monto:15630,fecha:'17 Dic',vence:'16 Ene',estado:'pagada',   tipo:'venta'},
  {id:'FAC-2405',cliente:'Muebles Pro',      monto:32800,fecha:'16 Dic',vence:'15 Ene',estado:'vencida',  tipo:'compra'},
  {id:'FAC-2406',cliente:'TechMex Corp',     monto:92400,fecha:'16 Dic',vence:'15 Ene',estado:'pendiente',tipo:'venta'},
  {id:'FAC-2407',cliente:'NetPro',           monto:18750,fecha:'15 Dic',vence:'14 Ene',estado:'pagada',   tipo:'compra'},
  {id:'FAC-2408',cliente:'Nexus Industrial', monto:68900,fecha:'15 Dic',vence:'14 Ene',estado:'pagada',   tipo:'venta'},
  {id:'FAC-2409',cliente:'AudioWorld',       monto:12400,fecha:'14 Dic',vence:'13 Ene',estado:'vencida',  tipo:'compra'},
  {id:'FAC-2410',cliente:'Almacenes Sur',    monto:29870,fecha:'14 Dic',vence:'13 Ene',estado:'pendiente',tipo:'venta'},
];

// ── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Badge = ({status}) => {
  const s = ST[status] || {label:status, color:T.textSecondary, bg:'rgba(125,157,181,0.1)'};
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:4,
      fontSize:10,fontWeight:700,letterSpacing:'0.06em',color:s.color,background:s.bg,whiteSpace:'nowrap',
      fontFamily:"'DM Sans',sans-serif"}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:s.color,flexShrink:0}}/>
      {s.label.toUpperCase()}
    </span>
  );
};

const KPICard = ({label, value, trend, color, Icon, isNumber}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px',flex:1,minWidth:0}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
      <div style={{minWidth:0,flex:1}}>
        <div style={{color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:8,fontFamily:"'DM Sans',sans-serif"}}>
          {label.toUpperCase()}
        </div>
        <div style={{color:T.textPrimary,fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.02em',lineHeight:1}}>
          {isNumber ? fmtN(value) : fmtK(value)}
        </div>
      </div>
      <div style={{background:`${color}18`,borderRadius:8,padding:9,color,flexShrink:0}}>
        <Icon size={18}/>
      </div>
    </div>
    {trend!==undefined && (
      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:10,fontSize:11,color:trend>=0?T.green:T.red}}>
        {trend>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>}
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{Math.abs(trend)}%</span>
        <span style={{color:T.textMuted,fontFamily:"'DM Sans',sans-serif",fontSize:10}}>vs mes anterior</span>
      </div>
    )}
  </div>
);

const ChartTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:T.cardB,border:`1px solid ${T.borderL}`,borderRadius:8,padding:'10px 14px',minWidth:140}}>
      <p style={{color:T.textSecondary,fontSize:11,marginBottom:8,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,marginBottom:2}}>
          <span style={{color:T.textMuted,fontFamily:"'DM Sans',sans-serif",fontSize:10}}>{p.name}: </span>
          {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

const TableWrap = ({children}) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        {children}
      </table>
    </div>
  </div>
);

const THead = ({cols}) => (
  <thead>
    <tr style={{background:T.surface}}>
      {cols.map(c=>(
        <th key={c} style={{padding:'10px 14px',color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',
          textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
          {c.toUpperCase()}
        </th>
      ))}
    </tr>
  </thead>
);

const TRow = ({children}) => {
  const [hov,setHov] = useState(false);
  return (
    <tr style={{borderBottom:`1px solid ${T.border}`,background:hov?T.cardB:'transparent',transition:'background 0.12s'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      {children}
    </tr>
  );
};

const TD = ({children,mono,muted}) => (
  <td style={{padding:'11px 14px',color:muted?T.textSecondary:T.textPrimary,fontSize:13,
    fontFamily:mono?"'JetBrains Mono',monospace":"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
    {children}
  </td>
);

const SecHeader = ({title, action}) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
    <h2 style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:'0.04em'}}>{title}</h2>
    {action}
  </div>
);

const TabBtn = ({label,active,onClick}) => (
  <button onClick={onClick} style={{padding:'8px 18px',border:'none',background:'transparent',
    color:active?T.accent:T.textSecondary,
    borderBottom:active?`2px solid ${T.accent}`:'2px solid transparent',
    cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:-1}}>
    {label}
  </button>
);

const FilterChip = ({label,active,color,onClick}) => (
  <button onClick={onClick} style={{padding:'5px 12px',borderRadius:4,
    border:`1px solid ${active?(color||T.accent):T.border}`,
    background:active?`${color||T.accent}15`:'transparent',
    color:active?(color||T.accent):T.textSecondary,
    fontSize:10,fontWeight:700,cursor:'pointer',letterSpacing:'0.05em',
    fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
    {label}
  </button>
);

const SearchBar = ({value, onChange, placeholder, width=260}) => (
  <div style={{display:'flex',alignItems:'center',gap:8,background:T.card,border:`1px solid ${T.border}`,
    borderRadius:6,padding:'7px 12px',width}}>
    <Search size={13} color={T.textMuted}/>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{background:'transparent',border:'none',outline:'none',color:T.textPrimary,fontSize:12,
        width:'100%',fontFamily:"'DM Sans',sans-serif"}}/>
  </div>
);

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({setActive}) {
  // DATOS REALES SOL PRO 2025
  const ingresos2025 = 3858537;      // ₲3.858.537 (datos F500)
  const rentalNeta2025 = 153157;     // ₲153.157 (3.97% margen)
  const ventasMes = 196;             // Promedio mensual 2025 (2.352/12)
  const ventasMesActual = 75;        // Ventas abril 2026 (estimado)
  const proveedoresActivos = 2;      // Sol Control + Todo Costura
  
  // Productos principales con stock estimado
  const stockPrincipal = [
    {id:1, nombre:'Tinta F6470 T53K220 CYAN',      stock:8,  min:15, cat:'Tintas'},
    {id:2, nombre:'Tinta F6470 T53K320 MAGENTA',   stock:5,  min:12, cat:'Tintas'},
    {id:3, nombre:'Tinta F6470 T53K420 YELLOW',    stock:6,  min:12, cat:'Tintas'},
    {id:4, nombre:'Tinta F6470 T53K920 NEGRO',     stock:10, min:15, cat:'Tintas'},
    {id:5, nombre:'Impresora F170 A4',             stock:2,  min:5,  cat:'Equipos'},
    {id:6, nombre:'Tinta F10070 T43M (4 colores)', stock:12, min:20, cat:'Tintas'},
  ];
  const lowStock = stockPrincipal.filter(i=>i.stock<i.min);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* KPIs */}
      <div style={{display:'flex',gap:10}}>
        <KPICard label="Facturación 2025"   value={fmtK(ingresos2025)} Icon={TrendingUp}  color={T.green}  trend={14.3} sub="₲3.858M total año"/>
        <KPICard label="Ventas Mes Actual"  value={ventasMesActual}    Icon={ShoppingCart}color={T.cyan}   trend={-7.5} isNumber sub="Abril 2026"/>
        <KPICard label="Rentabilidad Neta"  value="3.97%"              Icon={DollarSign}  color={T.accent} sub="₲153M utilidad 2025"/>
        <KPICard label="Proveedores"        value={proveedoresActivos} Icon={Users}       color={T.purple} isNumber sub="Sol Control + Todo Costura"/>
      </div>

      {/* Charts row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:12}}>
        {/* Area chart */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SecHeader title="Facturación Mensual 2025 — Sol Pro"/>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={revenueData} margin={{top:5,right:5,bottom:0,left:0}}>
              <defs>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.green} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={T.green} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.red} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={T.red} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`₲${(v/1000).toFixed(0)}K`} tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={46}/>
              <Tooltip content={<ChartTip/>}/>
              <Legend wrapperStyle={{paddingTop:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:T.textSecondary}}/>
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={T.green}  fill="url(#gI)" strokeWidth={2} dot={false}/>
              <Area type="monotone" dataKey="gastos"   name="Gastos"   stroke={T.red}    fill="url(#gG)" strokeWidth={2} dot={false}/>
              <Area type="monotone" dataKey="utilidad" name="Utilidad" stroke={T.accent} fill="url(#gU)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SecHeader title="Ventas por Categoría"/>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                {categoryData.map((e,i)=><Cell key={i} fill={e.color} opacity={0.85}/>)}
              </Pie>
              <Tooltip formatter={v=>`${v}%`} contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:2}}>
            {categoryData.map(c=>(
              <div key={c.name} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                <span style={{color:T.textSecondary,fontSize:12,flex:1,fontFamily:"'DM Sans',sans-serif"}}>{c.name}</span>
                <span style={{color:T.textPrimary,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:12}}>
        {/* Recent orders */}
        <div>
          <SecHeader title="Pedidos Recientes" action={
            <span onClick={()=>setActive('pedidos')} style={{color:T.accent,fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Ver todos →</span>
          }/>
          <TableWrap>
            <THead cols={['Pedido','Cliente','Ciudad','Monto','Estado']}/>
            <tbody>
              {orders.slice(0,6).map(o=>(
                <TRow key={o.id}>
                  <TD mono><span style={{color:T.accent}}>{o.id}</span></TD>
                  <TD>{o.cliente}</TD>
                  <TD muted>{o.ciudad}</TD>
                  <TD mono>{fmt(o.monto)}</TD>
                  <TD><Badge status={o.estado}/></TD>
                </TRow>
              ))}
            </tbody>
          </TableWrap>
        </div>

        {/* Low stock alerts */}
        <div>
          <SecHeader title="Alertas de Stock" action={
            <span style={{color:T.red,fontSize:10,fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:4,fontWeight:700}}>
              <AlertTriangle size={11}/>{lowStock.length} alertas
            </span>
          }/>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
            {lowStock.map((item,i)=>{
              const ratio=item.stock/item.min;
              const c=ratio<0.5?T.red:T.accent;
              return (
                <div key={item.id} style={{padding:'11px 14px',borderBottom:i<lowStock.length-1?`1px solid ${T.border}`:'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:170}}>
                      {item.nombre}
                    </span>
                    <span style={{color:c,fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{item.stock}</span>
                  </div>
                  <div style={{background:T.border,borderRadius:2,height:3,overflow:'hidden'}}>
                    <div style={{background:c,height:'100%',width:`${Math.min(100,(item.stock/item.min)*100)}%`,borderRadius:2}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                    <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{item.cat}</span>
                    <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>Mín: {item.min}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Utilidad mensual bar */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <SecHeader title="Utilidad Neta Mensual — Tendencia Anual"/>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={revenueData} margin={{top:5,right:5,bottom:0,left:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${v/1000}K`} tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={46}/>
            <Tooltip content={<ChartTip/>}/>
            <Bar dataKey="utilidad" name="Utilidad" fill={T.accent} fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={30}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── FINANZAS ─────────────────────────────────────────────────────────────────
function Finanzas() {
  const [filter, setFilter] = useState('todas');

  const ventas     = invoices.filter(i=>i.tipo==='venta');
  const facturado  = ventas.reduce((a,b)=>a+b.monto,0);
  const cobrado    = ventas.filter(i=>i.estado==='pagada').reduce((a,b)=>a+b.monto,0);
  const porCobrar  = ventas.filter(i=>i.estado==='pendiente').reduce((a,b)=>a+b.monto,0);
  const vencido    = invoices.filter(i=>i.estado==='vencida').reduce((a,b)=>a+b.monto,0);

  const filtered = filter==='todas' ? invoices
    : filter==='venta'||filter==='compra' ? invoices.filter(i=>i.tipo===filter)
    : invoices.filter(i=>i.estado===filter);

  const chips = [
    {id:'todas',   label:'Todas',    color:T.textSecondary},
    {id:'venta',   label:'Ventas',   color:T.cyan},
    {id:'compra',  label:'Compras',  color:T.purple},
    {id:'pendiente',label:'Pendiente',color:T.accent},
    {id:'pagada',  label:'Pagada',   color:T.green},
    {id:'vencida', label:'Vencida',  color:T.red},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
        <KPICard label="Total Facturado" value={facturado} Icon={FileText}      color={T.accent} trend={15.2}/>
        <KPICard label="Cobrado"         value={cobrado}   Icon={CheckCircle}   color={T.green}  trend={8.7}/>
        <KPICard label="Por Cobrar"      value={porCobrar} Icon={Clock}         color={T.cyan}   trend={-3.1}/>
        <KPICard label="Vencido"         value={vencido}   Icon={AlertTriangle} color={T.red}/>
      </div>

      {/* P&L Chart */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <SecHeader title="Estado de Resultados Mensual — P&L 2024"/>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={revenueData} margin={{top:5,right:5,bottom:0,left:0}} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`$${v/1000}K`} tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={46}/>
            <Tooltip content={<ChartTip/>}/>
            <Legend wrapperStyle={{paddingTop:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:T.textSecondary}}/>
            <Bar dataKey="ingresos" name="Ingresos" fill={T.green}  fillOpacity={0.8} radius={[3,3,0,0]} maxBarSize={22}/>
            <Bar dataKey="gastos"   name="Gastos"   fill={T.red}    fillOpacity={0.8} radius={[3,3,0,0]} maxBarSize={22}/>
            <Bar dataKey="utilidad" name="Utilidad" fill={T.accent} fillOpacity={0.8} radius={[3,3,0,0]} maxBarSize={22}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Invoice table */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <h2 style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:'0.04em'}}>Registro de Facturas</h2>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {chips.map(c=><FilterChip key={c.id} label={c.label} active={filter===c.id} color={c.color} onClick={()=>setFilter(c.id)}/>)}
          </div>
        </div>
        <TableWrap>
          <THead cols={['Factura','Cliente / Proveedor','Monto','Fecha','Vencimiento','Tipo','Estado']}/>
          <tbody>
            {filtered.map(inv=>(
              <TRow key={inv.id}>
                <TD mono><span style={{color:T.accent}}>{inv.id}</span></TD>
                <TD>{inv.cliente}</TD>
                <TD mono><span style={{fontWeight:600}}>{fmt(inv.monto)}</span></TD>
                <TD muted>{inv.fecha}</TD>
                <TD muted>{inv.vence}</TD>
                <TD>
                  <span style={{padding:'2px 8px',borderRadius:3,fontSize:10,fontWeight:700,letterSpacing:'0.05em',
                    color:inv.tipo==='venta'?T.cyan:T.purple,background:inv.tipo==='venta'?T.cyanBg:T.purpleBg,
                    fontFamily:"'DM Sans',sans-serif"}}>
                    {inv.tipo==='venta'?'VENTA':'COMPRA'}
                  </span>
                </TD>
                <TD><Badge status={inv.estado}/></TD>
              </TRow>
            ))}
          </tbody>
        </TableWrap>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {[
          {label:'Cuentas por Cobrar (30 días)', value:porCobrar, note:'3 facturas pendientes'},
          {label:'Cuentas por Pagar', value:invoices.filter(i=>i.tipo==='compra'&&i.estado==='pendiente').reduce((a,b)=>a+b.monto,0), note:'2 facturas de proveedores'},
          {label:'Cartera Vencida', value:vencido, note:'2 facturas con mora'},
        ].map(item=>(
          <div key={item.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{item.label.toUpperCase()}</div>
            <div style={{color:T.textPrimary,fontSize:20,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>{fmt(item.value)}</div>
            <div style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── INVENTARIO ───────────────────────────────────────────────────────────────
function Inventario() {
  const [tab,    setTab]    = useState('stock');
  const [search, setSearch] = useState('');

  const totalValue    = inventory.reduce((a,b)=>a+b.stock*b.precio,0);
  const lowStockCount = inventory.filter(i=>i.stock<i.min).length;
  const activeSuppl   = suppliers.filter(s=>s.estado==='activo').length;

  const filtered = inventory.filter(i=>
    i.nombre.toLowerCase().includes(search.toLowerCase())||
    i.cat.toLowerCase().includes(search.toLowerCase())||
    i.proveedor.toLowerCase().includes(search.toLowerCase())
  );

  // Chart: stock vs min by product (top 8)
  const stockChartData = inventory.slice(0,8).map(i=>({
    name:i.id.replace('PRD-0','P'),
    stock:i.stock, min:i.min
  }));

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
        <KPICard label="Productos"         value={inventory.length} Icon={Package}       color={T.accent} isNumber/>
        <KPICard label="Valor Total"        value={totalValue}       Icon={DollarSign}    color={T.green}  trend={4.3}/>
        <KPICard label="Alertas Stock Bajo" value={lowStockCount}    Icon={AlertTriangle} color={T.red}    isNumber/>
        <KPICard label="Proveedores Activos"value={activeSuppl}      Icon={Users}         color={T.cyan}   isNumber/>
      </div>

      {/* Stock chart */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <SecHeader title="Nivel de Stock vs Mínimo Requerido"/>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stockChartData} margin={{top:5,right:5,bottom:0,left:0}} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
            <XAxis dataKey="name" tick={{fill:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={28}/>
            <Tooltip contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:12}}/>
            <Legend wrapperStyle={{paddingTop:6,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:T.textSecondary}}/>
            <Bar dataKey="stock" name="Stock Actual" fill={T.cyan}   fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={22}/>
            <Bar dataKey="min"   name="Mínimo"       fill={T.red}    fillOpacity={0.5}  radius={[3,3,0,0]} maxBarSize={22}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabs */}
      <div style={{borderBottom:`1px solid ${T.border}`,display:'flex',gap:0}}>
        <TabBtn label="📦  Inventario" active={tab==='stock'}     onClick={()=>setTab('stock')}/>
        <TabBtn label="🏢  Proveedores" active={tab==='suppliers'} onClick={()=>setTab('suppliers')}/>
      </div>

      {tab==='stock' && (
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <SearchBar value={search} onChange={setSearch} placeholder="Buscar producto, categoría..."/>
            <button style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:T.accentBg,
              border:`1px solid ${T.accentBorder}`,borderRadius:6,color:T.accent,fontSize:12,fontWeight:700,
              fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
              <Plus size={13}/> Nuevo Producto
            </button>
          </div>
          <TableWrap>
            <THead cols={['ID','Producto','Categoría','Stock','Estado','Precio Unit.','Valor Total','Proveedor']}/>
            <tbody>
              {filtered.map(item=>{
                const ratio=item.stock/item.min;
                const stockSt=ratio<0.5?'CRÍTICO':ratio<1?'BAJO':'NORMAL';
                const sc=stockSt==='CRÍTICO'?T.red:stockSt==='BAJO'?T.accent:T.green;
                return (
                  <TRow key={item.id}>
                    <TD mono><span style={{color:T.textMuted,fontSize:11}}>{item.id}</span></TD>
                    <TD><span style={{fontWeight:600}}>{item.nombre}</span></TD>
                    <TD muted>{item.cat}</TD>
                    <TD>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                          <span style={{color:sc,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:14}}>{item.stock}</span>
                          <span style={{color:T.textMuted,fontSize:10}}>/ mín {item.min}</span>
                        </div>
                        <div style={{background:T.border,borderRadius:2,height:3,width:64,overflow:'hidden'}}>
                          <div style={{background:sc,height:'100%',width:`${Math.min(100,(item.stock/item.min)*100)}%`,borderRadius:2}}/>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <span style={{fontSize:10,fontWeight:700,color:sc,background:`${sc}15`,padding:'3px 8px',borderRadius:3,letterSpacing:'0.05em',fontFamily:"'DM Sans',sans-serif"}}>
                        {stockSt}
                      </span>
                    </TD>
                    <TD mono>{fmt(item.precio)}</TD>
                    <TD mono><span style={{color:T.accent,fontWeight:600}}>{fmt(item.stock*item.precio)}</span></TD>
                    <TD muted>{item.proveedor}</TD>
                  </TRow>
                );
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {tab==='suppliers' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:T.accentBg,
              border:`1px solid ${T.accentBorder}`,borderRadius:6,color:T.accent,fontSize:12,fontWeight:700,
              fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
              <Plus size={13}/> Nuevo Proveedor
            </button>
          </div>
          <TableWrap>
            <THead cols={['ID','Proveedor','Contacto','Categoría','Calificación','OC Activas','Monto Compras','Estado']}/>
            <tbody>
              {suppliers.map(s=>(
                <TRow key={s.id}>
                  <TD mono><span style={{color:T.textMuted,fontSize:11}}>{s.id}</span></TD>
                  <TD>
                    <div>
                      <div style={{fontWeight:600,fontSize:13,color:T.textPrimary,fontFamily:"'DM Sans',sans-serif"}}>{s.nombre}</div>
                      <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>{s.email}</div>
                    </div>
                  </TD>
                  <TD muted>{s.contacto}</TD>
                  <TD muted>{s.cat}</TD>
                  <TD>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <Star size={12} fill={T.accent} color={T.accent}/>
                      <span style={{color:T.accent,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13}}>{s.rating}</span>
                    </div>
                  </TD>
                  <TD mono><span style={{color:s.ordenes>0?T.cyan:T.textMuted}}>{s.ordenes}</span></TD>
                  <TD mono><span style={{color:T.green,fontWeight:600}}>{fmt(s.monto)}</span></TD>
                  <TD><Badge status={s.estado}/></TD>
                </TRow>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}
    </div>
  );
}

// ── PEDIDOS ───────────────────────────────────────────────────────────────────
function Pedidos() {
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const cnt = {
    todos:       orders.length,
    entregado:   orders.filter(o=>o.estado==='entregado').length,
    en_tránsito: orders.filter(o=>o.estado==='en_tránsito').length,
    procesando:  orders.filter(o=>o.estado==='procesando').length,
    cancelado:   orders.filter(o=>o.estado==='cancelado').length,
  };
  const revenue = orders.filter(o=>o.estado!=='cancelado').reduce((a,b)=>a+b.monto,0);

  const filtered = orders.filter(o=>{
    const mf = filter==='todos'||o.estado===filter;
    const ms = !search||o.cliente.toLowerCase().includes(search.toLowerCase())||o.id.toLowerCase().includes(search.toLowerCase());
    return mf&&ms;
  });

  const statusDist = [
    {name:'Entregados', value:cnt.entregado,   color:T.green},
    {name:'En Tránsito',value:cnt.en_tránsito, color:T.cyan},
    {name:'Procesando', value:cnt.procesando,  color:T.accent},
    {name:'Cancelados', value:cnt.cancelado,   color:T.red},
  ];

  const filterDefs = [
    {id:'todos',      label:'Todos',      color:T.textSecondary},
    {id:'entregado',  label:'Entregados', color:T.green},
    {id:'en_tránsito',label:'En Tránsito',color:T.cyan},
    {id:'procesando', label:'Procesando', color:T.accent},
    {id:'cancelado',  label:'Cancelados', color:T.red},
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10}}>
        <KPICard label="Total Pedidos"    value={cnt.todos}         Icon={ShoppingCart} color={T.accent} isNumber trend={8.2}/>
        <KPICard label="Entregados"       value={cnt.entregado}     Icon={CheckCircle}  color={T.green}  isNumber/>
        <KPICard label="En Tránsito"      value={cnt.en_tránsito}   Icon={Truck}        color={T.cyan}   isNumber/>
        <KPICard label="Cancelados"       value={cnt.cancelado}     Icon={XCircle}      color={T.red}    isNumber/>
      </div>

      {/* Charts */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 270px',gap:12}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SecHeader title="Monto por Pedido — Diciembre 2024"/>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={orders.map(o=>({name:o.id.replace('ORD-24',''),monto:o.monto,estado:o.estado}))} margin={{top:5,right:5,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="name" tick={{fill:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={v=>`$${v/1000}K`} tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={46}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="monto" name="Monto" radius={[4,4,0,0]} maxBarSize={22}>
                {orders.map((o,i)=><Cell key={i} fill={ST[o.estado].color} fillOpacity={0.8}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SecHeader title="Distribución de Estados"/>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={statusDist} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                {statusDist.map((e,i)=><Cell key={i} fill={e.color} opacity={0.85}/>)}
              </Pie>
              <Tooltip contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:2}}>
            {statusDist.map(s=>(
              <div key={s.name} style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                <span style={{color:T.textSecondary,fontSize:11,flex:1,fontFamily:"'DM Sans',sans-serif"}}>{s.name}</span>
                <span style={{color:T.textPrimary,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {filterDefs.map(f=>(
              <FilterChip key={f.id} label={`${f.label} (${cnt[f.id]})`} active={filter===f.id} color={f.color} onClick={()=>setFilter(f.id)}/>
            ))}
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar cliente o ID..." width={220}/>
        </div>
        <TableWrap>
          <THead cols={['Pedido','Cliente','Ciudad','Items','Monto','Fecha','Estado']}/>
          <tbody>
            {filtered.map(o=>(
              <TRow key={o.id}>
                <TD mono><span style={{color:T.accent}}>{o.id}</span></TD>
                <TD><span style={{fontWeight:600}}>{o.cliente}</span></TD>
                <TD muted>{o.ciudad}</TD>
                <TD mono><span style={{color:T.textSecondary}}>{o.items}</span></TD>
                <TD mono><span style={{fontWeight:700}}>{fmt(o.monto)}</span></TD>
                <TD muted>{o.fecha}</TD>
                <TD><Badge status={o.estado}/></TD>
              </TRow>
            ))}
          </tbody>
        </TableWrap>
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:'32px 16px',color:T.textMuted,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>
            No se encontraron pedidos con ese criterio.
          </div>
        )}
      </div>

      {/* Revenue summary */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 18px',display:'flex',gap:24,flexWrap:'wrap'}}>
        {[
          {label:'Ingresos del Mes (sin cancelados)', value:fmt(revenue), color:T.green},
          {label:'Pedido Promedio', value:fmt(Math.round(revenue/(cnt.todos-cnt.cancelado))), color:T.cyan},
          {label:'Tasa de Cancelación', value:`${((cnt.cancelado/cnt.todos)*100).toFixed(1)}%`, color:T.red},
          {label:'Tasa de Entrega', value:`${((cnt.entregado/cnt.todos)*100).toFixed(1)}%`, color:T.green},
        ].map(s=>(
          <div key={s.label}>
            <div style={{color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>{s.label.toUpperCase()}</div>
            <div style={{color:s.color,fontSize:18,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NAV CONFIG ────────────────────────────────────────────────────────────────
const NAV = [
  {id:'dashboard',   label:'Dashboard',          Icon:LayoutDashboard, desc:'Vista general'},
  {id:'finanzas',    label:'Finanzas',            Icon:DollarSign,      desc:'Facturacion y P&L'},
  {id:'inventario',  label:'Inventario',          Icon:Package,         desc:'Stock y proveedores'},
  {id:'pedidos',     label:'Pedidos',             Icon:ShoppingCart,    desc:'Gestion de ordenes'},
  {id:'ventas',      label:'Analitica Ventas',    Icon:BarChart2,       desc:'Reportes y tendencias'},
  {id:'dashreal',    label:'Dashboard Real',      Icon:BarChart2,       desc:'Datos reales Sol Pro'},
  {id:'calculadora', label:'Calculadora Precios', Icon:DollarSign,      desc:'Motor v5.0'},
  {id:'bancos',      label:'Bancos / Conciliación', Icon:Building2,       desc:'Extractos GS + USD'},
  {id:'impositivo',  label:'Impositivo DNIT',     Icon:FileText,        desc:'Calendario, Anticipos, Retenciones'},
  {id:'cargador', label:'Cargar Documentos', Icon:FolderOpen, desc:'PDFs y Excel locales'},
  {id:'real2026', label:'Dashboard Real 2026', Icon:Calendar, desc:'Datos reales cruzados Ene-Mar 2026'},
  {id:'ips', label:'Calculadora IPS', Icon:Calculator, desc:'Aportes Obrero-Patronales'},
];
// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function BackOffice() {
  const [active, setActive] = useState('dashboard');
  const [time]  = useState(new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}));
  const current = NAV.find(n=>n.id===active);

  return (
    <div style={{display:'flex',height:'100vh',background:T.bg,fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:${T.surface};}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:${T.accent}50;}
        input::placeholder{color:${T.textMuted};}
      `}</style>

     {/* ── SIDEBAR ── */}
      <aside style={{width:210,minHeight:'100vh',background:T.surface,borderRight:`1px solid ${T.border}`,display:'flex',flexDirection:'column',flexShrink:0}}>
        {/* Logo */}
        <div style={{padding:'18px 14px 14px',borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/LOGO  SIN FONDO 2D REBRANDING REDONDO - copia.png"
              style={{width:38,height:38,borderRadius:'50%',objectFit:'cover',flexShrink:0,
                border:`1.5px solid ${T.accent}`,boxShadow:`0 0 14px ${T.accent}40`}}/>
            <div>
              <div style={{color:T.accent,fontWeight:800,fontSize:14,fontFamily:"'Syne',sans-serif",letterSpacing:'0.08em',lineHeight:1}}>SOL PRO</div>
              <div style={{color:T.textMuted,fontSize:9,letterSpacing:'0.14em',fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>SOLUCIONES PROF.</div>
            </div>
          </div>
        </div>

        {/* Nav label */}
        <div style={{padding:'14px 16px 6px'}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.14em',fontFamily:"'DM Sans',sans-serif"}}>MÓDULOS</span>
        </div>

        {/* Nav items */}
        <nav style={{flex:1,padding:'0 8px',overflowY:'auto'}}>
          {NAV.map(item=>{
            const isActive = active===item.id;
            return (
              <button key={item.id} onClick={()=>setActive(item.id)} style={{
                width:'100%',display:'flex',alignItems:'center',gap:9,
                padding:'9px 10px',borderRadius:7,border:'none',
                background:isActive?T.accentBg:'transparent',
                color:isActive?T.accent:T.textSecondary,
                cursor:'pointer',marginBottom:2,
                fontFamily:"'DM Sans',sans-serif",fontSize:13,
                fontWeight:isActive?600:400,
                borderLeft:isActive?`2px solid ${T.accent}`:'2px solid transparent',
                transition:'all 0.15s',textAlign:'left',
              }}>
                <item.Icon size={15}/>
                <div>
                  <div>{item.label}</div>
                  {isActive&&<div style={{fontSize:9,color:T.accent,opacity:0.7,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.06em'}}>{item.desc}</div>}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom tools */}
        <div style={{padding:'4px 8px 8px',borderTop:`1px solid ${T.border}`}}>
          {[{label:'Configuración',Icon:Settings},{label:'Exportar Datos',Icon:Download}].map(item=>(
            <button key={item.label} style={{width:'100%',display:'flex',alignItems:'center',gap:9,
              padding:'8px 10px',borderRadius:6,border:'none',background:'transparent',
              color:T.textMuted,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:400}}>
              <item.Icon size={13}/>{item.label}
            </button>
          ))}
        </div>

        {/* User */}
        <div style={{padding:'10px 12px',borderTop:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:9}}>
          <div style={{width:30,height:30,background:`linear-gradient(135deg,${T.accent},#92400e)`,borderRadius:'50%',
            display:'flex',alignItems:'center',justifyContent:'center',color:'#000',fontWeight:800,fontSize:13,
            fontFamily:"'Syne',sans-serif",flexShrink:0}}>A</div>
          <div style={{minWidth:0}}>
            <div style={{color:T.textPrimary,fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>Administrador</div>
            <div style={{color:T.textMuted,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>Gerencia General</div>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
        {/* Top bar */}
        <header style={{height:50,background:T.surface,borderBottom:`1px solid ${T.border}`,
          display:'flex',alignItems:'center',padding:'0 18px',gap:12,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:0}}>
            <span style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>Nexus BO</span>
            <ChevronRight size={11} color={T.textMuted}/>
            <span style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif"}}>{current?.label}</span>
            <span style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginLeft:4}}>/</span>
            <span style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>{current?.desc}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{padding:'5px 10px',background:T.card,border:`1px solid ${T.border}`,borderRadius:5,
              color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
              Dic 2024 · {time}
            </div>
            <button style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',background:T.card,
              border:`1px solid ${T.border}`,borderRadius:5,color:T.textSecondary,fontSize:10,fontWeight:700,
              fontFamily:"'DM Sans',sans-serif",cursor:'pointer',letterSpacing:'0.05em'}}>
              <RefreshCw size={11}/> ACTUALIZAR
            </button>
            <button style={{width:32,height:32,background:T.card,border:`1px solid ${T.border}`,borderRadius:6,
              display:'flex',alignItems:'center',justifyContent:'center',color:T.textSecondary,cursor:'pointer',position:'relative'}}>
              <Bell size={14}/>
              <div style={{position:'absolute',top:6,right:6,width:6,height:6,background:T.red,borderRadius:'50%',border:`1.5px solid ${T.surface}`}}/>
            </button>
            <button style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',
              background:T.accent,border:'none',borderRadius:6,color:'#000',fontSize:12,
              fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:'pointer'}}>
              <Download size={13}/> Reporte
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{flex:1,overflowY:'auto',padding:14,minHeight:0}}>
          {active==='dashboard'  && <Dashboard setActive={setActive}/>}
          {active==='finanzas'   && <FinanzasPro/>}
          {active==='inventario' && <Inventario/>}
          {active==='pedidos'    && <Pedidos/>}
          {active==='ventas'     && <VentasAnalytics/>}
          {active==='dashreal'   && <DashboardReal/>}
          {active==='calculadora'&& <CalculadoraPrecios/>}
          {active==='bancos'     && <ConciliacionBancaria/>}
          {active==='impositivo' && <ImpositivoDNIT/>}
          {active==='cargador' && <CargadorDocumentos/>}
          {active==='real2026' && <DashboardReal2026/>}
          {active==='ips' && <IPSCalculator/>}
        </main>
      </div>
    </div>
  );
}