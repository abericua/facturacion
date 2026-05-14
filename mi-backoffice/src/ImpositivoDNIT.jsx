import { useState, useMemo } from "react";
import {
  Calendar, Calculator, CheckCircle, XCircle, AlertTriangle,
  FileText, TrendingUp, DollarSign, Shield, Percent, Clock,
  AlertCircle, Info, ChevronRight, Search, Filter, Zap
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// THEME
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

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES FISCALES — DNIT PARAGUAY
// ═══════════════════════════════════════════════════════════════════════════

// Calendario Perpetuo — vencimientos según último dígito del RUC (sin DV)
const CALENDARIO_PERPETUO = {
  0: 7,  1: 9,  2: 11, 3: 13, 4: 15,
  5: 17, 6: 19, 7: 21, 8: 23, 9: 25,
};

// Tasas impositivas vigentes
const TASAS = {
  IVA_GENERAL: 10,
  IVA_REDUCIDO: 5,
  IRE_GENERAL: 10,
  IRE_SIMPLE: 10,
  IRE_PRESUNTA: 30, // Renta presunta = 30% de facturación
  IDU_RESIDENTES: 8,
  IDU_NO_RESIDENTES: 15,
  IRP_SERVICIOS: [8, 9, 10], // Progresivo según tramo
  IRP_CAPITAL: 8,
};

// Umbrales de facturación para regímenes IRE
const UMBRALES_IRE = {
  RESIMPLE_MAX: 80_000_000,      // Hasta 80M GS
  SIMPLE_MAX: 2_000_000_000,     // Hasta 2.000M GS
  GENERAL_MIN: 2_000_000_000,    // Más de 2.000M GS
};

// Anticipos IRE — umbral y cuotas
const ANTICIPOS = {
  UMBRAL_OBLIGATORIO: 10_000_000, // Si impuesto > 10M → obligatorio
  CANTIDAD_CUOTAS: 4,
  PORCENTAJE_CUOTA: 25, // 25% cada cuota
  CODIGO_PAGO: '736',   // Código DNIT para anticipos IRE SIMPLE
  CODIGO_PAGO_GENERAL: '735', // Código para IRE General
};

// Retenciones IVA
const RETENCIONES_IVA = {
  MERCADO_INTERNO: 30,        // 30% del IVA
  AGRICOLAS: 10,              // 10% para productos agrícolas
  EXTERIOR_NO_INSCRIPTOS: 100, // 100% para no residentes
  TARJETAS: 0.9099,           // 0.9099% Bancard/procesadoras
  EXPORTADORES: 30,           // 30% para exportadores
};

// Retenciones IRE
const RETENCIONES_IRE = {
  ESTADO: 4,                  // 4% para compras del Estado
  TARJETAS: 1,                // 1% procesadoras
  PEQUEÑOS_PRODUCTORES: 3,    // 3% con autofactura
  RECICLAJE: 1.5,             // 1.5% bienes usados/reciclables
  GANADO: 0.4,                // 0.4% frigoríficos/ferias
};

// IPS — Seguridad Social
const IPS = {
  APORTE_OBRERO: 9,           // 9% descontado al empleado
  APORTE_PATRONAL: 16.5,      // 16.5% costo empresa
  TOTAL: 25.5,                // 25.5% total
  DISTRIBUCION: {
    JUBILACIONES: 12.5,
    ENFERMEDAD_MATERNIDAD: 9.5, // 9% + 0.5% Ley 7446/2024
    ADMINISTRATIVO: 1,
    OTRAS_INSTITUCIONES: 2.5,   // SENEPA, SNPP, SINAFOCAL
  },
};

// Límites de deducción IRE
const LIMITES_DEDUCCION = {
  DONACIONES_SOCIOS_EXTERIOR: 1,      // 1% de ingresos brutos
  PERDIDAS_ANTERIORES: 20,            // 20% de renta neta
  INTERESES_VINCULADOS: 30,           // 30% de renta neta
  IVA_AUTOVEHICULOS_SERVICIOS: 30,    // 30% del IVA crédito
};

// Categorías de gastos deducibles
const CATEGORIAS_GASTOS = {
  LABORALES: ['Salarios', 'IPS Patronal', 'Aguinaldos', 'Beneficios Personal'],
  ADMINISTRATIVOS: ['Alquileres', 'Servicios Básicos', 'Honorarios Profesionales', 'Útiles de Oficina'],
  COMERCIALIZACION: ['Publicidad', 'Fletes', 'Movilidad y Viáticos', 'Comisiones'],
  FINANCIEROS: ['Intereses Bancarios', 'Comisiones', 'Seguros', 'Depreciaciones'],
};

// Vencimientos por tipo de impuesto
const VENCIMIENTOS = {
  IVA: { mes_siguiente: true, dia_por_ruc: true },
  IRE_GENERAL: { mes: 4, descripcion: 'Abril año siguiente' }, // Form 500
  IRE_SIMPLE: { mes: 3, descripcion: 'Marzo año siguiente' },  // Form 501
  IRE_RESIMPLE: { mes: 2, descripcion: 'Febrero año siguiente' },
  ANTICIPOS_IRE_SIMPLE: { meses: [4,6,8,10], descripcion: 'Meses impares' },
  ANTICIPOS_IRE_GENERAL: { meses: [5,7,9,11], descripcion: 'Meses impares' },
};

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

const Badge = ({txt,color,bg}) => (
  <span style={{fontSize:8,fontWeight:700,color,background:bg||`${color}18`,padding:'2px 8px',borderRadius:4,fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.06em',whiteSpace:'nowrap'}}>{txt}</span>
);

const Input = ({label,value,onChange,type='text',placeholder='',style={}}) => (
  <div style={{display:'flex',flexDirection:'column',gap:4}}>
    {label && <label style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>{label}</label>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',
        color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none',...style}}/>
  </div>
);

const InfoBox = ({children,color=T.cyan,Icon=Info}) => (
  <div style={{background:`${color}06`,border:`1px solid ${color}30`,borderRadius:8,padding:'10px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
    <Icon size={14} color={color} style={{flexShrink:0,marginTop:1}}/>
    <div style={{fontSize:10,color:T.textSecondary,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5}}>{children}</div>
  </div>
);

const fmtGs = n => '₲ '+new Intl.NumberFormat('es-PY').format(Math.round(n||0));

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — CALENDARIO PERPETUO DNIT
// ═══════════════════════════════════════════════════════════════════════════
function TabCalendario() {
  const [ruc, setRuc] = useState('80102833-7'); // RUC Sol Pro como ejemplo
  const [año, setAño] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth()+1);

  // Extraer último dígito antes del DV
  const ultimoDigito = useMemo(() => {
    const sinDV = ruc.replace(/-\d$/,'').trim();
    return parseInt(sinDV.slice(-1)) || 0;
  }, [ruc]);

  const diaVencimiento = CALENDARIO_PERPETUO[ultimoDigito];

  // Ajustar si cae en fin de semana
  const calcularFechaReal = (dia) => {
    const fecha = new Date(año, mes-1, dia);
    const dow = fecha.getDay();
    if (dow === 0) return dia + 1; // Domingo → Lunes
    if (dow === 6) return dia + 2; // Sábado → Lunes
    return dia;
  };

  const diaReal = calcularFechaReal(diaVencimiento);
  const esAjustado = diaReal !== diaVencimiento;

  // Cálculo de vencimientos para todos los impuestos del mes
  const vencimientos = useMemo(() => {
    const v = [];
    
    // IVA mensual
    v.push({
      impuesto: 'IVA',
      form: 'F120',
      periodo: `${String(mes).padStart(2,'0')}/${año}`,
      vence: `${año}-${String(mes+1>12?1:mes+1).padStart(2,'0')}-${String(diaReal).padStart(2,'0')}`,
      color: T.cyan,
    });

    // IRE anual (solo en meses de vencimiento)
    if (mes === 3) { // Marzo = IRE SIMPLE
      v.push({
        impuesto: 'IRE SIMPLE',
        form: 'F501',
        periodo: `Anual ${año-1}`,
        vence: `${año}-03-${String(diaReal).padStart(2,'0')}`,
        color: T.purple,
      });
    }
    if (mes === 4) { // Abril = IRE GENERAL
      v.push({
        impuesto: 'IRE GENERAL',
        form: 'F500',
        periodo: `Anual ${año-1}`,
        vence: `${año}-04-${String(diaReal).padStart(2,'0')}`,
        color: T.accent,
      });
    }

    // Anticipos IRE SIMPLE (meses impares: 4,6,8,10)
    if ([4,6,8,10].includes(mes)) {
      v.push({
        impuesto: 'ANTICIPO IRE SIMPLE',
        form: 'Código 736',
        periodo: `Cuota ${[4,6,8,10].indexOf(mes)+1}/4`,
        vence: `${año}-${String(mes).padStart(2,'0')}-${String(diaReal).padStart(2,'0')}`,
        color: T.orange,
      });
    }

    // Anticipos IRE GENERAL (meses impares: 5,7,9,11)
    if ([5,7,9,11].includes(mes)) {
      v.push({
        impuesto: 'ANTICIPO IRE GENERAL',
        form: 'Código 735',
        periodo: `Cuota ${[5,7,9,11].indexOf(mes)+1}/4`,
        vence: `${año}-${String(mes).padStart(2,'0')}-${String(diaReal).padStart(2,'0')}`,
        color: T.green,
      });
    }

    return v;
  }, [año, mes, diaReal]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
        CALENDARIO PERPETUO — VENCIMIENTOS DNIT
      </div>

      <InfoBox color={T.cyan}>
        <strong style={{color:T.cyan}}>¿Cómo funciona?</strong> El día de vencimiento de tus impuestos se determina
        por el <strong>último dígito de tu RUC</strong> (sin contar el dígito verificador). Si el día cae sábado/domingo/feriado,
        se traslada automáticamente al siguiente día hábil sin multas.
      </InfoBox>

      {/* Calculadora */}
      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:18}}>
        <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
          CALCULADORA DE VENCIMIENTOS
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:12,marginBottom:16}}>
          <Input label="RUC (con DV)" value={ruc} onChange={e=>setRuc(e.target.value)} placeholder="12345678-9"/>
          <Input label="MES" type="number" value={mes} onChange={e=>setMes(parseInt(e.target.value)||1)} style={{width:'100%'}}/>
          <Input label="AÑO" type="number" value={año} onChange={e=>setAño(parseInt(e.target.value)||2026)} style={{width:'100%'}}/>
        </div>

        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:16,marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <div style={{background:`${T.accent}18`,borderRadius:8,padding:10}}><Calendar size={22} color={T.accent}/></div>
            <div style={{flex:1}}>
              <div style={{color:T.textMuted,fontSize:9,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>ÚLTIMO DÍGITO RUC</div>
              <div style={{color:T.accent,fontSize:24,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{ultimoDigito}</div>
            </div>
            <ChevronRight size={20} color={T.textMuted}/>
            <div style={{flex:1}}>
              <div style={{color:T.textMuted,fontSize:9,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>DÍA BASE</div>
              <div style={{color:T.cyan,fontSize:24,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{diaVencimiento}</div>
            </div>
            {esAjustado && (
              <>
                <ChevronRight size={20} color={T.textMuted}/>
                <div style={{flex:1}}>
                  <div style={{color:T.textMuted,fontSize:9,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>DÍA REAL</div>
                  <div style={{color:T.green,fontSize:24,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{diaReal}</div>
                  <Badge txt="AJUSTADO" color={T.orange}/>
                </div>
              </>
            )}
          </div>
          {esAjustado && (
            <div style={{background:`${T.orange}08`,border:`1px dashed ${T.orange}30`,borderRadius:6,padding:'6px 10px'}}>
              <span style={{color:T.orange,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>
                ⚠️ El día {diaVencimiento} cae en fin de semana — vence el día {diaReal}
              </span>
            </div>
          )}
        </div>

        {/* Tabla de vencimientos del mes */}
        <div style={{background:T.surface,borderRadius:8,overflow:'hidden'}}>
          <div style={{padding:'8px 12px',background:T.cardB,borderBottom:`1px solid ${T.border}`}}>
            <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>
              VENCIMIENTOS — {['','ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][mes]} {año}
            </span>
          </div>
          {vencimientos.length === 0 ? (
            <div style={{padding:30,textAlign:'center',color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
              No hay vencimientos especiales en este mes
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:T.card}}>
                  {['IMPUESTO','FORMULARIO','PERÍODO','VENCE'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                      textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vencimientos.map((v,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                    <td style={{padding:'8px 12px'}}><Badge txt={v.impuesto} color={v.color}/></td>
                    <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{v.form}</td>
                    <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{v.periodo}</td>
                    <td style={{padding:'8px 12px',color:v.color,fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{v.vence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tabla de referencia completa */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            TABLA CALENDARIO PERPETUO — TODOS LOS DÍGITOS
          </span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:0}}>
          {Object.entries(CALENDARIO_PERPETUO).map(([dig,dia])=>(
            <div key={dig} style={{
              padding:'12px',
              borderRight:`1px solid ${T.border}`,
              borderBottom:`1px solid ${T.border}`,
              background: parseInt(dig)===ultimoDigito ? T.accentBg : 'transparent',
            }}>
              <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>DÍGITO {dig}</div>
              <div style={{color:parseInt(dig)===ultimoDigito?T.accent:T.textPrimary,fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>
                Día {dia}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — ANTICIPOS IRE
// ═══════════════════════════════════════════════════════════════════════════
function TabAnticipos() {
  const [regimen, setRegimen] = useState('SIMPLE');
  const [impuestoAño1, setImpuestoAño1] = useState('');
  const [impuestoAño2, setImpuestoAño2] = useState('');
  const [impuestoAño3, setImpuestoAño3] = useState('');
  const [retencionesAnterior, setRetencionesAnterior] = useState('');
  const [saldoFavor, setSaldoFavor] = useState('');

  const años = useMemo(()=>{
    const y = new Date().getFullYear();
    return [y-1, y-2, y-3];
  },[]);

  // Promedio de 3 años
  const promedio = useMemo(()=>{
    const vals = [impuestoAño1, impuestoAño2, impuestoAño3]
      .map(v=>parseFloat(v)||0)
      .filter(v=>v>0);
    if (vals.length===0) return 0;
    return vals.reduce((s,v)=>s+v,0) / vals.length;
  },[impuestoAño1, impuestoAño2, impuestoAño3]);

  const obligatorio = promedio > ANTICIPOS.UMBRAL_OBLIGATORIO;

  // Base para anticipos
  const base = Math.max(0, promedio - (parseFloat(retencionesAnterior)||0) - (parseFloat(saldoFavor)||0));
  
  // 4 cuotas del 25%
  const cuota = obligatorio ? base / ANTICIPOS.CANTIDAD_CUOTAS : 0;

  // Meses de pago según régimen
  const mesesPago = regimen==='SIMPLE' ? [4,6,8,10] : [5,7,9,11];
  const codigo = regimen==='SIMPLE' ? ANTICIPOS.CODIGO_PAGO : ANTICIPOS.CODIGO_PAGO_GENERAL;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
        ANTICIPOS IRE — CÁLCULO AUTOMÁTICO
      </div>

      <InfoBox color={T.purple}>
        <strong style={{color:T.purple}}>¿Cuándo son obligatorios?</strong> Si el <strong>promedio del impuesto de los últimos 3 años supera
        los ₲{fmtGs(ANTICIPOS.UMBRAL_OBLIGATORIO)}</strong>, la DNIT te obliga a pagar <strong>4 cuotas anticipadas del 25% cada una</strong> para
        el año siguiente. Se pagan en meses impares después del vencimiento de tu declaración anual.
      </InfoBox>

      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:18}}>
        <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
          CALCULADORA DE ANTICIPOS IRE
        </div>

        <div style={{display:'flex',gap:10,marginBottom:16}}>
          {['SIMPLE','GENERAL'].map(r=>(
            <button key={r} onClick={()=>setRegimen(r)} style={{
              flex:1,padding:'10px',border:`1px solid ${regimen===r?T.purple:T.border}`,borderRadius:8,
              background:regimen===r?T.purpleBg:'transparent',color:regimen===r?T.purple:T.textSecondary,
              fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"
            }}>IRE {r}</button>
          ))}
        </div>

        <div style={{background:T.surface,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>
            IMPUESTO LIQUIDADO EN LOS ÚLTIMOS 3 AÑOS
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            <Input label={`AÑO ${años[0]}`} type="number" value={impuestoAño1} onChange={e=>setImpuestoAño1(e.target.value)} placeholder="15315685"/>
            <Input label={`AÑO ${años[1]}`} type="number" value={impuestoAño2} onChange={e=>setImpuestoAño2(e.target.value)} placeholder="11009449"/>
            <Input label={`AÑO ${años[2]}`} type="number" value={impuestoAño3} onChange={e=>setImpuestoAño3(e.target.value)} placeholder="8834102"/>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <Input label="RETENCIONES SUFRIDAS (año anterior)" type="number" value={retencionesAnterior} onChange={e=>setRetencionesAnterior(e.target.value)} placeholder="0"/>
          <Input label="SALDO A FAVOR (si tenés)" type="number" value={saldoFavor} onChange={e=>setSaldoFavor(e.target.value)} placeholder="0"/>
        </div>

        {/* Resultados */}
        <div style={{background:obligatorio?T.orangeBg:T.greenBg,border:`1px solid ${obligatorio?T.orange:T.green}40`,borderRadius:8,padding:16}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
            <div>
              <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>PROMEDIO 3 AÑOS</div>
              <div style={{color:obligatorio?T.orange:T.green,fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(promedio)}</div>
            </div>
            <div>
              <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>BASE ANTICIPOS</div>
              <div style={{color:obligatorio?T.orange:T.green,fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(base)}</div>
            </div>
            <div>
              <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>ESTADO</div>
              <Badge txt={obligatorio?'OBLIGATORIO':'NO OBLIGATORIO'} color={obligatorio?T.orange:T.green} bg={obligatorio?`${T.orange}20`:`${T.green}20`}/>
            </div>
          </div>

          {obligatorio ? (
            <div>
              <div style={{color:obligatorio?T.orange:T.green,fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>
                📋 CUOTAS A PAGAR ({ANTICIPOS.CANTIDAD_CUOTAS} × {ANTICIPOS.PORCENTAJE_CUOTA}% = {fmtGs(cuota)} cada una)
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
                {mesesPago.map((m,i)=>(
                  <div key={m} style={{background:T.surface,borderRadius:6,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>CUOTA {i+1}</div>
                      <div style={{color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
                        {['','ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][m]} — Código {codigo}
                      </div>
                    </div>
                    <div style={{color:T.accent,fontSize:12,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{fmtGs(cuota)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center',padding:10}}>
              <div style={{color:T.green,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                ✅ No estás obligado a pagar anticipos este año
              </div>
              <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif",marginTop:4}}>
                El promedio es menor a {fmtGs(ANTICIPOS.UMBRAL_OBLIGATORIO)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ejemplo con datos reales de Sol Pro */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>
        <div style={{color:T.cyan,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>
          📊 EJEMPLO REAL — SOL PRO SRL
        </div>
        <div style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
          Sol Pro SRL (RUC 80102833-7) liquidó:<br/>
          • 2025: <strong style={{color:T.accent}}>{fmtGs(15315685)}</strong> (Form 500)<br/>
          • 2024: <strong style={{color:T.accent}}>{fmtGs(11009449)}</strong><br/>
          • 2023: <strong style={{color:T.accent}}>{fmtGs(8834102)}</strong><br/><br/>
          Promedio: <strong style={{color:T.accent}}>{fmtGs(11719745)}</strong> → <strong style={{color:T.orange}}>OBLIGATORIO</strong><br/>
          Cuotas 2026: <strong style={{color:T.accent}}>4 × {fmtGs(11719745/4)} = {fmtGs(11719745)}</strong>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — VALIDADOR DE GASTOS DEDUCIBLES
// ═══════════════════════════════════════════════════════════════════════════
function TabValidador() {
  const [gasto, setGasto] = useState('');
  const [monto, setMonto] = useState('');
  const [tieneFactura, setTieneFactura] = useState(true);
  const [esNecesario, setEsNecesario] = useState(true);
  const [esReal, setEsReal] = useState(true);
  const [categoria, setCategoria] = useState('LABORALES');

  const reglas = [
    { id:'factura', texto:'Tiene factura legal a nombre de la empresa', check:tieneFactura },
    { id:'necesario', texto:'Es necesario para mantener la fuente productora del negocio', check:esNecesario },
    { id:'real', texto:'Representa una erogación real (gasto verdadero)', check:esReal },
  ];

  const esDeducible = reglas.every(r=>r.check);
  const categoriasDisponibles = Object.keys(CATEGORIAS_GASTOS);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
        VALIDADOR DE GASTOS DEDUCIBLES — IRE
      </div>

      <InfoBox color={T.green}>
        <strong style={{color:T.green}}>Las 3 reglas de oro:</strong> Para que un gasto sea deducible en el IRE,
        debe cumplir <strong>las 3 condiciones simultáneamente</strong>: (1) tener factura legal, (2) ser necesario
        para tu actividad económica, y (3) ser un gasto real. Si falta una, <strong>no es deducible</strong>.
      </InfoBox>

      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:18}}>
        <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
          EVALUADOR DE DEDUCIBILIDAD
        </div>

        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:16}}>
          <Input label="DESCRIPCIÓN DEL GASTO" value={gasto} onChange={e=>setGasto(e.target.value)} placeholder="Ej: Alquiler oficina principal"/>
          <Input label="MONTO (GS)" type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="0"/>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>CATEGORÍA</label>
            <select value={categoria} onChange={e=>setCategoria(e.target.value)}
              style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'8px 11px',
                color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}>
              {categoriasDisponibles.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{background:T.surface,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:12}}>
            CHECKLIST DE CUMPLIMIENTO
          </div>
          {reglas.map(r=>(
            <label key={r.id} style={{
              display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
              background:r.check?`${T.green}08`:`${T.red}08`,
              border:`1px solid ${r.check?`${T.green}30`:`${T.red}30`}`,
              borderRadius:6,marginBottom:8,cursor:'pointer'
            }}>
              <input type="checkbox" checked={r.check}
                onChange={e=> {
                  if (r.id==='factura') setTieneFactura(e.target.checked);
                  if (r.id==='necesario') setEsNecesario(e.target.checked);
                  if (r.id==='real') setEsReal(e.target.checked);
                }}
                style={{width:16,height:16,cursor:'pointer'}}/>
              <span style={{flex:1,color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>{r.texto}</span>
              {r.check ? <CheckCircle size={14} color={T.green}/> : <XCircle size={14} color={T.red}/>}
            </label>
          ))}
        </div>

        {/* Resultado */}
        <div style={{
          background:esDeducible?T.greenBg:T.redBg,
          border:`1px solid ${esDeducible?T.green:T.red}40`,
          borderRadius:8,padding:16,textAlign:'center'
        }}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:8}}>
            {esDeducible ? <CheckCircle size={24} color={T.green}/> : <XCircle size={24} color={T.red}/>}
            <div style={{color:esDeducible?T.green:T.red,fontSize:16,fontWeight:800,fontFamily:"'DM Sans',sans-serif"}}>
              {esDeducible ? 'GASTO DEDUCIBLE' : 'GASTO NO DEDUCIBLE'}
            </div>
          </div>
          {monto && (
            <div style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
              {esDeducible
                ? `✅ Podés deducir ${fmtGs(parseFloat(monto)||0)} en tu declaración del IRE`
                : `❌ Este gasto de ${fmtGs(parseFloat(monto)||0)} NO reduce tu base imponible`
              }
            </div>
          )}
        </div>
      </div>

      {/* Ejemplos comunes por categoría */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            EJEMPLOS DE GASTOS DEDUCIBLES POR CATEGORÍA
          </span>
        </div>
        <div style={{padding:14}}>
          {Object.entries(CATEGORIAS_GASTOS).map(([cat,items])=>(
            <div key={cat} style={{marginBottom:12}}>
              <div style={{color:T.accent,fontSize:10,fontWeight:700,fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>{cat}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {items.map(item=><Badge key={item} txt={item} color={T.cyan}/>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Límites especiales */}
      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:14}}>
        <div style={{color:T.orange,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>
          ⚠️ TOPES Y LÍMITES ESPECIALES
        </div>
        <div style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
          • <strong>Donaciones/Socios/Exterior:</strong> máximo <strong style={{color:T.accent}}>{LIMITES_DEDUCCION.DONACIONES_SOCIOS_EXTERIOR}% de ingresos brutos</strong><br/>
          • <strong>Pérdidas de años anteriores:</strong> máximo <strong style={{color:T.accent}}>{LIMITES_DEDUCCION.PERDIDAS_ANTERIORES}% de renta neta</strong><br/>
          • <strong>Intereses a partes vinculadas:</strong> máximo <strong style={{color:T.accent}}>{LIMITES_DEDUCCION.INTERESES_VINCULADOS}% de renta neta</strong><br/>
          • <strong>IVA autovehículos (servicios):</strong> máximo <strong style={{color:T.accent}}>{LIMITES_DEDUCCION.IVA_AUTOVEHICULOS_SERVICIOS}% del IVA crédito</strong>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — DETECTOR RÉGIMEN IRE
// ═══════════════════════════════════════════════════════════════════════════
function TabRegimen() {
  const [facturacionAnual, setFacturacionAnual] = useState('');

  const facturacion = parseFloat(facturacionAnual) || 0;

  const regimen = useMemo(() => {
    if (facturacion === 0) return null;
    if (facturacion <= UMBRALES_IRE.RESIMPLE_MAX) return 'RESIMPLE';
    if (facturacion <= UMBRALES_IRE.SIMPLE_MAX) return 'SIMPLE';
    return 'GENERAL';
  }, [facturacion]);

  const detalles = {
    RESIMPLE: {
      nombre: 'IRE RESIMPLE',
      color: T.green,
      tasa: 'Cuota fija mensual ₲20k-₲80k',
      vencimiento: 'Febrero año siguiente (Form N°)',
      anticipos: 'No aplican',
      libros: 'Boleta RESIMPLE',
      icon: '🟢',
    },
    SIMPLE: {
      nombre: 'IRE SIMPLE',
      color: T.cyan,
      tasa: '10% sobre renta neta',
      vencimiento: 'Marzo año siguiente (Form 501)',
      anticipos: 'Sí, si promedio > ₲10M',
      libros: 'Libro Ventas/Compras (Excel DNIT)',
      icon: '🔵',
    },
    GENERAL: {
      nombre: 'IRE GENERAL',
      color: T.accent,
      tasa: '10% sobre renta neta',
      vencimiento: 'Abril año siguiente (Form 500)',
      anticipos: 'Sí, si promedio > ₲10M',
      libros: 'Balances + Estados Financieros',
      icon: '🟠',
    },
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
        DETECTOR DE RÉGIMEN IRE
      </div>

      <InfoBox color={T.purple}>
        <strong style={{color:T.purple}}>¿Cómo se determina?</strong> Tu régimen de IRE se asigna automáticamente
        según tu <strong>facturación anual</strong>. Hasta ₲80M → RESIMPLE (cuota fija), hasta ₲2.000M → SIMPLE (libros Excel),
        más de ₲2.000M → GENERAL (balances completos).
      </InfoBox>

      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:18}}>
        <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
          CALCULADORA DE RÉGIMEN
        </div>

        <Input
          label="FACTURACIÓN ANUAL (ingresos brutos del año)"
          type="number"
          value={facturacionAnual}
          onChange={e=>setFacturacionAnual(e.target.value)}
          placeholder="Ej: 3858536561"
          style={{marginBottom:20}}
        />

        {regimen && (
          <div style={{
            background:`${detalles[regimen].color}08`,
            border:`2px solid ${detalles[regimen].color}`,
            borderRadius:10,padding:20,textAlign:'center'
          }}>
            <div style={{fontSize:40,marginBottom:8}}>{detalles[regimen].icon}</div>
            <div style={{color:detalles[regimen].color,fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:8}}>
              {detalles[regimen].nombre}
            </div>
            <div style={{color:T.textMuted,fontSize:11,fontFamily:"'DM Sans',sans-serif",marginBottom:16}}>
              Para facturación de <strong style={{color:T.accent}}>{fmtGs(facturacion)}</strong>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,textAlign:'left'}}>
              <div>
                <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>TASA</div>
                <div style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{detalles[regimen].tasa}</div>
              </div>
              <div>
                <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>VENCIMIENTO</div>
                <div style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{detalles[regimen].vencimiento}</div>
              </div>
              <div>
                <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>ANTICIPOS</div>
                <div style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{detalles[regimen].anticipos}</div>
              </div>
              <div>
                <div style={{color:T.textMuted,fontSize:8,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>DOCUMENTACIÓN</div>
                <div style={{color:T.textPrimary,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{detalles[regimen].libros}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabla comparativa */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            COMPARATIVA DE REGÍMENES IRE
          </span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:T.surface}}>
              {['RÉGIMEN','UMBRAL','TASA','VENCIMIENTO','ANTICIPOS','DOCUMENTACIÓN'].map(h=>(
                <th key={h} style={{padding:'8px 12px',color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',
                  textAlign:'left',borderBottom:`1px solid ${T.border}`,fontFamily:"'DM Sans',sans-serif"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['RESIMPLE','SIMPLE','GENERAL'].map((r,i)=>(
              <tr key={r} style={{
                borderBottom:`1px solid ${T.border}`,
                background: regimen===r ? `${detalles[r].color}08` : (i%2===0?'transparent':T.surface)
              }}>
                <td style={{padding:'8px 12px'}}><Badge txt={detalles[r].nombre} color={detalles[r].color}/></td>
                <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>
                  {r==='RESIMPLE' && `≤ ${fmtGs(UMBRALES_IRE.RESIMPLE_MAX)}`}
                  {r==='SIMPLE' && `≤ ${fmtGs(UMBRALES_IRE.SIMPLE_MAX)}`}
                  {r==='GENERAL' && `> ${fmtGs(UMBRALES_IRE.GENERAL_MIN)}`}
                </td>
                <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{detalles[r].tasa}</td>
                <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{detalles[r].vencimiento}</td>
                <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{detalles[r].anticipos}</td>
                <td style={{padding:'8px 12px',color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{detalles[r].libros}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sol Pro como ejemplo */}
      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:14}}>
        <div style={{color:T.green,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:10}}>
          📊 EJEMPLO REAL — SOL PRO SRL
        </div>
        <div style={{color:T.textSecondary,fontSize:10,fontFamily:"'DM Sans',sans-serif",lineHeight:1.6}}>
          • Facturación 2025: <strong style={{color:T.accent}}>{fmtGs(3858536561)}</strong><br/>
          • Régimen asignado: <strong style={{color:T.accent}}>IRE GENERAL</strong> (supera los ₲2.000M)<br/>
          • Tasa: <strong>10%</strong> sobre renta neta real<br/>
          • Vence: <strong>Abril 2026</strong> (Form 500)<br/>
          • Anticipos: <strong>OBLIGATORIOS</strong> (promedio 3 años &gt; ₲10M)
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5 — RETENCIONES
// ═══════════════════════════════════════════════════════════════════════════
function TabRetenciones() {
  const [tipo, setTipo] = useState('IVA');
  const [subtipo, setSubtipo] = useState('MERCADO_INTERNO');
  const [monto, setMonto] = useState('');
  const [montoSinIva, setMontoSinIva] = useState('');

  const porcentajes = tipo==='IVA' ? RETENCIONES_IVA : RETENCIONES_IRE;
  const porcentaje = porcentajes[subtipo] || 0;

  const calcular = () => {
    const m = parseFloat(monto) || 0;
    const sinIva = parseFloat(montoSinIva) || 0;
    
    if (tipo === 'IVA') {
      // Retención se aplica sobre el IVA de la factura
      const iva = m - sinIva;
      return iva * (porcentaje / 100);
    } else {
      // Retención IRE se aplica sobre el monto sin IVA
      return sinIva * (porcentaje / 100);
    }
  };

  const retencion = calcular();

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
        CALCULADORA DE RETENCIONES IVA / IRE
      </div>

      <InfoBox color={T.orange}>
        <strong style={{color:T.orange}}>¿Qué son las retenciones?</strong> Cuando pagás a un proveedor,
        si sos <strong>Agente de Retención</strong> designado por la DNIT, debés retener un porcentaje
        del impuesto y depositarlo directamente al Fisco. El proveedor después lo usa como crédito fiscal.
      </InfoBox>

      <div style={{background:T.card,border:`1px solid ${T.borderL}`,borderRadius:10,padding:18}}>
        <div style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>
          CALCULADORA DE RETENCIONES
        </div>

        <div style={{display:'flex',gap:10,marginBottom:16}}>
          {['IVA','IRE'].map(t=>(
            <button key={t} onClick={()=>{setTipo(t);setSubtipo(t==='IVA'?'MERCADO_INTERNO':'ESTADO');}} style={{
              flex:1,padding:'10px',border:`1px solid ${tipo===t?T.accent:T.border}`,borderRadius:8,
              background:tipo===t?T.accentBg:'transparent',color:tipo===t?T.accent:T.textSecondary,
              fontWeight:700,fontSize:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"
            }}>{t}</button>
          ))}
        </div>

        <div style={{marginBottom:16}}>
          <label style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",display:'block',marginBottom:6}}>
            TIPO DE RETENCIÓN
          </label>
          <select value={subtipo} onChange={e=>setSubtipo(e.target.value)}
            style={{width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:'10px 12px',
              color:T.textPrimary,fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:'none'}}>
            {Object.keys(porcentajes).map(k=>(
              <option key={k} value={k}>
                {k.replace(/_/g,' ')} — {porcentajes[k]}%
              </option>
            ))}
          </select>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <Input label="MONTO TOTAL FACTURA (con IVA)" type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="11000000"/>
          <Input label="MONTO SIN IVA" type="number" value={montoSinIva} onChange={e=>setMontoSinIva(e.target.value)} placeholder="10000000"/>
        </div>

        <div style={{background:T.orangeBg,border:`1px solid ${T.orange}40`,borderRadius:8,padding:16,textAlign:'center'}}>
          <div style={{color:T.textMuted,fontSize:9,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif",marginBottom:4}}>
            RETENCIÓN A PRACTICAR ({porcentaje}%)
          </div>
          <div style={{color:T.orange,fontSize:24,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>
            {fmtGs(retencion)}
          </div>
          <div style={{color:T.textMuted,fontSize:10,fontFamily:"'DM Sans',sans-serif",marginTop:8}}>
            Monto a pagar al proveedor: <strong style={{color:T.textPrimary}}>{fmtGs((parseFloat(monto)||0)-retencion)}</strong>
          </div>
        </div>
      </div>

      {/* Tabla de referencia IVA */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            REFERENCIA RÁPIDA — RETENCIONES IVA
          </span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <tbody>
            {Object.entries(RETENCIONES_IVA).map(([k,v],i)=>(
              <tr key={k} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                <td style={{padding:'8px 12px',color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{k.replace(/_/g,' ')}</td>
                <td style={{padding:'8px 12px',textAlign:'right',color:T.cyan,fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{v}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabla de referencia IRE */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
        <div style={{padding:'10px 14px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
            REFERENCIA RÁPIDA — RETENCIONES IRE
          </span>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <tbody>
            {Object.entries(RETENCIONES_IRE).map(([k,v],i)=>(
              <tr key={k} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?'transparent':T.surface}}>
                <td style={{padding:'8px 12px',color:T.textPrimary,fontSize:10,fontFamily:"'DM Sans',sans-serif"}}>{k.replace(/_/g,' ')}</td>
                <td style={{padding:'8px 12px',textAlign:'right',color:T.accent,fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{v}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InfoBox color={T.red}>
        <strong style={{color:T.red}}>⏱️ Plazo de emisión:</strong> El comprobante de retención
        debe emitirse dentro de los <strong>5 días corridos</strong> desde el pago. Usar software Tesakã
        (gratuito DNIT) o Web Service para empresas con alto volumen.
      </InfoBox>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6 — CONSTANTES FISCALES
// ═══════════════════════════════════════════════════════════════════════════
function TabConstantes() {
  const [buscar, setBuscar] = useState('');

  const constantes = [
    { grupo:'TASAS IMPOSITIVAS', items: [
      { label:'IVA General', valor:'10%', desc:'Tasa general para bienes y servicios' },
      { label:'IVA Reducido', valor:'5%', desc:'Canasta básica, agro, inmuebles, medicamentos' },
      { label:'IRE General/Simple', valor:'10%', desc:'Sobre renta neta real' },
      { label:'IRE Presunta', valor:'30%', desc:'30% de facturación (opción SIMPLE)' },
      { label:'IDU Residentes', valor:'8%', desc:'Impuesto a dividendos para residentes' },
      { label:'IDU No Residentes', valor:'15%', desc:'Impuesto a dividendos para no residentes' },
      { label:'IRP Servicios', valor:'8-10%', desc:'Progresivo según tramo de ingresos' },
      { label:'IRP Capital', valor:'8%', desc:'Ganancias de capital' },
    ]},
    { grupo:'UMBRALES IRE', items: [
      { label:'RESIMPLE (máximo)', valor:fmtGs(UMBRALES_IRE.RESIMPLE_MAX), desc:'Hasta 80M → cuota fija' },
      { label:'SIMPLE (máximo)', valor:fmtGs(UMBRALES_IRE.SIMPLE_MAX), desc:'Hasta 2.000M → libros Excel' },
      { label:'GENERAL (mínimo)', valor:fmtGs(UMBRALES_IRE.GENERAL_MIN), desc:'Más de 2.000M → balances completos' },
    ]},
    { grupo:'IPS LABORAL', items: [
      { label:'Aporte Obrero', valor:'9%', desc:'Descontado al empleado' },
      { label:'Aporte Patronal', valor:'16.5%', desc:'Costo empresa' },
      { label:'Total IPS', valor:'25.5%', desc:'9% + 16.5%' },
      { label:'Jubilaciones', valor:'12.5%', desc:'Del total 25.5%' },
      { label:'Enfermedad/Maternidad', valor:'9.5%', desc:'Incluye 0.5% Ley 7446/2024' },
    ]},
    { grupo:'ANTICIPOS IRE', items: [
      { label:'Umbral obligatorio', valor:fmtGs(ANTICIPOS.UMBRAL_OBLIGATORIO), desc:'Si promedio 3 años > 10M' },
      { label:'Cantidad cuotas', valor:'4', desc:'25% cada una' },
      { label:'Código pago SIMPLE', valor:ANTICIPOS.CODIGO_PAGO, desc:'Para IRE SIMPLE' },
      { label:'Código pago GENERAL', valor:ANTICIPOS.CODIGO_PAGO_GENERAL, desc:'Para IRE GENERAL' },
    ]},
  ];

  const filtrados = useMemo(()=>{
    if (!buscar) return constantes;
    const b = buscar.toLowerCase();
    return constantes.map(g=>({
      ...g,
      items: g.items.filter(i=>
        i.label.toLowerCase().includes(b) ||
        i.desc.toLowerCase().includes(b)
      )
    })).filter(g=>g.items.length>0);
  },[buscar]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.1em',fontFamily:"'DM Sans',sans-serif"}}>
          CONSTANTES FISCALES — REFERENCIA RÁPIDA
        </span>
        <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar..."
          style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,padding:'5px 10px',color:T.textPrimary,fontSize:11,outline:'none',fontFamily:"'DM Sans',sans-serif",width:200}}/>
      </div>

      {filtrados.map((grupo,i)=>(
        <div key={i} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'10px 14px',background:T.cardB,borderBottom:`1px solid ${T.border}`}}>
            <span style={{color:T.accent,fontSize:10,fontWeight:700,letterSpacing:'0.08em',fontFamily:"'DM Sans',sans-serif"}}>
              {grupo.grupo}
            </span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <tbody>
              {grupo.items.map((item,j)=>(
                <tr key={j} style={{borderBottom:`1px solid ${T.border}`,background:j%2===0?'transparent':T.surface}}>
                  <td style={{padding:'10px 12px',width:'40%'}}>
                    <div style={{color:T.textPrimary,fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:2}}>{item.label}</div>
                    <div style={{color:T.textMuted,fontSize:9,fontFamily:"'DM Sans',sans-serif"}}>{item.desc}</div>
                  </td>
                  <td style={{padding:'10px 12px',textAlign:'right',color:T.cyan,fontSize:13,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{item.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ImpositivoDNIT() {
  const [tab, setTab] = useState('calendario');

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{color:T.textMuted,fontSize:9,fontWeight:700,letterSpacing:'0.12em',marginBottom:2}}>SISTEMA TRIBUTARIO</div>
          <h1 style={{margin:0,color:T.textPrimary,fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>
            Impositivo <span style={{color:T.accent}}>DNIT Paraguay</span>
          </h1>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Badge txt={`IVA ${TASAS.IVA_GENERAL}%`} color={T.cyan}/>
          <Badge txt={`IRE ${TASAS.IRE_GENERAL}%`} color={T.accent}/>
          <Badge txt={`IPS ${IPS.TOTAL}%`} color={T.green}/>
        </div>
      </div>

      <div style={{display:'flex',gap:3,background:T.card,borderRadius:10,padding:4,border:`1px solid ${T.border}`,width:'fit-content',flexWrap:'wrap'}}>
        <TabBtn id="calendario"  label="📅 Calendario"   active={tab==='calendario'}  onClick={setTab}/>
        <TabBtn id="anticipos"   label="💰 Anticipos IRE" active={tab==='anticipos'}   onClick={setTab}/>
        <TabBtn id="validador"   label="✓ Validador"     active={tab==='validador'}   onClick={setTab}/>
        <TabBtn id="regimen"     label="📊 Régimen IRE"   active={tab==='regimen'}     onClick={setTab}/>
        <TabBtn id="retenciones" label="🔻 Retenciones"  active={tab==='retenciones'} onClick={setTab}/>
        <TabBtn id="constantes"  label="📖 Constantes"   active={tab==='constantes'}  onClick={setTab}/>
      </div>

      {tab==='calendario'  && <TabCalendario/>}
      {tab==='anticipos'   && <TabAnticipos/>}
      {tab==='validador'   && <TabValidador/>}
      {tab==='regimen'     && <TabRegimen/>}
      {tab==='retenciones' && <TabRetenciones/>}
      {tab==='constantes'  && <TabConstantes/>}
    </div>
  );
}
