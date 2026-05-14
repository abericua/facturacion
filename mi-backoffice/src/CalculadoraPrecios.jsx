import { useState, useMemo, useRef } from "react";
import {
  DollarSign, Search, Plus, Download, Upload,
  Shield, Edit3, Check, X, AlertTriangle,
  Package, Copy, Eye, EyeOff, Settings, Lock
} from "lucide-react";

const T = {
  bg:'#07080f', surface:'#0d1117', card:'#111827', cardB:'#141d2e',
  border:'#1a2535', borderL:'#243045',
  accent:'#f59e0b', accentBg:'rgba(245,158,11,0.08)', accentBorder:'rgba(245,158,11,0.25)',
  cyan:'#22d3ee', cyanBg:'rgba(34,211,238,0.08)',
  green:'#34d399', greenBg:'rgba(52,211,153,0.08)',
  red:'#f87171', redBg:'rgba(248,113,113,0.08)',
  purple:'#a78bfa', purpleBg:'rgba(167,139,250,0.08)', blue:'#60a5fa',
  textPrimary:'#e2e8f0', textSecondary:'#7d9db5', textMuted:'#3d5470',
};

const CFG_DEFAULT = {
  buffer_piso:  150,
  buffer_techo: 350,
  comision_qr:  4.0,
  umbral_redondeo: 389000,
  margenes_linea: {
    'COMERCIAL':  30,
    'INDUSTRIAL': 24,
    'INSUMOS':    15,
    'ACCESORIOS': 30,
  },
  ajustes_rango: [
    { label:'Bajo (< $500)',         max:500,     ajuste:+5  },
    { label:'Medio ($500-$5.000)',   max:5000,    ajuste:0   },
    { label:'Alto (> $5.000)',       max:Infinity,ajuste:-4  },
  ],
  descuentos_volumen: [
    { label:'1 unidad',    min:1,  max:1,        dto:0  },
    { label:'2-4 unidades',min:2,  max:4,        dto:-2 },
    { label:'5-9 unidades',min:5,  max:9,        dto:-3 },
    { label:'10+ unidades',min:10, max:Infinity, dto:-5 },
  ],
};

function calcMargenFinal(costo, moneda, linea, unidades, cfg) {
  const base     = cfg.margenes_linea[linea?.toUpperCase()] ?? 30;
  const costoRef = moneda==='USD' ? costo : costo/7800;
  const rango    = cfg.ajustes_rango.find(r=>costoRef<r.max);
  const vol      = cfg.descuentos_volumen.find(v=>unidades>=v.min&&unidades<=v.max);
  const ajuste   = rango?.ajuste ?? 0;
  const dto      = vol?.dto ?? 0;
  return { base, ajuste, dto, final: Math.max(1, base + ajuste + dto) };
}

function redondeoGs(p) {
  if (p<=0) return 0;
  return p<=CFG_DEFAULT.umbral_redondeo
    ? Math.ceil(p/10000)*10000-1000
    : Math.round(p/100000)*100000-10000;
}
function redondeoUSD(p) {
  if (p<=0) return 0;
  return p<1000 ? Math.ceil(p/10)*10-1 : Math.ceil(p/100)*100-10;
}

function calcularPrecios(costo, moneda, usdMercado, margenPct, unidades=1) {
  if (!costo||costo<=0) return null;
  const bandaPiso = usdMercado + CFG_DEFAULT.buffer_piso;
  const m  = margenPct/100;
  const qr = CFG_DEFAULT.comision_qr/100;
  if (moneda==='USD') {
    const costoGs    = costo*bandaPiso;
    const contadoGs  = redondeoGs(costoGs/(1-m));
    const qrGs       = redondeoGs(contadoGs/(1-qr));
    const contadoUSD = redondeoUSD(costo/(1-m));
    const qrUSD      = redondeoUSD(contadoUSD/(1-qr));
    return {contado:contadoGs, qr:qrGs, contadoUSD, qrUSD, costoGs, bandaPiso};
  } else {
    const contado = redondeoGs(costo/(1-m));
    const qrP     = redondeoGs(contado/(1-qr));
    return {contado, qr:qrP, contadoUSD:0, qrUSD:0, costoGs:costo, bandaPiso};
  }
}

function parseCatalogCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep   = lines[0].includes(';') ? ';' : ',';
  const heads = lines[0].split(sep).map(h => h.trim().toUpperCase().replace(/["""]/g,''));

  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i]==='"') { inQ=!inQ; continue; }
      if (line[i]===sep[0] && !inQ) { vals.push(cur.trim()); cur=''; continue; }
      cur += line[i];
    }
    vals.push(cur.trim());

    const o = {};
    heads.forEach((h, i) => { o[h] = vals[i]?.replace(/["""]/g,'').trim() || ''; });
    const get = (...keys) => keys.map(k => o[k]).find(v => v) || '';

    const costoUnitario = parseFloat(get('COSTO_UNITARIO') || '0') || 0;
    const costoCaja     = parseFloat((get('COSTO_CAJA','COSTO') || '0').replace(/[^0-9.]/g,'')) || 0;
    const udsXCaja      = parseInt(get('UNIDADES_POR_CAJA') || '1') || 1;
    const esInsumo      = heads.includes('COSTO_UNITARIO') || heads.includes('UNIDADES_POR_CAJA');

    const costoVenta = costoUnitario > 0 ? costoUnitario
      : costoCaja > 0 ? Math.round(costoCaja / udsXCaja)
      : parseFloat((get('COSTO','P_COSTO','COSTO_USD') || '0').replace(/[^0-9.]/g,'')) || 0;

    return {
      codigo:        get('CODIGO','ID REF','ID','REF'),
      nombre:        get('NOMBRE_VENTA','NOMBRE_PRODUCTO','DESCRIPCIÓN / INSUMO','DESCRIPCION','NOMBRE'),
      nombreCaja:    get('NOMBRE_CAJA_COMPRA') || '',
      categoria:     get('CATEGORIA','TIPO'),
      compatibilidad:get('COMPATIBILIDAD') || '',
      linea:         get('LINEA_VENTA','LINEA','TIPO'),
      proveedor:     get('PROVEEDOR','PROV'),
      moneda:        get('MONEDA') || 'GS',
      costoCaja,
      udsXCaja,
      costoUnitario: costoUnitario > 0 ? costoUnitario : (costoCaja > 0 ? Math.round(costoCaja/udsXCaja) : 0),
      costo:         costoVenta,
      esInsumo,
      estado:        get('ESTADO') || 'ACTIVO',
      notas:         get('NOTAS','NOTA') || '',
    };
  }).filter(p => p.nombre && p.codigo);
}

