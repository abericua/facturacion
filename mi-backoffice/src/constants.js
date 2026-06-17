/**
 * SGSP — constants.js
 * Constantes de negocio SOLPRO. Fuente única de verdad.
 * Importar con: import { CFG_DEFAULT, MARGENES_MULT, BANDA_PISO_PTS, BANDA_TECHO_PTS, RECARGO_DIGITAL } from './constants.js';
 */

/** Configuración de la calculadora de precios */
export const CFG_DEFAULT = {
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

/** Multiplicadores de precio venta = costo × margen (para DashboardReal2026) */
export const MARGENES_MULT = {
  COMERCIAL:   1.30,
  INDUSTRIAL:  1.24,
  INSUMOS:     1.15,
  ACCESORIOS:  1.30,
};
export const MARGEN_DEFAULT = 1.30;

/** Bandas de precio (puntos de guaraníes sobre precio mínimo) */
export const BANDA_PISO_PTS  = 150;
export const BANDA_TECHO_PTS = 350;

/** Recargo por pago digital (QR / transferencia) */
export const RECARGO_DIGITAL = 0.04;
