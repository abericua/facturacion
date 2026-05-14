import React, { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { 
  Users, DollarSign, Calculator, Download, AlertCircle, Info, ChevronRight 
} from 'lucide-react';

const T = {
  bg:          '#07080f',
  surface:     '#0d1117',
  card:        '#111827',
  accent:      '#f59e0b',
  cyan:        '#22d3ee',
  green:       '#34d399',
  red:         '#f87171',
  purple:      '#a78bfa',
  textPrimary: '#e2e8f0',
  textSecondary:'#7d9db5',
  textMuted:   '#3d5470',
  border:      '#1a2535',
};

const fmt = (n) => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n || 0))}`;

const IPSCalculator = () => {
  const [salarioBruto, setSalarioBruto] = useState(2680373); // Mínimo legal sugerido

  // Constantes Fiscales Sol Pro (Sesión 5)
  const TASAS = {
    OBRERO: 0.09,    // 9%
    PATRONAL: 0.165, // 16.5%
    TOTAL: 0.255     // 25.5%
  };

  // Lógica de cálculo (Refinada con validaciones de Gemma)
  const calculos = useMemo(() => {
    const val = parseFloat(salarioBruto);

    // 🛡️ Validación de seguridad estricta
    if (!val || isNaN(val) || val <= 0) return null;

    const montoObrero = val * TASAS.OBRERO;
    const montoPatronal = val * TASAS.PATRONAL;
    const totalAporte = montoObrero + montoPatronal;
    const liquido = val - montoObrero;

    // Distribución estimada de fondos (Estándar Paraguay)
    const distribucion = [
      { name: 'Salud', value: totalAporte * 0.39, color: T.cyan },
      { name: 'Jubilación', value: totalAporte * 0.54, color: T.green },
      { name: 'Administración', value: totalAporte * 0.07, color: T.purple }
    ];

    return {
      montoObrero,
      montoPatronal,
      totalAporte,
      liquido,
      distribucion
    };
  }, [salarioBruto]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: T.textPrimary, fontSize: 24, fontWeight: 700, fontFamily: 'Syne, sans-serif', margin: 0 }}>
            Calculadora de IPS v1.0
          </h2>
          <p style={{ color: T.textSecondary, fontSize: 14, margin: '5px 0 0 0' }}>
            Cálculo de aportes obrero-patronales y distribución de fondos.
          </p>
        </div>
        <button style={{ 
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', 
          background: T.accent, color: '#000', border: 'none', borderRadius: 8, 
          fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
        }}>
          <Download size={18} /> Exportar Resumen
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Panel de Entrada */}
        <div style={{ background: T.card, padding: 24, borderRadius: 12, border: `1px solid ${T.border}` }}>
          <h3 style={{ color: T.accent, fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calculator size={18} /> INGRESO DE DATOS
          </h3>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: T.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
              SALARIO BRUTO MENSUAL
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: T.accent, fontWeight: 700 }}>₲</span>
              <input 
                type="number"
                value={salarioBruto}
                onChange={(e) => setSalarioBruto(e.target.value)}
                style={{ 
                  width: '100%', background: T.surface, border: `1px solid ${T.border}`, 
                  padding: '12px 15px 12px 35px', borderRadius: 8, color: T.textPrimary,
                  fontSize: 18, fontFamily: 'JetBrains Mono, monospace', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <p style={{ color: T.textMuted, fontSize: 11, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={12} /> Salario mínimo vigente: ₲ 2.680.373
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <div style={{ background: T.surface, padding: 15, borderRadius: 8 }}>
              <div style={{ color: T.textSecondary, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>APORTE OBRERO (9%)</div>
              <div style={{ color: T.red, fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {calculos ? fmt(calculos.montoObrero) : '---'}
              </div>
            </div>
            <div style={{ background: T.surface, padding: 15, borderRadius: 8 }}>
              <div style={{ color: T.textSecondary, fontSize: 10, fontWeight: 700, marginBottom: 5 }}>APORTE PATRONAL (16.5%)</div>
              <div style={{ color: T.cyan, fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {calculos ? fmt(calculos.montoPatronal) : '---'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, background: 'rgba(52, 211, 153, 0.05)', padding: 20, borderRadius: 10, border: `1px dashed ${T.green}44` }}>
            <div style={{ color: T.green, fontSize: 12, fontWeight: 700, marginBottom: 5 }}>SALARIO LÍQUIDO A COBRAR</div>
            <div style={{ color: T.textPrimary, fontSize: 28, fontWeight: 800, fontFamily: 'JetBrains Mono' }}>
              {calculos ? fmt(calculos.liquido) : '---'}
            </div>
          </div>
        </div>

        {/* Panel de Distribución */}
        <div style={{ background: T.card, padding: 24, borderRadius: 12, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: T.cyan, fontSize: 14, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> DISTRIBUCIÓN DEL APORTE TOTAL
          </h3>

          <div style={{ flex: 1, minHeight: 200 }}>
            {calculos && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={calculos.distribucion}
                    cx="50%" cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {calculos.distribucion.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}
                    itemStyle={{ color: T.textPrimary }}
                    formatter={(value) => fmt(value)}
                  />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ marginTop: 20, borderTop: `1px solid ${T.border}`, paddingTop: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: T.textSecondary, fontSize: 12 }}>Aporte Total (Obrero + Patronal):</span>
              <span style={{ color: T.textPrimary, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {calculos ? fmt(calculos.totalAporte) : '---'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: T.textSecondary, fontSize: 12 }}>Costo Empresa Total:</span>
              <span style={{ color: T.accent, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {calculos ? fmt(parseFloat(salarioBruto) + calculos.montoPatronal) : '---'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas y Notas */}
      <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: 15, borderRadius: 10, border: `1px solid ${T.accent}33`, display: 'flex', gap: 15, alignItems: 'flex-start' }}>
        <AlertCircle color={T.accent} size={24} style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ color: T.accent, fontSize: 14, fontWeight: 700, margin: '0 0 5px 0' }}>Nota sobre el Aporte Patronal</h4>
          <p style={{ color: T.textSecondary, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            El 16.5% patronal se distribuye legalmente en: 14% Fondo de Jubilaciones, 1.5% Ministerio de Salud y 1% Ministerio de Trabajo (SNPP/SINAFOCAL). 
            Los cálculos mostrados son estimaciones para control interno contable.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IPSCalculator;