function generateCode(prods, cat, lin) {
  const CM={'IMPRESORAS':'IMP','SURECOLOR':'SC','TINTAS/CONSUMIBLES':'TINTA',
    'BORDADORAS':'BRD','CORTADORAS':'CUT','PRENSAS':'PRENSA','GRABADORAS LASER':'GRAB',
    'EQUIPOS DTF':'DTF','ACCESORIOS':'ACC','COMBOS':'CMB','IMPORTACIONES':'IMPO','MAQUINAS DE COSER':'MAQCOS'};
  const LM={'COMERCIAL':'COM','INDUSTRIAL':'IND','INSUMOS':'INS','ACCESORIOS':'ACC'};
  const c=CM[cat?.toUpperCase()]||'PROD', l=LM[lin?.toUpperCase()]||'COM';
  const pfx=`${c}-${l}-`;
  const nums=prods.filter(p=>p.codigo?.startsWith(pfx)).map(p=>parseInt(p.codigo.replace(pfx,''))||0);
  return `${pfx}${String(nums.length>0?Math.max(...nums)+1:1).padStart(3,'0')}`;
}

const fmtGs  = n=>n>0?`₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n))}`:n===0?'₲ 0':'—';
const fmtUSD = n=>n>0?`$${new Intl.NumberFormat('es-PY').format(Math.round(n))} USD`:'';
const fmtRate= n=>`₲ ${new Intl.NumberFormat('es-PY').format(n)}`;
const fmtN   = n=>new Intl.NumberFormat('es-PY').format(n);
const fmtPct = n=>`${n>0?'+':''}${n}%`;

const LC={COMERCIAL:T.accent,INDUSTRIAL:T.blue,INSUMOS:T.green,ACCESORIOS:T.purple,IMPORTACIONES:T.red};
const CATS=['IMPRESORAS','SURECOLOR','TINTAS/CONSUMIBLES','BORDADORAS','CORTADORAS','PRENSAS','GRABADORAS LASER','EQUIPOS DTF','ACCESORIOS','COMBOS','IMPORTACIONES','MAQUINAS DE COSER'];
const LINS=['COMERCIAL','INDUSTRIAL','INSUMOS','ACCESORIOS'];
const PROVS=['Sol Control','Todo Costura','Importacion SOLPRO','Otro'];

const SL=({children})=><div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:4,fontFamily:"'DM Sans',sans-serif"}}>{children}</div>;

const CopyBtn=({value})=>{
  const [ok,setOk]=useState(false);
  return(
    <button onClick={()=>{navigator.clipboard?.writeText(String(Math.round(value)));setOk(true);setTimeout(()=>setOk(false),1500);}}
      style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'2px 6px',
        color:ok?T.green:T.textMuted,fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',
        gap:2,fontFamily:"'DM Sans',sans-serif"}}>
      {ok?<Check size={8}/>:<Copy size={8}/>}{ok?'OK':''}
    </button>
  );
};

