// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES DE VALIDACIÓN Y CONFIRMACIÓN - Sol Pro Backoffice
// ═══════════════════════════════════════════════════════════════════════════
// P7: Modales de confirmación
// P12: Validación de inputs numéricos
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const T = {
  bg: '#07080f',
  surface: '#0d1117',
  card: '#111827',
  border: '#1a2535',
  accent: '#f59e0b',
  red: '#f87171',
  green: '#34d399',
  textPrimary: '#e2e8f0',
  textSecondary: '#7d9db5'
};

// ═══════════════════════════════════════════════════════════════════════════
// P7: MODAL DE CONFIRMACIÓN
// ═══════════════════════════════════════════════════════════════════════════

export function ModalConfirmacion({ 
  isOpen, 
  onClose, 
  onConfirm, 
  titulo, 
  mensaje, 
  tipo = 'danger', // 'danger', 'warning', 'info'
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar'
}) {
  if (!isOpen) return null;

  const colores = {
    danger: { bg: 'rgba(248,113,113,0.1)', border: T.red, icon: T.red },
    warning: { bg: 'rgba(245,158,11,0.1)', border: T.accent, icon: T.accent },
    info: { bg: 'rgba(52,211,153,0.1)', border: T.green, icon: T.green }
  };

  const color = colores[tipo] || colores.danger;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div 
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: color.bg,
              border: `1px solid ${color.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AlertTriangle size={20} color={color.icon} />
          </div>
          <h3 style={{ 
            margin: 0, 
            fontSize: 18, 
            fontFamily: 'Syne', 
            color: T.textPrimary,
            flex: 1
          }}>
            {titulo}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: T.textSecondary,
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mensaje */}
        <p style={{
          margin: '0 0 24px 0',
          fontSize: 14,
          lineHeight: 1.6,
          color: T.textSecondary,
          fontFamily: 'DM Sans'
        }}>
          {mensaje}
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.textPrimary,
              fontSize: 14,
              fontFamily: 'DM Sans',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = T.card;
              e.currentTarget.style.borderColor = T.textSecondary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = T.surface;
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            {textoCancelar}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: '10px 20px',
              background: color.border,
              border: `1px solid ${color.border}`,
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontFamily: 'DM Sans',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook para usar confirmación fácilmente
export function useConfirmacion() {
  const [config, setConfig] = useState({
    isOpen: false,
    titulo: '',
    mensaje: '',
    tipo: 'danger',
    onConfirm: () => {}
  });

  const confirmar = ({ titulo, mensaje, tipo = 'danger' }) => {
    return new Promise((resolve) => {
      setConfig({
        isOpen: true,
        titulo,
        mensaje,
        tipo,
        onConfirm: () => {
          resolve(true);
          setConfig(prev => ({ ...prev, isOpen: false }));
        }
      });
    });
  };

  const cerrar = () => {
    setConfig(prev => ({ ...prev, isOpen: false }));
  };

  return {
    confirmar,
    ModalConfirmacion: () => (
      <ModalConfirmacion
        {...config}
        onClose={cerrar}
      />
    )
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// P12: INPUT NUMÉRICO VALIDADO
// ═══════════════════════════════════════════════════════════════════════════

export function InputNumerico({
  value,
  onChange,
  placeholder = '',
  min = 0,
  max,
  decimales = 0,
  prefijo = '',
  sufijo = '',
  error,
  style,
  ...props
}) {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  const [isValid, setIsValid] = useState(true);

  const validarYFormatear = (valor) => {
    // Remover todo excepto números, puntos y comas
    let limpio = valor.replace(/[^\d.,\-]/g, '');
    
    // Reemplazar comas por puntos
    limpio = limpio.replace(/,/g, '.');
    
    // Remover puntos duplicados
    const partes = limpio.split('.');
    if (partes.length > 2) {
      limpio = partes[0] + '.' + partes.slice(1).join('');
    }
    
    // Validar número
    const numero = parseFloat(limpio);
    
    if (limpio === '' || limpio === '-') {
      setIsValid(true);
      setLocalValue(limpio);
      onChange?.(null);
      return;
    }
    
    if (isNaN(numero)) {
      setIsValid(false);
      return;
    }
    
    // Validar rango
    let esValido = true;
    if (min !== undefined && numero < min) esValido = false;
    if (max !== undefined && numero > max) esValido = false;
    
    setIsValid(esValido);
    setLocalValue(limpio);
    
    if (esValido) {
      // Redondear a decimales especificados
      const redondeado = decimales === 0 
        ? Math.round(numero)
        : parseFloat(numero.toFixed(decimales));
      
      onChange?.(redondeado);
    }
  };

  const handleBlur = () => {
    if (localValue && isValid) {
      const numero = parseFloat(localValue);
      if (!isNaN(numero)) {
        const formateado = decimales === 0
          ? numero.toString()
          : numero.toFixed(decimales);
        setLocalValue(formateado);
      }
    }
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefijo && (
          <span style={{
            position: 'absolute',
            left: 12,
            color: T.textSecondary,
            fontSize: 14,
            fontFamily: 'JetBrains Mono',
            pointerEvents: 'none'
          }}>
            {prefijo}
          </span>
        )}
        
        <input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={e => validarYFormatear(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '10px 12px',
            paddingLeft: prefijo ? 36 : 12,
            paddingRight: sufijo ? 36 : 12,
            background: T.surface,
            border: `1px solid ${error || !isValid ? T.red : T.border}`,
            borderRadius: 8,
            color: T.textPrimary,
            fontSize: 14,
            fontFamily: 'JetBrains Mono',
            outline: 'none',
            transition: 'border-color 0.2s',
            ...props.style
          }}
          onFocus={e => {
            if (isValid) {
              e.currentTarget.style.borderColor = T.accent;
            }
          }}
          onBlurCapture={e => {
            if (isValid) {
              e.currentTarget.style.borderColor = T.border;
            }
          }}
          {...props}
        />
        
        {sufijo && (
          <span style={{
            position: 'absolute',
            right: 12,
            color: T.textSecondary,
            fontSize: 14,
            fontFamily: 'DM Sans',
            pointerEvents: 'none'
          }}>
            {sufijo}
          </span>
        )}
      </div>
      
      {(error || !isValid) && (
        <span style={{
          display: 'block',
          marginTop: 4,
          fontSize: 12,
          color: T.red,
          fontFamily: 'DM Sans'
        }}>
          {error || `Valor inválido${min !== undefined ? ` (mínimo: ${min})` : ''}${max !== undefined ? ` (máximo: ${max})` : ''}`}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════════

export function LoadingSpinner({ mensaje = 'Procesando...', size = 40 }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 32
    }}>
      <div
        style={{
          width: size,
          height: size,
          border: `3px solid ${T.border}`,
          borderTop: `3px solid ${T.accent}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{
        margin: 0,
        fontSize: 14,
        color: T.textSecondary,
        fontFamily: 'DM Sans'
      }}>
        {mensaje}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDAD: Formatear moneda paraguaya
// ═══════════════════════════════════════════════════════════════════════════

export function formatearGuaranies(numero, opciones = {}) {
  const {
    mostrarSimbolo = true,
    decimales = 0,
    abreviar = false
  } = opciones;

  if (numero === null || numero === undefined || isNaN(numero)) {
    return mostrarSimbolo ? '₲ 0' : '0';
  }

  let valor = Number(numero);

  // Abreviar si es necesario
  if (abreviar) {
    if (Math.abs(valor) >= 1000000) {
      valor = (valor / 1000000).toFixed(1);
      return `${mostrarSimbolo ? '₲' : ''}${valor}M`;
    }
    if (Math.abs(valor) >= 1000) {
      valor = (valor / 1000).toFixed(0);
      return `${mostrarSimbolo ? '₲' : ''}${valor}K`;
    }
  }

  // Formatear con separadores de miles
  const formateado = new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(valor);

  return mostrarSimbolo ? `₲ ${formateado}` : formateado;
}

export default {
  ModalConfirmacion,
  useConfirmacion,
  InputNumerico,
  LoadingSpinner,
  formatearGuaranies
};
