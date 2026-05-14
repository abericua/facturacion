import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, RadarChart,
  Radar, PolarGrid, PolarAngleAxis
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, BarChart2,
  Search, Calendar, Filter, Download, RefreshCw,
  ShoppingCart, Star, AlertTriangle, ChevronUp, ChevronDown
} from "lucide-react";

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg:'#07080f', surface:'#0d1117', card:'#111827', cardB:'#141d2e',
  border:'#1a2535', borderL:'#243045',
  accent:'#f59e0b', accentBg:'rgba(245,158,11,0.08)', accentBorder:'rgba(245,158,11,0.25)',
  cyan:'#22d3ee', cyanBg:'rgba(34,211,238,0.08)',
  green:'#34d399', greenBg:'rgba(52,211,153,0.08)',
  red:'#f87171', redBg:'rgba(248,113,113,0.08)',
  purple:'#a78bfa', purpleBg:'rgba(167,139,250,0.08)',
  orange:'#fb923c',
  textPrimary:'#e2e8f0', textSecondary:'#7d9db5', textMuted:'#3d5470',
};

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sept','Oct','Nov','Dic'];
const MONTH_MAP = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sept:8,sep:8,oct:9,nov:10,dic:11};

// Tabla de unidades por caja según código de producto
const UDS_CAJA_MAP = [
  {kw:['T53K'], uds:2, compat:'F6470'},
  {kw:['T46C'], uds:6, compat:'F6370'},
  {kw:['T741'], uds:6, compat:'F6200/F6070'},
  {kw:['T49M'], uds:1, compat:'F170/F570'},
  {kw:['T43M'], uds:1, compat:'F10070'},
  {kw:['T40W'], uds:1, compat:'T3170'},
  {kw:['T41P'], uds:1, compat:'T5475'},
  {kw:['T44P'], uds:1, compat:'P-Series'},
  {kw:['T49H'], uds:1, compat:'V1070/V2070'},
  {kw:['T55A'], uds:1, compat:'F1070'},
  {kw:['T54K'], uds:1, compat:'F2100WE'},
  {kw:['T55K'], uds:1, compat:'P9000'},
  {kw:['T804'], uds:1, compat:'P9000'},
  {kw:['T824'], uds:1, compat:'P9000'},
  {kw:['T57S'], uds:1, compat:'G6070'},
  {kw:['T890'], uds:1, compat:'S40600'},
  {kw:['T694'], uds:1, compat:'T5270DR'},
  {kw:['T725'], uds:1, compat:'F2100WE'},
  {kw:['EPPF'], uds:1, compat:'Garantía'},
];

function getUdsPorCaja(code, desc) {
  const s = (code + ' ' + desc).toUpperCase();
  for (const m of UDS_CAJA_MAP) {
    if (m.kw.some(k => s.includes(k))) return { uds: m.uds, compat: m.compat };
  }
  return { uds: 1, compat: '' };
}

function getColor(desc) {
  const d = desc.toUpperCase();
  if (d.includes('CYAN') || d.includes(' CY'))                           return 'Cyan';
  if (d.includes('MAGENTA') || d.includes(' MG') || d.includes(' MA'))  return 'Magenta';
  if (d.includes('YELLOW') || d.includes('AMARILL') || d.includes(' YE')) return 'Amarillo';
  if (d.includes('NEGRO MATTE') || d.includes('NEGRO MATE'))            return 'Negro Mate';
  if (d.includes('NEGRO LIGHT') || d.includes('NEGRO LT'))              return 'Negro Light';
  if (d.includes('NEGRO') || d.includes('BLACK') || d.includes(' BK') || d.includes(' NK')) return 'Negro';
  if (d.includes('BLANCO') || d.includes('WHITE'))                       return 'Blanco';
  if (d.includes('FLUO'))                                                return 'Fluorescente';
  if (d.includes('NARANJA') || d.includes('ORANGE'))                     return 'Naranja';
  if (d.includes('VERDE') || d.includes('GREEN'))                        return 'Verde';
  if (d.includes('VIOLETA') || d.includes('VIOLET'))                     return 'Violeta';
  if (d.includes('CYAN CLARO') || d.includes('LIGHT CYAN'))              return 'Cyan Claro';
  if (d.includes('MAGENTA CLARO') || d.includes('LIGHT MAGENTA'))        return 'Magenta Claro';
  return null; // No es tinta con color
}

const COLOR_HEX = {
  'Cyan':           '#22d3ee',
  'Magenta':        '#f472b6',
  'Amarillo':       '#fbbf24',
  'Negro':          '#94a3b8',
  'Negro Mate':     '#64748b',
  'Negro Light':    '#cbd5e1',
  'Blanco':         '#e2e8f0',
  'Fluorescente':   '#a3e635',
  'Naranja':        '#fb923c',
  'Verde':          '#34d399',
  'Violeta':        '#a78bfa',
  'Cyan Claro':     '#67e8f9',
  'Magenta Claro':  '#f9a8d4',
};

const CAT_COLORS = {
  'Impresoras Tank':  T.cyan,
  'Plotters':         T.accent,
  'SureColor':        T.purple,
  'Tintas/Consumibles':T.green,
  'Garantías':        T.orange,
  'Cabezales':        T.red,
  'Papel/Rollos':     '#60a5fa',
  'Matriciales':      '#f472b6',
  'Otros':            T.textSecondary,
};

// ── CSV PARSER ────────────────────────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split('-');
  if (parts.length < 3) return null;
  const day   = parseInt(parts[0]);
  const month = MONTH_MAP[parts[1].toLowerCase()];
  const year  = parseInt(parts[2]) < 100 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
  if (isNaN(day) || month === undefined || isNaN(year)) return null;
  return { day, month, year, key: `${year}-${String(month+1).padStart(2,'0')}` };
}

