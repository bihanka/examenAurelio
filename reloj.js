import { EventEmitter, requireNativeModule } from 'expo-modules-core';

function cargarModulo() {
  try {
    return requireNativeModule('MetaAhorroSync');
  } catch (error) {
    return null;
  }
}

const nativo = cargarModulo();

export function relojDisponible() {
  return !!nativo;
}

export async function enviarAlReloj(estado) {
  if (!nativo) return false;
  try {
    return await nativo.publish(JSON.stringify(estado));
  } catch (error) {
    return false;
  }
}

export async function leerDelReloj() {
  if (!nativo) return null;
  try {
    const json = await nativo.pull();
    if (!json) return null;
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

export function escucharReloj(cuandoLlegue) {
  if (!nativo) return () => {};
  const eventos = new EventEmitter(nativo);
  const sub = eventos.addListener('onState', (evento) => {
    try {
      cuandoLlegue(JSON.parse(evento.json));
    } catch (error) {
      // Un dato mal formado no debe cerrar la app.
    }
  });
  return () => sub.remove();
}