function VistVendedor({precios, nombre, codigo, linea, unidades}) {
  const lc=LC[linea]||T.accent;
  return(
    <div style={{background:T.card,border:`1px solid ${lc}40`,borderRadius:12,overflow:'hidden'}}>
      <div style={{background:`${lc}12`,borderBottom:`1px solid ${lc}30`,padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
          <Lock size={11} color={lc}/>
          <span style={{color:lc,fontSize:9,fontWeight:700,letterSpacing:'0.12em',fontFamily:"'DM Sans',sans-serif"}}>PRECIO OFICIAL SOLPRO</span>
        </div>
        <div style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",lineHeight:1.3,marginBottom:2}}>{nombre}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{color:T.textMuted,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{codigo}</span>
          <span style={{fontSize:8,fontWeight:700,color:lc,background:`${lc}18`,padding:'2px 7px',borderRadius:3,fontFamily:"'DM Sans',sans-serif"}}>{linea}</span>
          {unidades>1&&<span style={{fontSize:8,fontWeight:700,color:T.purple,background:`${T.purple}18`,padding:'2px 7px',borderRadius:3,fontFamily:"'DM Sans',sans-serif"}}>x{unidades} uds.</span>}
        </div>
      </div>
      <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
        <div style={{background:T.greenBg,border:'1px solid rgba(52,211,153,0.3)',borderRadius:9,padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:T.green,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>PRECIO CONTADO</span>
            <CopyBtn value={precios.contado}/>
          </div>
          <div style={{color:T.green,fontSize:28,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{fmtGs(precios.contado)}</div>
          {precios.contadoUSD>0&&<div style={{color:T.textMuted,fontSize:10,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{fmtUSD(precios.contadoUSD)}</div>}
          <div style={{color:T.textMuted,fontSize:10,marginTop:5,fontFamily:"'DM Sans',sans-serif"}}>Efectivo · Transferencia bancaria inmediata</div>
        </div>
        <div style={{background:T.purpleBg,border:'1px solid rgba(167,139,250,0.3)',borderRadius:9,padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:T.purple,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>PRECIO DIGITAL QR</span>
            <CopyBtn value={precios.qr}/>
          </div>
          <div style={{color:T.purple,fontSize:28,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{fmtGs(precios.qr)}</div>
          {precios.qrUSD>0&&<div style={{color:T.textMuted,fontSize:10,marginTop:3,fontFamily:"'JetBrains Mono',monospace"}}>{fmtUSD(precios.qrUSD)}</div>}
          <div style={{color:T.textMuted,fontSize:10,marginTop:5,fontFamily:"'DM Sans',sans-serif"}}>Billeteras · UPAY · Tarjetas · Apps bancarias</div>
        </div>
        <div style={{background:T.accentBg,border:`1px solid ${T.accentBorder}`,borderRadius:7,padding:'8px 12px',display:'flex',alignItems:'flex-start',gap:7}}>
          <Shield size={11} color={T.accent} style={{flexShrink:0,marginTop:1}}/>
          <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5}}>
            <span style={{color:T.accent,fontWeight:700}}>Politica Solpro v5.0: </span>
            {linea==='COMERCIAL'||linea==='INSUMOS'?'CREDITO BLOQUEADO en esta linea. Solo Contado o QR.':'Credito disponible solo para linea Industrial con aprobacion.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function VistaAdmin({precios, margenInfo, costo, moneda, linea, unidades, cfg, producto}) {
  const bp       = precios.bandaPiso;
  const costoGs  = moneda==='USD' ? costo*bp : costo;
  const pBruto   = costoGs/(1-margenInfo.final/100);
  const ganancia = precios.contado - costoGs;
  const pctReal  = precios.contado>0 ? ((ganancia/precios.contado)*100).toFixed(1) : 0;
  const esIns    = producto?.esInsumo && producto?.udsXCaja > 1;

  const rows = [
    esIns && {label:`Costo CAJA (${producto.udsXCaja} uds.)`, val: moneda==='GS'?`₲ ${new Intl.NumberFormat('es-PY').format(producto.costoCaja)}`:`$${producto.costoCaja} USD`, color:T.textMuted},
    esIns && {label:`Costo UNITARIO (div.${producto.udsXCaja})`, val: moneda==='GS'?`₲ ${new Intl.NumberFormat('es-PY').format(costo)}`:`$${costo} USD`, color:T.cyan, bold:true},
    !esIns && {label:'Costo adquisicion', val: moneda==='USD'?`$${costo} USD`:`₲ ${new Intl.NumberFormat('es-PY').format(costo)}`, color:T.textSecondary},
    moneda==='USD' && {label:`En guaranies (x Banda Piso ${new Intl.NumberFormat('es-PY').format(bp)})`, val:`₲ ${new Intl.NumberFormat('es-PY').format(Math.round(costoGs))}`, color:T.textSecondary},
    {label:'Margen base linea',      val:`${margenInfo.base}%`,  color:T.textMuted},
    {label:'Ajuste rango precio',    val:`${margenInfo.ajuste>0?'+':''}${margenInfo.ajuste}%`, color:margenInfo.ajuste>0?T.green:margenInfo.ajuste<0?T.red:T.textMuted},
    {label:'Descuento volumen',      val:`${margenInfo.dto>0?'+':''}${margenInfo.dto}%`, color:margenInfo.dto<0?T.accent:T.textMuted},
    {label:'Margen real final',      val:`${margenInfo.final}%`, color:T.accent, bold:true},
    {label:'Precio bruto calculado', val:`₲ ${new Intl.NumberFormat('es-PY').format(Math.round(pBruto))}`, color:T.textMuted},
    {label:'P. Contado (redondeado)',val:`₲ ${new Intl.NumberFormat('es-PY').format(precios.contado)}`, color:T.green, bold:true},
    {label:'Recargo QR +4%',         val:`₲ ${new Intl.NumberFormat('es-PY').format(precios.qr-precios.contado)}`, color:T.textMuted},
    {label:'P. QR (redondeado)',     val:`₲ ${new Intl.NumberFormat('es-PY').format(precios.qr)}`, color:T.purple, bold:true},
    {label:'Ganancia bruta / ud.',   val:`₲ ${new Intl.NumberFormat('es-PY').format(Math.round(ganancia))}`, color:T.green},
    {label:'Margen real verificado', val:`${pctReal}% (ganancia / precio venta)`, color:T.green},
  ].filter(Boolean);

  return (
    <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
      <div style={{background:T.surface,padding:'9px 14px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:6}}>
        <Settings size={11} color={T.textMuted}/>
        <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>DESGLOSE ADMINISTRATIVO — CONFIDENCIAL</span>
        {esIns && (
          <span style={{marginLeft:'auto',color:T.cyan,fontSize:9,fontWeight:700,background:T.cyanBg,padding:'2px 7px',borderRadius:3,fontFamily:"'DM Sans',sans-serif"}}>
            UC: Caja x{producto.udsXCaja} · UV: 1 unidad
          </span>
        )}
      </div>
      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:0}}>
        {rows.map((r,i)=>(
          <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'5px 0',borderBottom:i<rows.length-1?`1px solid ${T.border}`:'none',
            background:r.bold?`${r.color}08`:'transparent'}}>
            <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:r.bold?600:400,paddingLeft:r.bold?4:0}}>{r.label}</span>
            <span style={{color:r.color,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:r.bold?700:500}}>{r.val}</span>
          </div>
        ))}
      </div>
      {esIns && (
        <div style={{padding:'9px 14px',borderTop:`1px solid ${T.border}`,background:T.cyanBg,display:'flex',alignItems:'center',gap:6}}>
          <span style={{color:T.cyan,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
            Logica UC/UV: Compras caja x{producto.udsXCaja} — Vendes por unidad individual. Precio calculado sobre costo unitario (₲ {new Intl.NumberFormat('es-PY').format(costo)}).
          </span>
        </div>
      )}
    </div>
  );
}

function PanelConfig({cfg, setCfg}) {
  const [tmp, setTmp]=useState(JSON.parse(JSON.stringify(cfg)));
  const save=()=>setCfg(tmp);
  const reset=()=>setTmp(JSON.parse(JSON.stringify(cfg)));

  const NI=({val,onChange,suffix,w=55})=>(
    <div style={{display:'flex',alignItems:'center',gap:3}}>
      <input type="number" value={val} onChange={e=>onChange(parseFloat(e.target.value)||0)}
        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:4,padding:'3px 6px',
          color:T.textPrimary,fontSize:12,fontFamily:"'JetBrains Mono',monospace",width:w,outline:'none',textAlign:'right'}}/>
      {suffix&&<span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{suffix}</span>}
    </div>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
        <SL>MARGENES BASE POR LINEA (margen real = ganancia / precio venta)</SL>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
          {Object.entries(tmp.margenes_linea).map(([linea,val])=>(
            <div key={linea} style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:LC[linea]||T.textSecondary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600,width:100,flexShrink:0}}>{linea}</span>
              <NI val={val} suffix="% margen real" onChange={v=>setTmp(p=>({...p,margenes_linea:{...p.margenes_linea,[linea]:v}}))}/>
              <div style={{flex:1,background:T.border,borderRadius:2,height:4,overflow:'hidden'}}>
                <div style={{background:LC[linea]||T.accent,height:'100%',width:`${val}%`,borderRadius:2}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
        <SL>AJUSTE POR RANGO DE PRECIO (sobre margen base)</SL>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
          {tmp.ajustes_rango.map((r,i)=>(
            <div key={r.label} style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif",flex:1}}>{r.label}</span>
              <NI val={r.ajuste} suffix="% ajuste" onChange={v=>setTmp(p=>{const a=[...p.ajustes_rango];a[i]={...a[i],ajuste:v};return{...p,ajustes_rango:a};})}/>
              <span style={{color:r.ajuste>0?T.green:r.ajuste<0?T.red:T.textMuted,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,width:32,textAlign:'right'}}>
                {r.ajuste>0?'+':''}{r.ajuste}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'14px 16px'}}>
        <SL>DESCUENTO POR VOLUMEN (cliente absorbe el beneficio)</SL>
        <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:8}}>
          {tmp.descuentos_volumen.map((d,i)=>(
            <div key={d.label} style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif",flex:1}}>{d.label}</span>
              <NI val={d.dto} suffix="% descuento" onChange={v=>setTmp(p=>{const a=[...p.descuentos_volumen];a[i]={...a[i],dto:v};return{...p,descuentos_volumen:a};})}/>
              <span style={{color:d.dto<0?T.accent:T.textMuted,fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,width:32,textAlign:'right'}}>
                {d.dto>0?'+':''}{d.dto}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={save} style={{flex:1,background:T.greenBg,border:'1px solid rgba(52,211,153,0.35)',
          borderRadius:7,padding:'9px',color:T.green,fontSize:12,fontWeight:700,cursor:'pointer',
          fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
          <Check size={13}/> Guardar Configuracion
        </button>
        <button onClick={reset} style={{background:'transparent',border:`1px solid ${T.border}`,
          borderRadius:7,padding:'9px 14px',color:T.textMuted,fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
          Resetear
        </button>
      </div>
    </div>
  );
}

export default function CalculadoraPrecios() {
  const [usdMercado,setUsdMercado]=useState(7650);
  const [editUsd,   setEditUsd]   =useState(false);
  const [tempUsd,   setTempUsd]   =useState('7650');
  const [cfg,       setCfg]       =useState(CFG_DEFAULT);
  const [productos, setProductos] =useState(()=>{
    try{const s=localStorage.getItem('solpro_catalogo_v1');return s?JSON.parse(s):[];}catch{return [];}
  });
  const [selected,  setSelected]  =useState(null);
  const [editCosto, setEditCosto] =useState(false);
  const [tempCosto, setTempCosto] =useState('');
  const [unidades,  setUnidades]  =useState(1);
  const [vistaAdm,  setVistaAdm]  =useState(false);
  const [showConfig,setShowConfig]=useState(false);
  const [showNew,   setShowNew]   =useState(false);
  const [search,    setSearch]    =useState('');
  const [lineaF,    setLineaF]    =useState('Todos');
  const [newProd,   setNewProd]   =useState({nombre:'',categoria:'IMPRESORAS',linea:'COMERCIAL',proveedor:'Sol Control',moneda:'USD',costo:'',notas:''});
  const fileRef=useRef(null);

  const bandaPiso  = usdMercado + cfg.buffer_piso;
  const bandaTecho = usdMercado + cfg.buffer_techo;

  const margenInfo    = useMemo(()=>selected?calcMargenFinal(selected.costo,selected.moneda,selected.linea,unidades,cfg):null,[selected,unidades,cfg]);
  const precios       = useMemo(()=>selected&&margenInfo?calcularPrecios(selected.costo,selected.moneda,usdMercado,margenInfo.final,unidades):null,[selected,margenInfo,usdMercado,unidades]);
  const margenInfoNew = useMemo(()=>calcMargenFinal(parseFloat(newProd.costo)||0,newProd.moneda,newProd.linea,1,cfg),[newProd,cfg]);
  const preciosNew    = useMemo(()=>{const c=parseFloat(newProd.costo);return c>0?calcularPrecios(c,newProd.moneda,usdMercado,margenInfoNew.final,1):null;},[newProd,usdMercado,margenInfoNew]);
  const lineas        = [' Todos',...([...new Set(productos.map(p=>p.linea).filter(Boolean))].sort())];
  const filtered      = useMemo(()=>productos.filter(p=>{
    const fl=lineaF===' Todos'||p.linea===lineaF;
    const fs=!search||p.nombre.toLowerCase().includes(search.toLowerCase())||p.codigo.toLowerCase().includes(search.toLowerCase());
    return fl&&fs;
  }),[productos,lineaF,search]);

  const handleCSV=e=>{
    const file=e.target.files[0]; if(!file) return;
    const r=new FileReader();
    r.onload=ev=>{const p=parseCatalogCSV(ev.target.result);if(p.length>0){setProductos(p);try{localStorage.setItem('solpro_catalogo_v1',JSON.stringify(p));}catch{}alert(`${p.length} productos cargados y guardados.`);}else alert('Formato no reconocido.');};
    r.readAsText(file,'UTF-8'); e.target.value='';
  };

  const exportCSV=()=>{
    if(!productos.length) return;
    const cols=['CODIGO','NOMBRE_PRODUCTO','LINEA_VENTA','MONEDA','COSTO','MARGEN_FINAL_%','P_CONTADO_GS','P_DIGITAL_QR_GS'];
    const rows=[cols.join(';'),...productos.map(p=>{
      const mi=calcMargenFinal(p.costo,p.moneda,p.linea,1,cfg);
      const pr=p.costo>0?calcularPrecios(p.costo,p.moneda,usdMercado,mi.final,1):null;
      return[p.codigo,`"${p.nombre}"`,p.linea,p.moneda,p.costo,mi.final,pr?.contado||0,pr?.qr||0].join(';');
    })];
    const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`SOLPRO_PRECIOS_USD${usdMercado}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const addProduct=()=>{
    if(!newProd.nombre||!newProd.costo) return alert('Completa nombre y costo.');
    const codigo=generateCode(productos,newProd.categoria,newProd.linea);
    const prod={...newProd,codigo,costo:parseFloat(newProd.costo)||0,estado:'ACTIVO'};
    setProductos(prev=>{const n=[...prev,prod];try{localStorage.setItem('solpro_catalogo_v1',JSON.stringify(n));}catch{}return n;});
    setSelected(prod);
    setShowNew(false);
    setNewProd({nombre:'',categoria:'IMPRESORAS',linea:'COMERCIAL',proveedor:'Sol Control',moneda:'USD',costo:'',notas:''});
  };

  const updateCosto=()=>{
    const updated={...selected,costo:parseFloat(tempCosto)||0};
    setSelected(updated);
    setProductos(prev=>{const n=prev.map(p=>p.codigo===selected.codigo?updated:p);try{localStorage.setItem('solpro_catalogo_v1',JSON.stringify(n));}catch{}return n;});
    setEditCosto(false);
  };

  const Btn=({label,Icon,onClick,col='accent',active})=>{
    const c=col==='green'?T.green:col==='red'?T.red:col==='cyan'?T.cyan:col==='purple'?T.purple:T.accent;
    const bg=active?`${c}25`:col==='green'?T.greenBg:col==='red'?T.redBg:col==='cyan'?T.cyanBg:T.accentBg;
    const bd=active?c:col==='green'?'rgba(52,211,153,0.3)':col==='red'?'rgba(248,113,113,0.3)':col==='cyan'?'rgba(34,211,238,0.3)':T.accentBorder;
    return(
      <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 13px',
        borderRadius:6,border:`1px solid ${bd}`,background:bg,color:c,fontSize:11,
        fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>
        {Icon&&<Icon size={12}/>}{label}
      </button>
    );
  };

  const SS=({label,value,onChange,options})=>(
    <div style={{display:'flex',flexDirection:'column',gap:4,flex:1,minWidth:0}}>
      {label&&<SL>{label}</SL>}
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:6,
          padding:'7px 10px',color:T.textPrimary,fontSize:12,outline:'none',cursor:'pointer',
          fontFamily:"'DM Sans',sans-serif"}}>
        {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
    </div>
  );

  const SI=({label,value,onChange,type='text',placeholder,readOnly,mono})=>(
    <div style={{display:'flex',flexDirection:'column',gap:4,flex:1,minWidth:0}}>
      {label&&<SL>{label}</SL>}
      <input type={type} value={value} onChange={onChange?e=>onChange(e.target.value):undefined}
        placeholder={placeholder} readOnly={readOnly}
        style={{background:readOnly?T.surface:T.card,border:`1px solid ${T.border}`,borderRadius:6,
          padding:'7px 10px',color:readOnly?T.textSecondary:T.textPrimary,fontSize:12,
          fontFamily:mono?"'JetBrains Mono',monospace":"'DM Sans',sans-serif",
          outline:'none',width:'100%',boxSizing:'border-box'}}/>
    </div>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;} input::placeholder{color:#3d5470;} select option{background:#111827;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#0d1117;} ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:2px;}
      `}</style>

      {/* BANDAS */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'13px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
          <Shield size={12} color={T.accent}/>
          <span style={{color:T.accent,fontSize:9,fontWeight:700,letterSpacing:'0.12em',fontFamily:"'DM Sans',sans-serif"}}>MOTOR DE PRECIOS SOLPRO v5.0 — MARGEN REAL DINAMICO</span>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 13px',minWidth:155}}>
            <SL>USD MERCADO HOY</SL>
            {editUsd?(
              <div style={{display:'flex',gap:5,alignItems:'center'}}>
                <input value={tempUsd} onChange={e=>setTempUsd(e.target.value)} autoFocus
                  style={{background:T.card,border:`1px solid ${T.accent}`,borderRadius:5,padding:'4px 7px',
                    color:T.textPrimary,fontSize:15,fontFamily:"'JetBrains Mono',monospace",width:80,outline:'none',fontWeight:700}}/>
                <button onClick={()=>{setUsdMercado(parseInt(tempUsd.replace(/\D/g,''))||7650);setEditUsd(false);}}
                  style={{background:T.green,border:'none',borderRadius:4,padding:'4px 8px',color:'#000',fontSize:10,fontWeight:700,cursor:'pointer'}}>OK</button>
                <button onClick={()=>setEditUsd(false)}
                  style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'4px 7px',color:T.textMuted,cursor:'pointer',fontSize:10}}>X</button>
              </div>
            ):(
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{color:T.textPrimary,fontSize:18,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtRate(usdMercado)}</span>
                <button onClick={()=>{setTempUsd(String(usdMercado));setEditUsd(true);}}
                  style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'2px 6px',
                    color:T.textMuted,fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',gap:2}}>
                  <Edit3 size={8}/> Editar
                </button>
              </div>
            )}
          </div>
          <div style={{background:'rgba(52,211,153,0.05)',border:'1px solid rgba(52,211,153,0.28)',borderRadius:8,padding:'10px 13px',flex:1,minWidth:120}}>
            <div style={{display:'flex',alignItems:'center',gap:3,marginBottom:3}}><div style={{width:6,height:6,borderRadius:'50%',background:T.green}}/><SL>BANDA PISO +{cfg.buffer_piso}</SL></div>
            <div style={{color:T.green,fontSize:17,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtRate(bandaPiso)}</div>
            <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>Base costos · Contado / QR</div>
          </div>
          <div style={{background:'rgba(96,165,250,0.05)',border:'1px solid rgba(96,165,250,0.28)',borderRadius:8,padding:'10px 13px',flex:1,minWidth:120}}>
            <div style={{display:'flex',alignItems:'center',gap:3,marginBottom:3}}><div style={{width:6,height:6,borderRadius:'50%',background:T.blue}}/><SL>BANDA TECHO +{cfg.buffer_techo}</SL></div>
            <div style={{color:T.blue,fontSize:17,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtRate(bandaTecho)}</div>
            <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:1}}>Solo credito industrial</div>
          </div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 13px',flex:1.3,minWidth:160}}>
            <SL>FORMULA — MARGEN REAL</SL>
            <div style={{color:T.textSecondary,fontSize:10,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.9}}>
              <span style={{color:T.cyan}}>PV = Costo / (1 - Margen%)</span><br/>
              <span style={{color:T.accent}}>Margen% = Base + Rango + Volumen</span><br/>
              <span style={{color:T.purple}}>QR = PV Contado / (1 - 4%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <Btn label="Cargar CSV" Icon={Upload} onClick={()=>fileRef.current?.click()} col="cyan"/>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{display:'none'}}/>
        <Btn label="Exportar Precios" Icon={Download} onClick={exportCSV} col="green"/>
        <Btn label="Nuevo Producto" Icon={Plus} onClick={()=>setShowNew(!showNew)}/>
        <Btn label="Configurar Margenes" Icon={Settings} onClick={()=>setShowConfig(!showConfig)} active={showConfig} col="purple"/>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,
          background:T.card,border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 11px'}}>
          <Search size={12} color={T.textMuted}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto..."
            style={{background:'transparent',border:'none',outline:'none',color:T.textPrimary,fontSize:12,width:170,fontFamily:"'DM Sans',sans-serif"}}/>
        </div>
        {productos.length>0&&<span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}><span style={{color:T.accent,fontWeight:700}}>{fmtN(productos.length)}</span> productos</span>}
      </div>

      {showConfig&&<PanelConfig cfg={cfg} setCfg={c=>{setCfg(c);setShowConfig(false);}}/>}

      {showNew&&(
        <div style={{background:T.card,border:`1px solid ${T.accentBorder}`,borderRadius:10,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:11}}>
            <h2 style={{color:T.textPrimary,fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif"}}>Nuevo Producto</h2>
            <button onClick={()=>setShowNew(false)} style={{background:T.redBg,border:'1px solid rgba(248,113,113,0.3)',
              borderRadius:5,padding:'3px 8px',color:T.red,fontSize:9,fontWeight:700,cursor:'pointer'}}>Cerrar</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div style={{gridColumn:'span 2'}}><SI label="Nombre del Producto" value={newProd.nombre} onChange={v=>setNewProd(p=>({...p,nombre:v}))} placeholder="Nombre completo del producto"/></div>
            <SS label="Categoria" value={newProd.categoria} onChange={v=>setNewProd(p=>({...p,categoria:v}))} options={CATS.map(c=>({value:c,label:c}))}/>
            <SS label="Linea de Venta" value={newProd.linea} onChange={v=>setNewProd(p=>({...p,linea:v}))} options={LINS.map(l=>({value:l,label:l}))}/>
            <SS label="Proveedor" value={newProd.proveedor} onChange={v=>setNewProd(p=>({...p,proveedor:v}))} options={PROVS.map(pr=>({value:pr,label:pr}))}/>
            <SS label="Moneda del Costo" value={newProd.moneda} onChange={v=>setNewProd(p=>({...p,moneda:v}))} options={[{value:'USD',label:'USD Dolares'},{value:'GS',label:'GS Guaranies'}]}/>
            <SI label={`Costo en ${newProd.moneda}`} type="number" value={newProd.costo} onChange={v=>setNewProd(p=>({...p,costo:v}))} placeholder="0" mono/>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'7px 10px'}}>
              <SL>CODIGO AUTOMATICO</SL>
              <span style={{color:T.accent,fontSize:14,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{generateCode(productos,newProd.categoria,newProd.linea)}</span>
            </div>
          </div>
          {preciosNew&&(
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <div style={{flex:1,background:T.greenBg,border:'1px solid rgba(52,211,153,0.3)',borderRadius:8,padding:'10px 12px'}}>
                <SL>PRECIO CONTADO</SL>
                <div style={{color:T.green,fontSize:18,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(preciosNew.contado)}</div>
              </div>
              <div style={{flex:1,background:T.purpleBg,border:'1px solid rgba(167,139,250,0.3)',borderRadius:8,padding:'10px 12px'}}>
                <SL>PRECIO QR</SL>
                <div style={{color:T.purple,fontSize:18,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{fmtGs(preciosNew.qr)}</div>
              </div>
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 12px'}}>
                <SL>MARGEN FINAL</SL>
                <div style={{color:T.accent,fontSize:18,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{margenInfoNew.final}%</div>
                <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>Real (g/pv)</div>
              </div>
            </div>
          )}
          <button onClick={addProduct} style={{width:'100%',background:T.greenBg,border:'1px solid rgba(52,211,153,0.35)',
            borderRadius:7,padding:'9px',color:T.green,fontSize:12,fontWeight:700,cursor:'pointer',
            fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
            <Plus size={13}/> Agregar al Catalogo
          </button>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:12,alignItems:'start'}}>
        <div>
          {productos.length>0&&(
            <div style={{display:'flex',gap:5,marginBottom:9,flexWrap:'wrap'}}>
              {lineas.map(l=>{
                const key=l.trim();
                const lc=LC[key]||T.textMuted;
                const act=lineaF===l;
                return(
                  <button key={l} onClick={()=>setLineaF(l)} style={{
                    padding:'3px 9px',borderRadius:4,fontSize:9,fontWeight:700,cursor:'pointer',
                    fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap',
                    border:`1px solid ${act?(key==='Todos'?T.accent:lc):T.border}`,
                    background:act?`${key==='Todos'?T.accent:lc}15`:'transparent',
                    color:act?(key==='Todos'?T.accent:lc):T.textSecondary}}>
                    {l.trim()}
                  </button>
                );
              })}
            </div>
          )}
          {productos.length===0?(
            <div style={{background:T.card,border:`2px dashed ${T.border}`,borderRadius:10,padding:'40px 20px',textAlign:'center'}}>
              <Upload size={28} color={T.textMuted} style={{margin:'0 auto 10px'}}/>
              <p style={{color:T.textSecondary,fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>Carga el catalogo CSV para comenzar</p>
              <p style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>
                Usa: <span style={{color:T.accent,fontFamily:"'JetBrains Mono',monospace"}}>CATALOGO_SOLPRO_UNIFICADO_2026.csv</span> o <span style={{color:T.cyan,fontFamily:"'JetBrains Mono',monospace"}}>INSUMOS_TINTAS_SOLPRO_2026.csv</span>
              </p>
              <button onClick={()=>fileRef.current?.click()} style={{background:T.cyanBg,border:'1px solid rgba(34,211,238,0.35)',
                borderRadius:6,padding:'7px 14px',color:T.cyan,fontSize:11,fontWeight:700,cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:5,margin:'0 auto'}}>
                <Upload size={12}/> Cargar CSV
              </button>
            </div>
          ):(
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden',maxHeight:540,overflowY:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:T.surface,position:'sticky',top:0,zIndex:1}}>
                    {['Codigo','Producto','Linea','Mon.','Costo','P.Contado','Margen'].map(h=>(
                      <th key={h} style={{padding:'8px 10px',color:T.textMuted,fontSize:9,fontWeight:700,
                        letterSpacing:'0.08em',textAlign:'left',borderBottom:`1px solid ${T.border}`,
                        fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p=>{
                    const mi=calcMargenFinal(p.costo,p.moneda,p.linea,1,cfg);
                    const pr=p.costo>0?calcularPrecios(p.costo,p.moneda,usdMercado,mi.final,1):null;
                    const sel=selected?.codigo===p.codigo;
                    const lc=LC[p.linea]||T.textMuted;
                    return(
                      <tr key={p.codigo} onClick={()=>{setSelected(p);setUnidades(1);setEditCosto(false);}}
                        style={{borderBottom:`1px solid ${T.border}`,cursor:'pointer',
                          background:sel?T.accentBg:'transparent',transition:'background 0.1s'}}>
                        <td style={{padding:'7px 10px'}}><span style={{color:sel?T.accent:T.textMuted,fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:sel?700:400}}>{p.codigo}</span></td>
                        <td style={{padding:'7px 10px',maxWidth:170}}>
                          <div style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nombre}</div>
                        </td>
                        <td style={{padding:'7px 10px'}}><span style={{fontSize:8,fontWeight:700,color:lc,background:`${lc}15`,padding:'2px 5px',borderRadius:3,fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>{p.linea}</span></td>
                        <td style={{padding:'7px 10px'}}><span style={{color:p.moneda==='USD'?T.blue:T.green,fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:600}}>{p.moneda}</span></td>
                        <td style={{padding:'7px 10px'}}><span style={{color:p.costo>0?T.textSecondary:T.red,fontFamily:"'JetBrains Mono',monospace",fontSize:9}}>{p.costo>0?(p.moneda==='USD'?`$${p.costo}`:`₲${fmtN(p.costo)}`):'—'}</span></td>
                        <td style={{padding:'7px 10px'}}><span style={{color:pr?.contado>0?T.green:T.textMuted,fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:700}}>{pr?.contado>0?fmtGs(pr.contado):'Sin costo'}</span></td>
                        <td style={{padding:'7px 10px'}}><span style={{color:T.accent,fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:600}}>{mi.final}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length===0&&<div style={{padding:'20px',textAlign:'center',color:T.textMuted,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>No se encontraron productos.</div>}
            </div>
          )}
        </div>

        {selected?(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <SL>COSTO DE ADQUISICION</SL>
                {selected.esInsumo && selected.udsXCaja > 1 && (
                  <div style={{background:T.cyanBg,border:'1px solid rgba(34,211,238,0.25)',borderRadius:6,
                    padding:'7px 10px',marginBottom:8,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{color:T.cyan,fontSize:9,fontWeight:700,fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.08em'}}>LOGICA UC/UV</span>
                    <span style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
                      Compras: <span style={{color:T.textPrimary,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>Caja x{selected.udsXCaja}</span>
                    </span>
                    <span style={{color:T.textMuted,fontSize:10}}>→</span>
                    <span style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
                      Vendes: <span style={{color:T.green,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>1 unidad</span>
                    </span>
                    {selected.costoCaja > 0 && (
                      <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
                        Caja: <span style={{color:T.textSecondary,fontFamily:"'JetBrains Mono',monospace"}}>
                          {selected.moneda==='GS'?`₲ ${fmtN(selected.costoCaja)}`:`$${selected.costoCaja}`}
                        </span>
                      </span>
                    )}
                  </div>
                )}
                {selected.compatibilidad && (
                  <div style={{marginBottom:6}}>
                    <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>Compatible con: </span>
                    <span style={{color:T.accent,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{selected.compatibilidad}</span>
                  </div>
                )}
                {selected.nombreCaja && (
                  <div style={{marginBottom:8}}>
                    <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>Descripcion caja compra: </span>
                    <span style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",fontStyle:'italic'}}>{selected.nombreCaja}</span>
                  </div>
                )}
                {editCosto?(
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="number" value={tempCosto} onChange={e=>setTempCosto(e.target.value)} autoFocus
                      style={{background:T.card,border:`1px solid ${T.accent}`,borderRadius:5,padding:'5px 8px',
                        color:T.textPrimary,fontSize:15,fontFamily:"'JetBrains Mono',monospace",width:95,outline:'none',fontWeight:700}}/>
                    <span style={{color:T.textSecondary,fontSize:11}}>{selected.moneda}</span>
                    <button onClick={updateCosto} style={{background:T.green,border:'none',borderRadius:4,padding:'4px 8px',color:'#000',fontSize:10,fontWeight:700,cursor:'pointer'}}>OK</button>
                    <button onClick={()=>setEditCosto(false)} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'4px 7px',color:T.textMuted,cursor:'pointer',fontSize:10}}>X</button>
                  </div>
                ):(
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {selected.esInsumo && selected.udsXCaja > 1 && (
                          <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>Unitario:</span>
                        )}
                        <span style={{color:selected.costo>0?T.textPrimary:T.red,fontSize:17,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                          {selected.costo>0?(selected.moneda==='USD'?`$${selected.costo} USD`:`₲ ${fmtN(selected.costo)}`):'Sin costo'}
                        </span>
                      </div>
                    </div>
                    <button onClick={()=>{setTempCosto(String(selected.costo||''));setEditCosto(true);}}
                      style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:4,padding:'2px 6px',
                        color:T.textMuted,fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',gap:2}}>
                      <Edit3 size={8}/> Editar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <SL>CANTIDAD DE UNIDADES (descuento automatico por volumen)</SL>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {[1,2,3,5,10,15,20].map(n=>(
                    <button key={n} onClick={()=>setUnidades(n)} style={{
                      padding:'4px 9px',borderRadius:5,border:`1px solid ${unidades===n?T.accent:T.border}`,
                      background:unidades===n?T.accentBg:'transparent',
                      color:unidades===n?T.accent:T.textMuted,
                      fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:"'JetBrains Mono',monospace"}}>
                      {n}
                    </button>
                  ))}
                </div>
                {margenInfo&&(
                  <div style={{marginTop:6,display:'flex',gap:8,flexWrap:'wrap'}}>
                    <span style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>Base: <span style={{color:T.accent,fontWeight:700}}>{margenInfo.base}%</span></span>
                    {margenInfo.ajuste!==0&&<span style={{color:T.textMuted,fontSize:9}}>Rango: <span style={{color:margenInfo.ajuste>0?T.green:T.red,fontWeight:700}}>{fmtPct(margenInfo.ajuste)}</span></span>}
                    {margenInfo.dto!==0&&<span style={{color:T.textMuted,fontSize:9}}>Volumen: <span style={{color:T.accent,fontWeight:700}}>{fmtPct(margenInfo.dto)}</span></span>}
                    <span style={{color:T.textMuted,fontSize:9}}>Final: <span style={{color:T.accent,fontWeight:700}}>{margenInfo.final}%</span></span>
                  </div>
                )}
              </div>

              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>setVistaAdm(false)} style={{flex:1,padding:'6px',borderRadius:6,
                  border:`1px solid ${!vistaAdm?T.green:T.border}`,background:!vistaAdm?T.greenBg:'transparent',
                  color:!vistaAdm?T.green:T.textMuted,fontSize:10,fontWeight:700,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontFamily:"'DM Sans',sans-serif"}}>
                  <Eye size={11}/> Vista Vendedor
                </button>
                <button onClick={()=>setVistaAdm(true)} style={{flex:1,padding:'6px',borderRadius:6,
                  border:`1px solid ${vistaAdm?T.purple:T.border}`,background:vistaAdm?T.purpleBg:'transparent',
                  color:vistaAdm?T.purple:T.textMuted,fontSize:10,fontWeight:700,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontFamily:"'DM Sans',sans-serif"}}>
                  <Settings size={11}/> Vista Admin
                </button>
              </div>
            </div>

            {precios&&!vistaAdm&&(
              <VistVendedor precios={precios} nombre={selected.nombre} codigo={selected.codigo} linea={selected.linea} unidades={unidades}/>
            )}
            {precios&&vistaAdm&&margenInfo&&(
              <VistaAdmin precios={precios} margenInfo={margenInfo} costo={selected.costo} moneda={selected.moneda} linea={selected.linea} unidades={unidades} cfg={cfg} producto={selected}/>
            )}
            {!precios&&(
              <div style={{background:T.redBg,border:'1px solid rgba(248,113,113,0.3)',borderRadius:9,padding:'20px',textAlign:'center'}}>
                <AlertTriangle size={18} color={T.red} style={{marginBottom:6}}/>
                <p style={{color:T.red,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600,marginBottom:2}}>Sin costo cargado</p>
                <p style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>Edita el costo para calcular precios automaticamente</p>
              </div>
            )}
          </div>
        ):(
          <div style={{background:T.card,border:`2px dashed ${T.border}`,borderRadius:10,padding:'40px 20px',textAlign:'center'}}>
            <Package size={26} color={T.textMuted} style={{margin:'0 auto 10px'}}/>
            <p style={{color:T.textSecondary,fontSize:12,fontFamily:"'DM Sans',sans-serif"}}>Selecciona un producto para calcular precios</p>
          </div>
        )}
      </div>
    </div>
  );
}
