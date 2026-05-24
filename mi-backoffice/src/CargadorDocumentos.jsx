import { useState, useEffect, useRef } from 'react';
import { FolderOpen, FileText, File, AlertCircle, CheckCircle, Upload, Building2, ShoppingCart, Calendar } from 'lucide-react';
import DB from './db.js';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

const T = {
  bg: '#07080f',
  surface: '#0d1117',
  card: '#111827',
  border: '#1a2535',
  accent: '#f59e0b',
  green: '#34d399',
  red: '#f87171',
  cyan: '#22d3ee',
  purple: '#a78bfa',
  textPrimary: '#e2e8f0',
  textSecondary: '#7d9db5'
};

export default function CargadorDocumentos() {
  const [estado, setEstado] = useState({
    documentos: [],
    errores: []
  });

  const [ivaForm, setIvaForm] = useState({ mes: '01', anio: '2026' });
  const [ireForm, setIreForm] = useState({ anio: '2026' });

  useEffect(() => {
    cargarDocumentosGuardados();
  }, []);

  const cargarDocumentosGuardados = async () => {
    try {
      const ivaGuardados = await DB.getAll('finanzas_iva');
      const ireGuardados = await DB.getAll('finanzas_ire');
      
      const docs = [
        ...ivaGuardados.map(doc => ({
          tipo: 'IVA', nombre: `F120_${doc.periodo}.pdf`, periodo: doc.periodo, guardado: true
        })),
        ...ireGuardados.map(doc => ({
          tipo: 'IRE', nombre: `F500_${doc.anio}.pdf`, periodo: doc.anio, guardado: true
        }))
      ];
      setEstado(prev => ({ ...prev, documentos: docs }));
    } catch (error) {
      console.error('Error al cargar:', error);
    }
  };

  // ── LECTURA DE ARCHIVOS A BASE64 ──
  const leerComoBase64 = (archivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(archivo);
    });
  };

  // ── PROCESADORES EXPLÍCITOS ──
  const procesarIVA = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
      const periodo = ivaForm.anio + '-' + String(ivaForm.mes).padStart(2, '0');
      const base64 = await leerComoBase64(archivo);

      // Extraer texto del PDF
      const pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
      const arrayBuffer = await archivo.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let textoPDF = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textoPDF += content.items.map(item => item.str).join(' ') + '\n';
      }

      // Extraer datos clave con IA
      let datos = {};
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: `Sos un extractor de datos del Formulario 120 (IVA mensual) de Paraguay. 
Devolvé SOLO un JSON sin texto adicional:
{
  "total_ventas_brutas": numero en guaranies,
  "ventas_gravadas_10": numero en guaranies,
  "ventas_gravadas_5": numero en guaranies,
  "ventas_exentas": numero en guaranies,
  "debito_fiscal": numero en guaranies,
  "credito_fiscal": numero en guaranies,
  "saldo_pagar": numero en guaranies
}`,
            messages: [{ role: 'user', content: `Extraé los datos de este F120:\n\n${textoPDF}` }]
          })
        });
        const json = await res.json();
        const raw = json.content?.map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
        datos = JSON.parse(raw);
      } catch(ex) { console.warn('No se pudo extraer datos del F120:', ex); }

      await DB.guardarIVA(periodo, datos, base64);
      alert(`✅ F120 ${periodo} guardado. Ventas: ₲ ${new Intl.NumberFormat('es-PY').format(datos.total_ventas_brutas || 0)}`);
      cargarDocumentosGuardados();
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
    e.target.value = null;
  };

  const procesarIRE = async (e) => { const archivo = e.target.files[0]; if (!archivo) return; try { const base64 = await leerComoBase64(archivo); await DB.guardarIRE(ireForm.anio, {}, base64); alert('Renta IRE guardado'); cargarDocumentosGuardados(); } catch (error) { alert('Error al guardar IRE'); } e.target.value = null; };

  // ── SECCIONES DE CARGA ──
  const BoxCard = ({ title, desc, icon: Icon, color, children }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Icon size={24} color={color} />
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'Syne', color: T.textPrimary }}>{title}</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: T.textSecondary, fontFamily: 'DM Sans' }}>{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 24, background: T.bg, minHeight: '100vh', maxWidth: 900, margin: '0 auto' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono&display=swap');
        .upload-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; background: ${T.surface}; border: 2px dashed ${T.border}; border-radius: 8px; cursor: pointer; color: ${T.textSecondary}; font-family: 'DM Sans'; font-size: 14px; transition: all 0.2s; width: 100%; box-sizing: border-box; margin-top: 10px; }
        .upload-btn:hover { background: rgba(255,255,255,0.05); border-color: ${T.accent}; color: ${T.textPrimary}; }
        .select-input { background: ${T.surface}; border: 1px solid ${T.border}; color: ${T.textPrimary}; padding: 8px; border-radius: 6px; font-family: 'DM Sans'; outline: none; }
      `}</style>

      {/* Header & Purgar */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <FolderOpen size={32} color={T.accent} />
            <h1 style={{ margin: 0, fontSize: 28, fontFamily: 'Syne', color: T.textPrimary }}>Gestor de Archivos</h1>
          </div>
          <p style={{ margin: 0, color: T.textSecondary, fontFamily: 'DM Sans' }}>Carga manual estricta por categoría. Nada se mezcla.</p>
        </div>
        <button
          onClick={async () => {
            if (window.confirm("⚠️ ¿PURGAR TODA LA BASE DE DATOS?\nEsto eliminará PDFs, movimientos bancarios y datos guardados. El sistema quedará 'en blanco'.")) {
              try { await DB.limpiarBaseDatos(); localStorage.clear(); alert("✅ Sistema purgado."); window.location.reload(); } 
              catch (e) { alert("❌ Error: " + e.message); }
            }
          }}
          style={{ background: T.redBg, color: T.red, border: `1px solid ${T.red}`, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <AlertCircle size={16} /> PURGAR DATOS (BLANCO)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* 1. IVA MENSUAL */}
        <BoxCard title="1. Impuestos: IVA Mensual" desc="Formulario 120 - Asignar a un mes específico." icon={Calendar} color={T.accent}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Año Fiscal</label>
              <select className="select-input" style={{ width: '100%' }} value={ivaForm.anio} onChange={e=>setIvaForm({...ivaForm, anio:e.target.value})}>
                <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Mes a Declarar</label>
              <select className="select-input" style={{ width: '100%' }} value={ivaForm.mes} onChange={e=>setIvaForm({...ivaForm, mes:e.target.value})}>
                <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
              </select>
            </div>
          </div>
          <input type="file" accept=".pdf" id="up-iva" style={{ display: 'none' }} onChange={procesarIVA} />
          <label htmlFor="up-iva" className="upload-btn"><Upload size={16}/> Subir PDF de IVA (F120)</label>
        </BoxCard>

        {/* 2. IRE ANUAL */}
        <BoxCard title="2. Impuestos: Renta IRE" desc="Formulario 500 - Declaración Anual Jurada." icon={FileText} color={T.green}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: T.textSecondary, marginBottom: 4 }}>Año Fiscal del Cierre (Ej: 2025 se declara en 2026)</label>
            <select className="select-input" style={{ width: '100%' }} value={ireForm.anio} onChange={e=>setIreForm({...ireForm, anio:e.target.value})}>
              <option value="2023">2023</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026 (Futuro)</option>
            </select>
          </div>
          <input type="file" accept=".pdf" id="up-ire" style={{ display: 'none' }} onChange={procesarIRE} />
          <label htmlFor="up-ire" className="upload-btn"><Upload size={16}/> Subir PDF de Renta (F500)</label>
        </BoxCard>

        {/* 3. VENTAS / COMPRAS CSV */}
        <BoxCard title="3. Base de Ventas y Compras" desc="Archivos históricos o consolidados Excel/CSV." icon={ShoppingCart} color={T.cyan}>
          <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: "'DM Sans'", lineHeight: 1.5, background: `${T.cyan}10`, padding: 12, borderRadius: 8, border: `1px solid ${T.cyan}30` }}>
            Para garantizar la máxima velocidad, la base de datos maestra (BBDD_VENTAS_24_AL_26.csv) se carga directamente desde la carpeta del proyecto <code>/public</code>. 
            <br/><br/>
            Si tenés un archivo nuevo, sobreescribilo en esa carpeta para que el Dashboard lo procese automáticamente sin mezclar.
          </div>
        </BoxCard>

        {/* 4. BANCOS */}
        <BoxCard title="4. Conciliación Bancaria" desc="Extractos de Atlas, Ueno, FIC." icon={Building2} color={T.purple}>
          <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: "'DM Sans'", lineHeight: 1.5 }}>
            Los extractos bancarios requieren un análisis especial (tipo de cambio, comisiones, transferencias).
            <br/><br/>
            Por seguridad de los datos, <strong>los extractos PDF deben subirse directamente en el módulo Bancos</strong>, dentro del perfil de la cuenta correspondiente.
          </div>
        </BoxCard>
      </div>

      {/* Lista de documentos procesados localmente */}
      {estado.documentos.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
          <h4 style={{ margin: '0 0 12px 0', color: T.textPrimary, fontFamily: 'Syne' }}>Documentos Impositivos en Memoria</h4>
          {estado.documentos.map((doc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderBottom: `1px solid ${T.border}` }}>
              <CheckCircle size={16} color={doc.tipo === 'IVA' ? T.accent : T.green} />
              <span style={{ color: T.textPrimary, fontFamily: 'DM Sans', fontSize: 13, flex: 1 }}>{doc.nombre}</span>
              <span style={{ color: T.textSecondary, fontFamily: 'JetBrains Mono', fontSize: 11 }}>Período: {doc.periodo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

