import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertTriangle, CheckCircle, Info, Calendar } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Usar el mismo theme del backoffice principal
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

const fmt  = (n) => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n||0))}`;
const fmtK = (n) => n>=1000000?`₲${(n/1000000).toFixed(1)}M`:n>=1000?`₲${(n/1000).toFixed(0)}K`:`₲${n}`;

const DashboardReal2026 = () => {
  const [selectedMonth, setSelectedMonth] = useState('todo');
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // DATOS REALES ENERO-MARZO 2026 (CORREGIDOS)
  // ═══════════════════════════════════════════════════════════════════════════

  const ventasMensuales = [
    { mes: 'Ene', ventas: 542757733, cmv: 505125211, margenBruto: 37632522, gastosOp: 33360000, margenNeto: 4272522 },
    { mes: 'Feb', ventas: 238797657, cmv: 203653307, margenBruto: 35144350, gastosOp: 20010000, margenNeto: 15134350 },
    { mes: 'Mar', ventas: 455772233, cmv: 304692810, margenBruto: 151079423, gastosOp: 46712309, margenNeto: 104367114 }
  ];

  const totales = {
    ventas: 1237327623,
    cmv: 1013471328,
    margenBruto: 223856295,
    gastosOperativos: 100082309,
    margenNeto: 123773986
  };

  const porcentajes = {
    cmv: 81.9,
    margenBruto: 18.1,
    gastosOp: 8.1,
    margenNeto: 10.0
  };

  const detalleGastos = [
    { categoria: 'Cuotas Préstamos', monto: 66346905, porcentaje: 5.4, color: T.red },
    { categoria: 'Otros Gastos', monto: 25028215, porcentaje: 2.0, color: T.cyan },
    { categoria: 'Tarjetas Crédito', monto: 6935789, porcentaje: 0.6, color: T.accent },
    { categoria: 'Intereses/Comisiones', monto: 1771400, porcentaje: 0.1, color: T.purple }
  ];

  const comparativa = {
    margenDeclarado: 3.97,
    margenReal: 10.0,
    diferencia: 6.03
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPONENTES REUTILIZABLES (estilo backoffice)
  // ═══════════════════════════════════════════════════════════════════════════

  const KPICard = ({ label, value, Icon, badge, color }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 18px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>
            {label.toUpperCase()}
          </div>
          <div style={{ color: T.textPrimary, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '-0.02em', lineHeight: 1 }}>
            {fmtK(value)}
          </div>
          {badge && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg }}>
              {badge.text}
            </div>
          )}
        </div>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: 9, color, flexShrink: 0 }}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );

  const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: T.cardB, border: `1px solid ${T.borderL}`, borderRadius: 8, padding: '10px 14px', minWidth: 140 }}>
        <p style={{ color: T.textSecondary, fontSize: 11, marginBottom: 8, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, marginBottom: 2 }}>
            <span style={{ color: T.textMuted, fontFamily: "'DM Sans',sans-serif", fontSize: 10 }}>{p.name}: </span>
            {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  };

  const AlertBox = ({ type, icon: Icon, title, children }) => {
    const styles = {
      success: { bg: T.greenBg, border: T.green, color: T.green },
      warning: { bg: T.accentBg, border: T.accent, color: T.accent },
      error: { bg: T.redBg, border: T.red, color: T.red },
      info: { bg: T.cyanBg, border: T.cyan, color: T.cyan }
    };
    const s = styles[type] || styles.info;

    return (
      <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
          <div style={{ color: s.color, flexShrink: 0, marginTop: 2 }}>
            <Icon size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.textPrimary, fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: "'DM Sans',sans-serif" }}>
              {title}
            </div>
            <div style={{ color: T.textSecondary, fontSize: 12, lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif" }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: T.textPrimary, fontSize: 26, fontWeight: 700, marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>
          Dashboard Real 2026
        </h1>
        <p style={{ color: T.textSecondary, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
          Análisis financiero basado en datos reales • Enero-Marzo 2026
        </p>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['todo', 'enero', 'febrero', 'marzo'].map(m => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            style={{
              background: selectedMonth === m ? T.accentBg : T.card,
              border: `1px solid ${selectedMonth === m ? T.accentBorder : T.border}`,
              borderRadius: 8,
              padding: '8px 16px',
              color: selectedMonth === m ? T.accent : T.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans',sans-serif",
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {m === 'todo' ? '📅 Todo el Trimestre' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPICard
          label="Ventas Totales"
          value={totales.ventas}
          Icon={DollarSign}
          color={T.cyan}
          badge={{ text: '100%', color: T.cyan, bg: T.cyanBg }}
        />
        <KPICard
          label="CMV"
          value={totales.cmv}
          Icon={ShoppingCart}
          color={T.red}
          badge={{ text: `${porcentajes.cmv}%`, color: T.red, bg: T.redBg }}
        />
        <KPICard
          label="Margen Bruto"
          value={totales.margenBruto}
          Icon={TrendingUp}
          color={T.green}
          badge={{ text: `${porcentajes.margenBruto}%`, color: T.green, bg: T.greenBg }}
        />
        <KPICard
          label="Margen Neto"
          value={totales.margenNeto}
          Icon={CheckCircle}
          color={T.accent}
          badge={{ text: `${porcentajes.margenNeto}%`, color: T.accent, bg: T.accentBg }}
        />
      </div>

      {/* GRÁFICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Evolución Mensual */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
          <h3 style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>
            Evolución Mensual
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={ventasMensuales}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="mes" stroke={T.textMuted} style={{ fontSize: 11 }} />
              <YAxis stroke={T.textMuted} style={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="ventas" stroke={T.cyan} strokeWidth={2} name="Ventas" dot={{ fill: T.cyan, r: 4 }} />
              <Line type="monotone" dataKey="margenBruto" stroke={T.green} strokeWidth={2} name="Margen Bruto" dot={{ fill: T.green, r: 4 }} />
              <Line type="monotone" dataKey="margenNeto" stroke={T.accent} strokeWidth={2} name="Margen Neto" dot={{ fill: T.accent, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución Gastos */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
          <h3 style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600, marginBottom: 16, fontFamily: "'DM Sans',sans-serif" }}>
            Distribución de Gastos Operativos
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={detalleGastos}
                dataKey="monto"
                nameKey="categoria"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(entry) => `${entry.categoria} (${entry.porcentaje}%)`}
                labelStyle={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", fill: T.textSecondary }}
              >
                {detalleGastos.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ANÁLISIS DETALLADO */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Info size={18} color={T.cyan} />
          <h3 style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>
            Análisis Detallado
          </h3>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { label: 'Ventas Totales', value: totales.ventas, pct: 100.0, positive: true },
            { label: 'CMV', value: totales.cmv, pct: porcentajes.cmv, positive: false },
            { label: 'Margen Bruto', value: totales.margenBruto, pct: porcentajes.margenBruto, positive: true },
            { label: 'Gastos Operativos', value: totales.gastosOperativos, pct: porcentajes.gastosOp, positive: false },
            { label: 'Margen Neto Real', value: totales.margenNeto, pct: porcentajes.margenNeto, positive: true }
          ].map((item, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: T.surface,
              borderRadius: 6,
              borderLeft: `3px solid ${item.positive ? T.green : T.red}`,
              transition: 'all 0.2s'
            }}>
              <span style={{ color: T.textSecondary, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>{item.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: T.textPrimary, fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmt(item.value)}
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono',monospace",
                  background: item.positive ? T.greenBg : T.redBg,
                  color: item.positive ? T.green : T.red
                }}>
                  {item.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          style={{
            marginTop: 16,
            width: '100%',
            background: T.accentBg,
            border: `1px solid ${T.accentBorder}`,
            borderRadius: 8,
            padding: '10px 16px',
            color: T.accent,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "'DM Sans',sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {showBreakdown ? '▲ Ocultar Desglose' : '▼ Ver Desglose de Gastos'}
        </button>

        {showBreakdown && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 16 }}>
            {detalleGastos.map((gasto, idx) => (
              <div key={idx} style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderLeft: `4px solid ${gasto.color}`,
                borderRadius: 8,
                padding: 12
              }}>
                <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6, fontFamily: "'DM Sans',sans-serif" }}>
                  {gasto.categoria.toUpperCase()}
                </div>
                <div style={{ color: T.textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmtK(gasto.monto)}
                </div>
                <div style={{ color: T.textSecondary, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>
                  {gasto.porcentaje}% de ventas
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPARATIVA */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <CheckCircle size={18} color={T.green} />
          <h3 style={{ color: T.textPrimary, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>
            Comparativa vs Declarado
          </h3>
        </div>

        <AlertBox type="success" icon={TrendingUp} title="Tu margen real está ARRIBA del declarado">
          Margen declarado F500 2025: <strong>{comparativa.margenDeclarado}%</strong><br />
          Margen NETO REAL Ene-Mar 2026: <strong>{comparativa.margenReal}%</strong><br />
          Diferencia: <strong>+{comparativa.diferencia} puntos porcentuales</strong>
        </AlertBox>

        <AlertBox type="info" icon={Info} title="¿Por qué la diferencia?">
          El F500 incluye deducciones fiscales, ajustes contables y gastos no operativos que reducen el margen declarado.
          Este dashboard muestra tu margen OPERATIVO real basado en ventas y gastos efectivos del trimestre.
        </AlertBox>

        <AlertBox type="warning" icon={AlertTriangle} title="Área de mejora: Cuotas de préstamos">
          Las cuotas de préstamos (₲66.346.905) representan el 5.4% de tus ventas y son el principal gasto operativo.
          Renegociar las tasas o consolidar deuda podría aumentar significativamente tu margen neto.
        </AlertBox>
      </div>
    </div>
  );
};

export default DashboardReal2026;