function categorize(desc) {
  const d = desc.toUpperCase();
  if (d.includes('PLOTER') || d.includes('PLOTTER'))         return 'Plotters';
  if (d.includes('SURECOLOR') || d.includes('T 3170') || d.includes('T3170') || d.includes('SCF') || d.includes('SCS')) return 'SureColor';
  if (d.includes('GARANTIA') || d.includes('GARANTÍA'))      return 'Garantías';
  if (d.includes('TINTA') || d.includes('INK') || d.includes('CARTUCHO')) return 'Tintas/Consumibles';
  if (d.includes('CABEZAL') || d.includes('HEAD'))           return 'Cabezales';
  if (d.includes('PAPEL') || d.includes('ROLLO') || d.includes('PAPER')) return 'Papel/Rollos';
  if (d.includes('LX-') || d.includes('LX ') || d.includes('MATRICIAL'))  return 'Matriciales';
  if (d.includes('IMP EPSON') || d.includes('IMPRESORA'))    return 'Impresoras Tank';
  if (d.includes('ESPECTROFOTOMETRO') || d.includes('ESCANER') || d.includes('SCANNER')) return 'Otros';
  return 'Otros';
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const rows  = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 3) continue;
    const fecha = parseDate(cols[0]?.trim());
    const qty   = parseInt(cols[1]?.trim()) || 0;
    const desc  = cols[2]?.trim() || '';
    const code  = cols[3]?.trim() || '';
    if (!fecha || qty <= 0 || !desc) continue;
    const ucuv  = getUdsPorCaja(code, desc);
    const color = getColor(desc);
    rows.push({ fecha, qty, desc, code, cat: categorize(desc),
      udsPorCaja: ucuv.uds, compat: ucuv.compat,
      unidadesReales: qty * ucuv.uds, color });
  }
  return rows;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmtN = n => new Intl.NumberFormat('es-PY').format(n);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:T.cardB,border:`1px solid ${T.borderL}`,borderRadius:8,padding:'10px 14px',minWidth:120}}>
      <p style={{color:T.textSecondary,fontSize:11,marginBottom:7,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,marginBottom:2}}>
          <span style={{color:T.textMuted,fontFamily:"'DM Sans',sans-serif",fontSize:10}}>{p.name}: </span>
          {fmtN(p.value)}
        </p>
      ))}
    </div>
  );
};

const KPI = ({ label, value, sub, color, Icon, trend }) => (
  <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px',flex:1,minWidth:0}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
      <div style={{minWidth:0,flex:1}}>
        <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:7,fontFamily:"'DM Sans',sans-serif"}}>{label.toUpperCase()}</div>
        <div style={{color:T.textPrimary,fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'-0.02em',lineHeight:1}}>{value}</div>
        {sub && <div style={{color:T.textMuted,fontSize:10,marginTop:5,fontFamily:"'DM Sans',sans-serif"}}>{sub}</div>}
      </div>
      <div style={{background:`${color}18`,borderRadius:8,padding:9,color,flexShrink:0}}><Icon size={17}/></div>
    </div>
    {trend !== undefined && (
      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:8,fontSize:11,color:trend>=0?T.green:T.red}}>
        {trend>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{Math.abs(trend)}%</span>
        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>vs período anterior</span>
      </div>
    )}
  </div>
);

const SH = ({ title, action }) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
    <h2 style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",letterSpacing:'0.04em'}}>{title}</h2>
    {action}
  </div>
);

