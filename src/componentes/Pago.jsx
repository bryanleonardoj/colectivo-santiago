import { useEffect, useState } from 'react';
import * as api from '../nucleo/api.js';
import { clp } from '../nucleo/util.js';

/**
 * Pago.jsx — flujo de pago del pasajero (RF-07, RF-08 · HU-PAS-04).
 *
 * Tres pasos: confirmar → procesando → comprobante. Mientras se procesa no
 * hay forma de volver a disparar el cobro, que es la defensa contra el pago
 * duplicado del escenario 3 de la historia de usuario. En producción el
 * comprobante se confirma contra el estado que informa Transbank, nunca
 * contra el resultado local.
 */
export default function Pago({ vehiculo, personas = 1, onCerrar, onPagado }) {
  const [paso, setPaso] = useState('confirmar');
  const [comprobante, setComprobante] = useState(null);
  const linea = api.obtenerLinea(vehiculo.linea);
  const total = linea.tarifa * personas;

  // Cerrar con Escape, salvo mientras el cobro está en curso.
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && paso !== 'procesando') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [paso, onCerrar]);

  async function pagar() {
    setPaso('procesando');
    const recibo = await api.pagarViaje(vehiculo, personas);
    setComprobante(recibo);
    setPaso('listo');
    // El pago ya ocupó los asientos: la solicitud de cupo deja de tener sentido.
    onPagado?.();
  }

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="pago-titulo">
      <div className="ov-c">
        {paso === 'confirmar' && (
          <>
            <h3 id="pago-titulo">Confirmar pago</h3>
            <p className="desc">Ambiente de integración. No se realizará ningún cobro real.</p>
            <div className="kv"><span>Línea</span><b>{vehiculo.linea}</b></div>
            <div className="kv"><span>Vehículo</span><b>{vehiculo.patente}</b></div>
            <div className="kv"><span>Medio de pago</span><b>Webpay · débito</b></div>
            <div className="kv">
              <span>Pasajeros</span>
              <b>{personas} × {clp(linea.tarifa)}</b>
            </div>
            <div className="kv" style={{ paddingTop: '.6rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Total</span>
              <b style={{ fontSize: '1.1rem' }}>{clp(total)}</b>
            </div>
            <button className="btn amber" style={{ marginTop: '.9rem' }} onClick={pagar}>
              Pagar {clp(total)}
            </button>
            <button className="btn ghost sm" style={{ marginTop: '.45rem' }} onClick={onCerrar}>
              Cancelar
            </button>
          </>
        )}

        {paso === 'procesando' && (
          <>
            <h3 id="pago-titulo">Procesando</h3>
            <p className="desc">Conectando con el medio de pago…</p>
            <div className="spin" role="status" aria-label="Procesando el pago" />
          </>
        )}

        {paso === 'listo' && (
          <>
            <div className="tick" aria-hidden="true">✓</div>
            <h3 id="pago-titulo" style={{ textAlign: 'center' }}>Pago aprobado</h3>
            <p className="desc" style={{ textAlign: 'center' }}>Muestra este comprobante al conductor.</p>
            <div className="kv"><span>Folio</span><b>{comprobante.folio}</b></div>
            <div className="kv"><span>Monto</span><b>{clp(comprobante.monto)}</b></div>
            <div className="kv"><span>Pasajeros</span><b>{comprobante.personas}</b></div>
            <div className="kv"><span>Línea / vehículo</span><b>{comprobante.linea} · {comprobante.patente}</b></div>
            <div className="kv"><span>Hora</span><b>{comprobante.hora}</b></div>
            <button className="btn" style={{ marginTop: '.9rem' }} onClick={onCerrar}>Listo</button>
          </>
        )}
      </div>
    </div>
  );
}