const FilterChip = ({ label, active, color, onClick }) => (
  <button onClick={onClick} style={{padding:'5px 12px',borderRadius:4,
    border:`1px solid ${active?(color||T.accent):T.border}`,
    background:active?`${color||T.accent}15`:'transparent',
    color:active?(color||T.accent):T.textSecondary,
    fontSize:10,fontWeight:700,cursor:'pointer',letterSpacing:'0.05em',
    fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap',transition:'all 0.12s'}}>
    {label}
  </button>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function VentasAnalytics() {
  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [yearFilter, setYearFilter] = useState('Todos');
  const [catFilter,  setCatFilter]  = useState('Todas');
  const [search,     setSearch]     = useState('');
  const [sortField,  setSortField]  = useState('qty');
  const [sortDir,    setSortDir]    = useState('desc');
  const [tab,        setTab]        = useState('tendencia');
  const [cmpYear1,   setCmpYear1]   = useState('2024');
  const [cmpYear2,   setCmpYear2]   = useState('2025');

  // Load CSV
  useEffect(() => {
    // Cargar CSV de ventas 2024-2026
    const p1 = fetch('/BBDD_VENTAS_24_AL_26.csv')
      .then(r => r.ok ? r.text() : '')
      .then(txt => txt ? parseCSV(txt) : [])
      .catch(() => []);

    // Cargar CSV de compras históricas 2015-2023 (solo años anteriores a 2024)
    const p2 = fetch('/COMPRAS_SOL_CONTROL_2015_2026.csv')
      .then(r => r.ok ? r.text() : '')
      .then(txt => {
        if (!txt) return [];
        const lines = txt.trim().split('\n').filter(l=>l.trim());
        const rows = [];
        // Parser CSV que maneja campos entre comillas
        function parseCSVLine(line) {
          const result = []; let cur = ''; let inQ = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i]==='"') { inQ=!inQ; continue; }
            if (line[i]===',' && !inQ) { result.push(cur.trim()); cur=''; continue; }
            cur += line[i];
          }
          result.push(cur.trim());
          return result;
        }
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < 3) continue;
          const anio  = parseInt(cols[0]?.trim());
          const prod  = cols[1]?.trim() || '';
          const cant  = parseInt(cols[2]?.trim()) || 0;
          const cat   = cols[3]?.trim() || '';
          // Solo años anteriores a 2024 para no duplicar con BBDD ventas
          if (!anio || anio >= 2024 || cant <= 0 || !prod) continue;
          // Crear fecha sintética (enero del año, sin día específico)
          const fecha = { day:1, month:0, year:anio, key:`${anio}-01` };
          const ucuv  = getUdsPorCaja('', prod);
          const color = getColor(prod);
          // Categorizar
          let catVenta = 'Otros';
          const cu = cat.toUpperCase();
          if (cu.includes('TINTA'))                                  catVenta = 'Tintas/Consumibles';
          else if (cu.includes('PLOTTER') || cu.includes('SURECOLOR')) catVenta = 'SureColor';
          else if (cu.includes('IMPRESORA ECOTANK'))                  catVenta = 'Impresoras Tank';
          else if (cu.includes('REPUESTO') || cu.includes('MANTEN'))  catVenta = 'Cabezales';
          else if (cu.includes('PAPEL') || cu.includes('INSUMO'))     catVenta = 'Papel/Rollos';
          else if (cu.includes('GARANTIA') || cu.includes('GARANTÍA'))catVenta = 'Garantías';
          else catVenta = categorize(prod);
          rows.push({ fecha, qty:cant, desc:prod, code:'', cat:catVenta,
            udsPorCaja:ucuv.uds, compat:ucuv.compat,
            unidadesReales:cant*ucuv.uds, color });
        }
        return rows;
      })
      .catch(() => []);

    Promise.all([p1, p2]).then(([ventas, historico]) => {
      setData([...historico, ...ventas]);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Derived state
  const years = useMemo(() => ['Todos', ...([...new Set(data.map(d=>d.fecha.year))].sort())], [data]);
  const cats  = useMemo(() => ['Todas', ...Object.keys(CAT_COLORS)], []);

  const filtered = useMemo(() => data.filter(d => {
    const fy = yearFilter === 'Todos' || d.fecha.year === parseInt(yearFilter);
    const fc = catFilter  === 'Todas' || d.cat === catFilter;
    const fs = !search || d.desc.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase());
    return fy && fc && fs;
  }), [data, yearFilter, catFilter, search]);

  // KPIs
  const totalQty  = useMemo(() => filtered.reduce((a,b)=>a+b.qty,0), [filtered]);
  const totalTxns = filtered.length;
  const uniqueProd= useMemo(() => new Set(filtered.map(d=>d.code||d.desc)).size, [filtered]);
  const topProd   = useMemo(() => {
    const map = {};
    filtered.forEach(d=>{ map[d.desc]=(map[d.desc]||0)+d.qty; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1])[0];
  }, [filtered]);

  // Monthly trend
  const monthlyData = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      const k = `${d.fecha.year}-${String(d.fecha.month+1).padStart(2,'0')}`;
      if (!map[k]) map[k] = { key:k, year:d.fecha.year, month:d.fecha.month, label:`${MONTHS[d.fecha.month]} ${d.fecha.year}`, qty:0 };
      map[k].qty += d.qty;
    });
    return Object.values(map).sort((a,b)=>a.key.localeCompare(b.key));
  }, [filtered]);

  // By category
  const catData = useMemo(() => {
    const map = {};
    filtered.forEach(d => { map[d.cat]=(map[d.cat]||0)+d.qty; });
    return Object.entries(map).map(([name,qty])=>({name,qty,color:CAT_COLORS[name]||T.textSecondary})).sort((a,b)=>b.qty-a.qty);
  }, [filtered]);

  // Product ranking
  const productRanking = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      const k = d.desc;
      if (!map[k]) map[k] = { desc:d.desc, code:d.code, cat:d.cat, qty:0, txns:0 };
      map[k].qty  += d.qty;
      map[k].txns += 1;
    });
    const arr = Object.values(map);
    return arr.sort((a,b) => {
      const diff = sortDir==='asc' ? a[sortField]-b[sortField] : b[sortField]-a[sortField];
      return diff;
    });
  }, [filtered, sortField, sortDir]);

  // Seasonality: avg qty by month across all years
  const seasonality = useMemo(() => {
    const map = Array(12).fill(0).map((_,i)=>({month:MONTHS[i],qty:0,count:0}));
    filtered.forEach(d=>{ map[d.fecha.month].qty+=d.qty; map[d.fecha.month].count+=1; });
    return map.map(m=>({...m, avg: m.count>0 ? Math.round(m.qty/Math.max(1,years.filter(y=>y!=='Todos').length)) : 0}));
  }, [filtered, years]);

  // Period comparison
  const periodComparison = useMemo(() => {
    return MONTHS.map((mon,i)=>{
      const y1 = data.filter(d=>d.fecha.year===parseInt(cmpYear1)&&d.fecha.month===i).reduce((a,b)=>a+b.qty,0);
      const y2 = data.filter(d=>d.fecha.year===parseInt(cmpYear2)&&d.fecha.month===i).reduce((a,b)=>a+b.qty,0);
      return { mes:mon, [cmpYear1]:y1, [cmpYear2]:y2 };
    });
  }, [data, cmpYear1, cmpYear2]);

  // Year over year total
  const yoyData = useMemo(() => {
    const map = {};
    data.forEach(d=>{ map[d.fecha.year]=(map[d.fecha.year]||0)+d.qty; });
    return Object.entries(map).map(([year,qty])=>({year:String(year),qty})).sort((a,b)=>a.year.localeCompare(b.year));
  }, [data]);

  const handleSort = (field) => {
    if (sortField===field) setSortDir(d=>d==='asc'?'desc':'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({field}) => {
    if (sortField!==field) return <ChevronUp size={11} color={T.textMuted}/>;
    return sortDir==='asc'?<ChevronUp size={11} color={T.accent}/>:<ChevronDown size={11} color={T.accent}/>;
  };

  const TabBtn = ({id,label}) => (
    <button onClick={()=>setTab(id)} style={{padding:'8px 16px',border:'none',background:'transparent',
      color:tab===id?T.accent:T.textSecondary,
      borderBottom:tab===id?`2px solid ${T.accent}`:'2px solid transparent',
      cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:-1,whiteSpace:'nowrap'}}>
      {label}
    </button>
  );

  const exportarCSV = () => {
    const headers = ['Fecha','Producto','Código','Cantidad','Categoría','Unidades Reales'];
    const rows = filtered.map(d => [`${d.fecha.year}-${String(d.fecha.month+1).padStart(2,'0')}-${String(d.fecha.day).padStart(2,'0')}`,d.desc,d.code,d.qty,d.cat,d.unidadesReales]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `ventas_solpro_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── LOADING / ERROR ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:14}}>
      <div style={{width:38,height:38,border:`3px solid ${T.border}`,borderTop:`3px solid ${T.accent}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <p style={{color:T.textSecondary,fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Cargando datos de ventas...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12}}>
      <AlertTriangle size={32} color={T.red}/>
      <p style={{color:T.red,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600}}>Error al cargar el CSV</p>
      <p style={{color:T.textSecondary,fontFamily:"'DM Sans',sans-serif",fontSize:12}}>{error}</p>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:'12px 18px',maxWidth:420}}>
        <p style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
          Asegúrate de copiar el archivo <span style={{color:T.accent,fontFamily:"'JetBrains Mono',monospace"}}>BBDD_VENTAS_24_AL_26.csv</span> dentro de la carpeta <span style={{color:T.cyan,fontFamily:"'JetBrains Mono',monospace"}}>public/</span> de tu proyecto.
        </p>
      </div>
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');`}</style>

      {/* FILTERS BAR */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Filter size={13} color={T.textMuted}/>
          <span style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>FILTROS:</span>
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {years.map(y=><FilterChip key={y} label={y} active={yearFilter===String(y)} onClick={()=>setYearFilter(String(y))}/>)}
        </div>
        <div style={{width:1,height:20,background:T.border}}/>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {cats.map(c=><FilterChip key={c} label={c} active={catFilter===c} color={CAT_COLORS[c]} onClick={()=>setCatFilter(c)}/>)}
        </div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 11px'}}>
          <Search size={12} color={T.textMuted}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto o código..."
            style={{background:'transparent',border:'none',outline:'none',color:T.textPrimary,fontSize:12,width:200,fontFamily:"'DM Sans',sans-serif"}}/>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={() => window.location.reload()} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:'pointer'}}>
            <RefreshCw size={13}/>Actualizar
          </button>
          <button onClick={exportarCSV} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:T.accent,border:`1px solid ${T.accent}`,borderRadius:6,color:'#fff',fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,cursor:'pointer'}}>
            <Download size={13}/>Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'flex',gap:10}}>
        <KPI label="Unidades Vendidas"   value={fmtN(totalQty)}    Icon={Package}    color={T.accent} sub={`en ${totalTxns} transacciones`}/>
        <KPI label="Productos Únicos"    value={fmtN(uniqueProd)}  Icon={Star}       color={T.cyan}   sub="SKUs distintos"/>
        <KPI label="Categorías Activas"  value={catData.length}    Icon={BarChart2}  color={T.purple} sub="líneas de producto"/>
        <KPI label="Producto Estrella"   value={topProd?fmtN(topProd[1]):'—'} Icon={TrendingUp} color={T.green}
          sub={topProd?topProd[0].substring(0,32)+'…':''}/>
      </div>

      {/* YEAR OVER YEAR */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:12}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SH title="Volumen Mensual de Ventas"/>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={monthlyData} margin={{top:5,right:5,bottom:0,left:0}}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={T.accent} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={T.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{fill:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false} interval={2}/>
              <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={32}/>
              <Tooltip content={<ChartTip/>}/>
              <Area type="monotone" dataKey="qty" name="Unidades" stroke={T.accent} fill="url(#gV)" strokeWidth={2.5} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SH title="Volumen por Año"/>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={yoyData} margin={{top:5,right:5,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="year" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={32}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="qty" name="Unidades" fill={T.cyan} fillOpacity={0.85} radius={[5,5,0,0]} maxBarSize={50}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:6}}>
            {yoyData.map(y=>{
              const max=Math.max(...yoyData.map(d=>d.qty));
              return (
                <div key={y.year} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",width:32}}>{y.year}</span>
                  <div style={{flex:1,background:T.border,borderRadius:2,height:5,overflow:'hidden'}}>
                    <div style={{background:T.cyan,height:'100%',width:`${(y.qty/max)*100}%`,borderRadius:2}}/>
                  </div>
                  <span style={{color:T.textPrimary,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,width:40,textAlign:'right'}}>{fmtN(y.qty)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TABS: Tendencia | Estacionalidad | Comparativa | Categorías */}
      <div style={{borderBottom:`1px solid ${T.border}`,display:'flex',gap:0}}>
        <TabBtn id="tendencia"     label="📈  Tendencia"/>
        <TabBtn id="estacionalidad"label="🌊  Estacionalidad"/>
        <TabBtn id="comparativa"   label="⚖️  Comparativa"/>
        <TabBtn id="categorias"    label="🏷️  Categorías"/>
        <TabBtn id="tintas"        label="🎨  Tintas & Stock"/>
        <TabBtn id="compras"       label="📦  Compras"/>
        <TabBtn id="stock"         label="⚖️  Stock & Rotación"/>
      </div>

      {/* TAB: TENDENCIA */}
      {tab==='tendencia' && (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
          <SH title="Tendencia de Ventas por Mes"/>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyData} margin={{top:5,right:5,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="label" tick={{fill:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={32}/>
              <Tooltip content={<ChartTip/>}/>
              <Line type="monotone" dataKey="qty" name="Unidades" stroke={T.accent} strokeWidth={2.5} dot={{fill:T.accent,r:3}} activeDot={{r:6}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* TAB: ESTACIONALIDAD */}
      {tab==='estacionalidad' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Estacionalidad — Promedio por Mes"/>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={seasonality} margin={{top:5,right:5,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={32}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="avg" name="Promedio Unidades" fill={T.purple} fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={28}>
                  {seasonality.map((m,i)=>{
                    const max=Math.max(...seasonality.map(s=>s.avg));
                    return <Cell key={i} fill={T.purple} opacity={0.4+(m.avg/max)*0.6}/>;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Radar de Estacionalidad"/>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={seasonality}>
                <PolarGrid stroke={T.border}/>
                <PolarAngleAxis dataKey="month" tick={{fill:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}/>
                <Radar name="Promedio" dataKey="avg" stroke={T.cyan} fill={T.cyan} fillOpacity={0.15} strokeWidth={2}/>
                <Tooltip content={<ChartTip/>}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Top 3 meses */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px',gridColumn:'span 2'}}>
            <SH title="Ranking de Meses por Volumen"/>
            <div style={{display:'flex',gap:10}}>
              {[...seasonality].sort((a,b)=>b.avg-a.avg).slice(0,6).map((m,i)=>{
                const colors=[T.accent,T.green,T.cyan,T.purple,T.orange,T.red];
                return (
                  <div key={m.month} style={{flex:1,background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                    <div style={{color:colors[i],fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>#{i+1}</div>
                    <div style={{color:T.textPrimary,fontSize:14,fontWeight:700,fontFamily:"'DM Sans',sans-serif",marginTop:2}}>{m.month}</div>
                    <div style={{color:colors[i],fontSize:14,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:3}}>{fmtN(m.avg)}</div>
                    <div style={{color:T.textMuted,fontSize:9,marginTop:2}}>uds. prom.</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: COMPARATIVA */}
      {tab==='comparativa' && (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{color:T.textSecondary,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>Comparar:</span>
            {years.filter(y=>y!=='Todos').map(y=>(
              <FilterChip key={`y1-${y}`} label={y} active={cmpYear1===String(y)} color={T.green} onClick={()=>setCmpYear1(String(y))}/>
            ))}
            <span style={{color:T.textMuted,fontSize:12}}>vs</span>
            {years.filter(y=>y!=='Todos').map(y=>(
              <FilterChip key={`y2-${y}`} label={y} active={cmpYear2===String(y)} color={T.cyan} onClick={()=>setCmpYear2(String(y))}/>
            ))}
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title={`Comparativa Mensual: ${cmpYear1} vs ${cmpYear2}`}/>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={periodComparison} margin={{top:5,right:5,bottom:0,left:0}} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                <XAxis dataKey="mes" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false} width={32}/>
                <Tooltip content={<ChartTip/>}/>
                <Legend wrapperStyle={{paddingTop:8,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:T.textSecondary}}/>
                <Bar dataKey={cmpYear1} fill={T.green}  fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={22}/>
                <Bar dataKey={cmpYear2} fill={T.cyan}   fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={22}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Variación por mes */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 18px'}}>
            <SH title="Variación Porcentual por Mes"/>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {periodComparison.map(m=>{
                const v1=m[cmpYear1]||0, v2=m[cmpYear2]||0;
                const pct=v1===0?(v2>0?100:0):Math.round(((v2-v1)/v1)*100);
                const c=pct>0?T.green:pct<0?T.red:T.textMuted;
                return (
                  <div key={m.mes} style={{flex:1,minWidth:60,background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{m.mes}</div>
                    <div style={{color:c,fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginTop:3}}>
                      {pct>0?'+':''}{pct}%
                    </div>
                    <div style={{color:T.textMuted,fontSize:9,marginTop:1}}>{fmtN(v1)}→{fmtN(v2)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CATEGORÍAS */}
      {tab==='categorias' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Volumen por Categoría"/>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={catData} layout="vertical" margin={{top:5,right:10,bottom:0,left:80}}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fill:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false} width={80}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="qty" name="Unidades" radius={[0,4,4,0]} maxBarSize={18}>
                  {catData.map((c,i)=><Cell key={i} fill={c.color} opacity={0.85}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
            <SH title="Participación por Categoría"/>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="qty">
                  {catData.map((c,i)=><Cell key={i} fill={c.color} opacity={0.85}/>)}
                </Pie>
                <Tooltip contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:12}}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {catData.map(c=>{
                const pct=Math.round((c.qty/totalQty)*100);
                return (
                  <div key={c.name} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                    <span style={{color:T.textSecondary,fontSize:11,flex:1,fontFamily:"'DM Sans',sans-serif"}}>{c.name}</span>
                    <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{fmtN(c.qty)}</span>
                    <span style={{color:c.color,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:32,textAlign:'right'}}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT RANKING TABLE */}
      <div>
        <SH title={`🏆 Ranking de Productos — Top ${Math.min(productRanking.length,200)} (${fmtN(productRanking.length)} productos)`}/>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:T.surface}}>
                  <th style={{padding:'10px 14px',color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",width:36}}>#</th>
                  <th style={{padding:'10px 14px',color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>PRODUCTO</th>
                  <th style={{padding:'10px 14px',color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>CATEGORÍA</th>
                  <th onClick={()=>handleSort('qty')} style={{padding:'10px 14px',color:sortField==='qty'?T.accent:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textAlign:'right',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",cursor:'pointer',userSelect:'none'}}>
                    <span style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>CAJAS VENDIDAS <SortIcon field="qty"/></span>
                  </th>
                  <th onClick={()=>handleSort('txns')} style={{padding:'10px 14px',color:sortField==='txns'?T.accent:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textAlign:'right',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",cursor:'pointer',userSelect:'none'}}>
                    <span style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4}}>NRO. VENTAS <SortIcon field="txns"/></span>
                  </th>
                  <th style={{padding:'10px 14px',color:T.textMuted,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textAlign:'right',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>% DEL TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {productRanking.slice(0,50).map((p,i)=>{
                  const pct=((p.qty/totalQty)*100).toFixed(1);
                  const colors=[T.accent,T.green,T.cyan];
                  const rankColor=i<3?colors[i]:T.textMuted;
                  return (
                    <tr key={p.desc} style={{borderBottom:`1px solid ${T.border}`}}>
                      <td style={{padding:'10px 14px'}}>
                        <span style={{color:rankColor,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:12}}>{i+1}</span>
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:500,maxWidth:420}}>{p.desc}</div>
                        <div style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{p.code}</div>
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        <span style={{padding:'2px 8px',borderRadius:3,fontSize:9,fontWeight:700,color:CAT_COLORS[p.cat]||T.textMuted,
                          background:`${CAT_COLORS[p.cat]||T.textMuted}15`,letterSpacing:'0.05em',fontFamily:"'DM Sans',sans-serif"}}>
                          {p.cat}
                        </span>
                      </td>
                      <td style={{padding:'10px 14px',textAlign:'right'}}>
                        <span style={{color:T.textPrimary,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:14}}>{fmtN(p.qty)}</span>
                      </td>
                      <td style={{padding:'10px 14px',textAlign:'right'}}>
                        <span style={{color:T.textSecondary,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{fmtN(p.txns)}</span>
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,justifyContent:'flex-end'}}>
                          <div style={{background:T.border,borderRadius:2,height:4,width:60,overflow:'hidden'}}>
                            <div style={{background:CAT_COLORS[p.cat]||T.accent,height:'100%',width:`${Math.min(100,parseFloat(pct)/(productRanking[0]?.qty/totalQty*100)*100)}%`}}/>
                          </div>
                          <span style={{color:T.textSecondary,fontFamily:"'JetBrains Mono',monospace",fontSize:11,width:36,textAlign:'right'}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {productRanking.length>50&&(
            <div style={{padding:'10px 14px',color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",borderTop:`1px solid ${T.border}`,textAlign:'center'}}>
              Mostrando top 50 de {fmtN(productRanking.length)} productos. Usa los filtros para segmentar.
            </div>
          )}
        </div>
      </div>

      {/* TAB: TINTAS & STOCK */}
      {tab==='tintas'   && <TabTintas  data={filtered} fmtN={fmtN}/>}
      {tab==='compras'  && <TabCompras  fmtN={fmtN}/>}
      {tab==='stock'    && <TabStock    data={filtered} fmtN={fmtN}/>}

    </div>
  );
}

function TabTintas({data, fmtN}) {
  const tintasRows = data.filter(r => r.color);
  const prodMap = {};
  tintasRows.forEach(r => {
    const k = r.code || r.desc;
    if (!prodMap[k]) prodMap[k] = {desc:r.desc, code:r.code, color:r.color,
      udsPorCaja:r.udsPorCaja, compat:r.compat, cajas:0, unidades:0};
    prodMap[k].cajas    += r.qty;
    prodMap[k].unidades += r.unidadesReales;
  });
  const prodList      = Object.values(prodMap).sort((a,b)=>b.unidades-a.unidades);
  const totalCajas    = prodList.reduce((s,p)=>s+p.cajas,0);
  const totalUnidades = prodList.reduce((s,p)=>s+p.unidades,0);
  const colorMap = {};
  tintasRows.forEach(r => {
    if (!r.color) return;
    if (!colorMap[r.color]) colorMap[r.color] = {cajas:0, unidades:0};
    colorMap[r.color].cajas    += r.qty;
    colorMap[r.color].unidades += r.unidadesReales;
  });
  const colorList = Object.entries(colorMap).map(([color,v])=>({color,...v})).sort((a,b)=>b.unidades-a.unidades);
  const maxUds = colorList[0]?.unidades || 1;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
        {[
          {label:'Total Cajas Vendidas',  val:fmtN(totalCajas),      sub:'unidad de compra al proveedor', col:T.accent},
          {label:'Total Unidades Reales', val:fmtN(totalUnidades),   sub:'unidades individuales vendidas', col:T.green},
          {label:'Productos de Tinta',    val:fmtN(prodList.length), sub:'SKUs distintos con color',       col:T.cyan},
        ].map(k=>(
          <div key={k.label} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
            <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{k.label.toUpperCase()}</div>
            <div style={{color:k.col,fontSize:26,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{k.val}</div>
            <div style={{color:T.textMuted,fontSize:10,marginTop:4,fontFamily:"'DM Sans',sans-serif"}}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'16px 18px'}}>
        <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:14,fontFamily:"'DM Sans',sans-serif"}}>ROTACION POR COLOR — CAJAS vs UNIDADES REALES</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {colorList.map((c,i)=>{
            const pct  = Math.round((c.unidades/totalUnidades)*100);
            const barW = Math.round((c.unidades/maxUds)*100);
            const hex  = COLOR_HEX[c.color] || T.accent;
            const tag  = i===0 ? {txt:'MAYOR ROTACION',col:T.green} : i===colorList.length-1 ? {txt:'MENOR ROTACION',col:T.red} : null;
            return (
              <div key={c.color} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:7,
                background: i===0?T.greenBg : i===colorList.length-1?T.redBg:'transparent',
                border: i===0?'1px solid rgba(52,211,153,0.2)' : i===colorList.length-1?'1px solid rgba(248,113,113,0.2)':`1px solid ${T.border}`}}>
                <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",width:16,textAlign:'right'}}>{i+1}</span>
                <div style={{width:10,height:10,borderRadius:'50%',background:hex,flexShrink:0}}/>
                <span style={{color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600,width:120,flexShrink:0}}>{c.color}</span>
                {tag && <span style={{fontSize:8,fontWeight:700,color:tag.col,background:`${tag.col}18`,padding:'2px 6px',borderRadius:3,fontFamily:"'DM Sans',sans-serif"}}>{tag.txt}</span>}
                <div style={{flex:1,background:T.border,borderRadius:2,height:6,overflow:'hidden'}}>
                  <div style={{background:hex,height:'100%',width:`${barW}%`,borderRadius:2,opacity:0.8}}/>
                </div>
                <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",width:50,textAlign:'right'}}>{fmtN(c.cajas)} cj</span>
                <span style={{color:hex,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:60,textAlign:'right'}}>{fmtN(c.unidades)} ud</span>
                <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace",width:32,textAlign:'right'}}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>DETALLE POR PRODUCTO — CAJAS vs UNIDADES REALES VENDIDAS</span>
          <span style={{marginLeft:'auto',color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{fmtN(prodList.length)} productos</span>
        </div>
        <div style={{overflowY:'auto',maxHeight:380}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:T.surface,position:'sticky',top:0}}>
                {['Producto','Color','Compatible','x Uds/Caja','Cajas Vendidas','Uds Reales','% Total'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                    letterSpacing:'0.08em',textAlign:['Producto','Color','Compatible'].includes(h)?'left':'right',
                    borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prodList.map((p,i)=>{
                const pct = ((p.unidades/totalUnidades)*100).toFixed(1);
                const hex = COLOR_HEX[p.color] || T.accent;
                return (
                  <tr key={p.code||p.desc} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                    <td style={{padding:'7px 12px',maxWidth:200}}>
                      <div style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.desc}</div>
                      <div style={{color:T.textMuted,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{p.code}</div>
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:7,height:7,borderRadius:'50%',background:hex}}/>
                        <span style={{color:hex,fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{p.color}</span>
                      </div>
                    </td>
                    <td style={{padding:'7px 12px'}}><span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{p.compat||'—'}</span></td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:p.udsPorCaja>1?T.cyan:T.textMuted,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:p.udsPorCaja>1?700:400}}>x{p.udsPorCaja}</span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:T.accent,fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700}}>{fmtN(p.cajas)}</span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:T.green,fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700}}>{fmtN(p.unidades)}</span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:T.textSecondary,fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>{pct}%</span>
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

// ── TAB COMPRAS ───────────────────────────────────────────────────────────────
function TabCompras({fmtN}) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catSel,  setCatSel]  = useState('TODAS');
  const [añoSel,  setAñoSel]  = useState('TODOS');
  const [buscar,  setBuscar]  = useState('');

  useEffect(()=>{
    fetch('/COMPRAS_SOL_CONTROL_2015_2026.csv')
      .then(r=>r.text())
      .then(txt=>{
        const lines = txt.trim().split('\n');
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(l=>{
          const vals = l.split(',');
          return headers.reduce((o,h,i)=>({...o,[h.trim()]:vals[i]?.trim()}),{});
        });
        setCompras(rows);
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  },[]);

  const años = useMemo(()=>['TODOS',...[...new Set(compras.map(r=>r.anio))].sort()],[compras]);
  const cats = useMemo(()=>['TODAS',...[...new Set(compras.map(r=>r.categoria))].sort()],[compras]);

  const filtered = useMemo(()=> compras.filter(r=>{
    if(catSel!=='TODAS' && r.categoria!==catSel) return false;
    if(añoSel!=='TODOS' && r.anio!==añoSel) return false;
    if(buscar && !r.producto?.toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  }),[compras,catSel,añoSel,buscar]);

  const totalFiltrado = filtered.reduce((s,r)=>s+parseInt(r.cantidad||0),0);

  // Gráfica por categoría
  const porCat = useMemo(()=>{
    const m={};
    filtered.forEach(r=>{ m[r.categoria]=(m[r.categoria]||0)+parseInt(r.cantidad||0); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([cat,cant])=>({cat,cant}));
  },[filtered]);

  // Gráfica por año
  const porAño = useMemo(()=>{
    const m={};
    filtered.forEach(r=>{ m[r.anio]=(m[r.anio]||0)+parseInt(r.cantidad||0); });
    return Object.entries(m).sort((a,b)=>a[0]-b[0]).map(([año,cant])=>({año,cant}));
  },[filtered]);

  const CAT_COLOR = {
    'TINTA':T.cyan,'PLOTTER SURECOLOR':T.accent,'IMPRESORA ECOTANK':T.green,
    'REPUESTO / MANTENIMIENTO':T.purple,'INSUMO / PAPEL':T.orange,
    'GARANTÍA EXTENDIDA':T.blue,'ACCESORIO / PERIFÉRICO':'#60a5fa',
    'UPS / ENERGÍA':T.red,
  };
  const catColor = cat => CAT_COLOR[cat]||T.textSecondary;

  if(loading) return (
    <div style={{textAlign:'center',padding:60,color:T.textMuted,fontFamily:"'DM Sans',sans-serif"}}>
      Cargando datos de compras...
    </div>
  );

  if(!compras.length) return (
    <div style={{background:T.card,border:`2px dashed ${T.border}`,borderRadius:10,padding:50,textAlign:'center'}}>
      <Package size={32} color={T.textMuted} style={{margin:'0 auto 12px'}}/>
      <div style={{color:T.textSecondary,fontSize:14,fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>
        Archivo no encontrado
      </div>
      <div style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
        Copiá <strong style={{color:T.accent}}>COMPRAS_SOL_CONTROL_2015_2026.csv</strong> a la carpeta <strong>public/</strong> del proyecto
      </div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* Filtros */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px',
        display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto..."
          style={{flex:1,minWidth:180,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,
            padding:'6px 10px',color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
        <select value={catSel} onChange={e=>setCatSel(e.target.value)}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 10px',
            color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={añoSel} onChange={e=>setAñoSel(e.target.value)}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 10px',
            color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
          {años.map(a=><option key={a}>{a}</option>)}
        </select>
        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>
          {fmtN(totalFiltrado)} uds en {filtered.length} reg.
        </span>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[
          {l:'TOTAL COMPRADO',   v:fmtN(compras.reduce((s,r)=>s+parseInt(r.cantidad||0),0))+' uds', c:T.accent},
          {l:'AÑOS CON DATOS',   v:[...new Set(compras.map(r=>r.anio))].length+' años', c:T.cyan},
          {l:'PRODUCTOS ÚNICOS', v:fmtN([...new Set(compras.map(r=>r.producto))].length)+' SKUs', c:T.green},
          {l:'EN FILTRO ACTUAL', v:fmtN(totalFiltrado)+' uds', c:T.purple},
        ].map(k=>(
          <div key={k.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px'}}>
            <div style={{color:T.textMuted,fontSize:8,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{k.l}</div>
            <div style={{color:k.c,fontSize:20,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Gráficas */}
      <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:12}}>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}>COMPRAS POR AÑO</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porAño} margin={{top:5,right:5,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
              <XAxis dataKey="año" tick={{fill:T.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:T.cardB,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11}}/>
              <Bar dataKey="cant" name="Unidades" fill={T.accent} radius={[4,4,0,0]} maxBarSize={32}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:12,fontFamily:"'DM Sans',sans-serif"}}>POR CATEGORÍA</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {porCat.slice(0,7).map(({cat,cant})=>{
              const pct = totalFiltrado>0 ? cant/totalFiltrado*100 : 0;
              return (
                <div key={cat} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{color:catColor(cat),fontSize:9,fontFamily:"'DM Sans',sans-serif",width:120,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat}</span>
                  <div style={{flex:1,background:T.border,borderRadius:2,height:5,overflow:'hidden'}}>
                    <div style={{background:catColor(cat),height:'100%',width:`${pct}%`}}/>
                  </div>
                  <span style={{color:catColor(cat),fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:40,textAlign:'right'}}>{fmtN(cant)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla detalle */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>DETALLE DE COMPRAS</span>
          <span style={{marginLeft:'auto',color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{filtered.length} registros</span>
        </div>
        <div style={{overflowY:'auto',maxHeight:360}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:T.surface,position:'sticky',top:0}}>
                {['Año','Producto','Cantidad','Categoría','Línea','Tipo'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                    letterSpacing:'0.08em',textAlign:['Cantidad'].includes(h)?'right':'left',
                    borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                  <td style={{padding:'6px 12px'}}><span style={{color:T.accent,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{r.anio}</span></td>
                  <td style={{padding:'6px 12px',maxWidth:240}}><span style={{color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{r.producto}</span></td>
                  <td style={{padding:'6px 12px',textAlign:'right'}}><span style={{color:T.green,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtN(parseInt(r.cantidad||0))}</span></td>
                  <td style={{padding:'6px 12px'}}><span style={{fontSize:9,fontWeight:700,color:catColor(r.categoria),background:`${catColor(r.categoria)}18`,padding:'2px 7px',borderRadius:3,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{r.categoria}</span></td>
                  <td style={{padding:'6px 12px'}}><span style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{r.linea}</span></td>
                  <td style={{padding:'6px 12px'}}><span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{r.tipo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── TAB STOCK & ROTACIÓN ──────────────────────────────────────────────────────
function TabStock({data, fmtN}) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar,  setBuscar]  = useState('');
  const [sortField, setSort]  = useState('stock');
  const [soloAlerta, setSoloAlerta] = useState(false);

  useEffect(()=>{
    fetch('/COMPRAS_SOL_CONTROL_2015_2026.csv')
      .then(r=>r.text())
      .then(txt=>{
        const lines=txt.trim().split('\n');
        const headers=lines[0].split(',');
        const rows=lines.slice(1).map(l=>{
          const vals=l.split(',');
          return headers.reduce((o,h,i)=>({...o,[h.trim()]:vals[i]?.trim()}),{});
        });
        setCompras(rows);
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  },[]);

  // Agrupar compras por producto
  const comprasPorProd = useMemo(()=>{
    const m={};
    compras.forEach(r=>{
      const k=r.producto;
      if(!m[k]) m[k]={producto:k,categoria:r.categoria,linea:r.linea,tipo:r.tipo,totalComprado:0};
      m[k].totalComprado += parseInt(r.cantidad||0);
    });
    return m;
  },[compras]);

  // Agrupar ventas por producto (del CSV de ventas ya cargado)
  const ventasPorProd = useMemo(()=>{
    const m={};
    data.forEach(r=>{
      const k=r.desc;
      if(!m[k]) m[k]=0;
      m[k]+=r.qty||0;
    });
    return m;
  },[data]);

  // Cruzar
  const cruce = useMemo(()=>{
    const prods = new Set([...Object.keys(comprasPorProd)]);
    return [...prods].map(prod=>{
      const c = comprasPorProd[prod]||{totalComprado:0};
      // Buscar ventas por nombre similar
      let vendido = 0;
      Object.entries(ventasPorProd).forEach(([desc,qty])=>{
        const d=desc.toUpperCase().replace(/\s+/g,' ').trim();
        const p=prod.toUpperCase().replace(/\s+/g,' ').trim();
        if(d===p || d.includes(p.substring(0,20)) || p.includes(d.substring(0,20))) {
          vendido=Math.max(vendido,qty);
        }
      });
      const stock = c.totalComprado - vendido;
      const rotacion = c.totalComprado>0 ? ((vendido/c.totalComprado)*100) : 0;
      return {
        producto: prod,
        categoria: c.categoria||'',
        linea: c.linea||'',
        tipo: c.tipo||'',
        comprado: c.totalComprado,
        vendido,
        stock,
        rotacion,
      };
    });
  },[comprasPorProd, ventasPorProd]);

  const filtered = useMemo(()=>{
    let r = cruce;
    if(buscar) r=r.filter(x=>x.producto.toLowerCase().includes(buscar.toLowerCase()));
    if(soloAlerta) r=r.filter(x=>x.stock<=0||x.rotacion>90);
    r=[...r].sort((a,b)=> sortField==='stock'?(a.stock-b.stock): sortField==='rotacion'?(b.rotacion-a.rotacion):(b.comprado-a.comprado));
    return r;
  },[cruce,buscar,sortField,soloAlerta]);

  const totalComprado = cruce.reduce((s,r)=>s+r.comprado,0);
  const totalVendido  = cruce.reduce((s,r)=>s+r.vendido,0);
  const sinStock      = cruce.filter(r=>r.stock<=0).length;
  const altaRotacion  = cruce.filter(r=>r.rotacion>=80).length;

  const stockColor = s => s<=0?T.red:s<=5?T.orange:T.green;
  const rotColor   = r => r>=90?T.red:r>=70?T.orange:T.green;

  if(loading||!compras.length) return (
    <div style={{background:T.card,border:`2px dashed ${T.border}`,borderRadius:10,padding:50,textAlign:'center'}}>
      <Package size={32} color={T.textMuted} style={{margin:'0 auto 12px'}}/>
      <div style={{color:T.textSecondary,fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>
        {loading?'Cargando...':'Archivo no encontrado'}
      </div>
      <div style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
        Copiá <strong style={{color:T.accent}}>COMPRAS_SOL_CONTROL_2015_2026.csv</strong> a la carpeta <strong>public/</strong>
      </div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[
          {l:'TOTAL COMPRADO',    v:fmtN(totalComprado)+' uds', c:T.accent},
          {l:'TOTAL VENDIDO',     v:fmtN(totalVendido)+' uds',  c:T.green},
          {l:'PRODUCTOS SIN STOCK', v:sinStock+' SKUs',          c:T.red},
          {l:'ALTA ROTACIÓN >80%',  v:altaRotacion+' SKUs',      c:T.orange},
        ].map(k=>(
          <div key={k.l} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 16px'}}>
            <div style={{color:T.textMuted,fontSize:8,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>{k.l}</div>
            <div style={{color:k.c,fontSize:20,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Aviso metodología */}
      <div style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:8,padding:'10px 14px',
        display:'flex',gap:8,alignItems:'flex-start'}}>
        <AlertTriangle size={13} color={T.accent} style={{flexShrink:0,marginTop:1}}/>
        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
          <strong style={{color:T.accent}}>Stock estimado:</strong> Compras registradas desde 2015 menos ventas del CSV (2024-2026). 
          No refleja devoluciones, mermas ni stock inicial previo a 2015. Usá como referencia de rotación, no como inventario exacto.
        </span>
      </div>

      {/* Filtros */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 14px',
        display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar producto..."
          style={{flex:1,minWidth:200,background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,
            padding:'6px 10px',color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}/>
        <select value={sortField} onChange={e=>setSort(e.target.value)}
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 10px',
            color:T.textPrimary,fontSize:12,outline:'none',fontFamily:"'DM Sans',sans-serif"}}>
          <option value="stock">Ordenar: Menor stock primero</option>
          <option value="rotacion">Ordenar: Mayor rotación primero</option>
          <option value="comprado">Ordenar: Mayor volumen primero</option>
        </select>
        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',color:T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
          <input type="checkbox" checked={soloAlerta} onChange={e=>setSoloAlerta(e.target.checked)}/>
          Solo alertas
        </label>
        <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{filtered.length} productos</span>
      </div>

      {/* Tabla stock */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{overflowY:'auto',maxHeight:440}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:T.surface,position:'sticky',top:0}}>
                {['Producto','Categoría','Comprado','Vendido','Stock Est.','Rotación %'].map(h=>(
                  <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,
                    letterSpacing:'0.08em',textAlign:['Comprado','Vendido','Stock Est.','Rotación %'].includes(h)?'right':'left',
                    borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r,i)=>{
                const sc=stockColor(r.stock); const rc=rotColor(r.rotacion);
                return (
                  <tr key={r.producto} style={{borderBottom:`1px solid ${T.border}`,background:r.stock<=0?T.redBg:i%2===0?'transparent':T.surface}}>
                    <td style={{padding:'7px 12px',maxWidth:240}}>
                      <div style={{color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.producto}</div>
                      <div style={{color:T.textMuted,fontSize:8,fontFamily:"'DM Sans',sans-serif"}}>{r.linea}</div>
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      <span style={{fontSize:8,fontWeight:700,color:T.textSecondary,background:`${T.textMuted}18`,padding:'2px 6px',borderRadius:3,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
                        {r.categoria?.split(' ')[0]||''}
                      </span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:T.accent,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtN(r.comprado)}</span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:r.vendido>0?T.green:T.textMuted,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{r.vendido>0?fmtN(r.vendido):'—'}</span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <span style={{color:sc,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                        {r.stock<=0?'AGOTADO':fmtN(r.stock)}
                      </span>
                    </td>
                    <td style={{padding:'7px 12px',textAlign:'right'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6}}>
                        <div style={{width:50,background:T.border,borderRadius:2,height:4,overflow:'hidden'}}>
                          <div style={{background:rc,height:'100%',width:`${Math.min(r.rotacion,100)}%`}}/>
                        </div>
                        <span style={{color:rc,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,width:36,textAlign:'right'}}>
                          {r.vendido>0?r.rotacion.toFixed(0)+'%':'—'}
                        </span>
                      </div>
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
