import AsyncStorage from '@react-native-async-storage/async-storage';

const LLAVE = 'metaahorro';

export function vacio() {
  return {
    name: '',
    target: 0,
    saved: 0,
    history: [],
    reminderEnabled: false,
    reminderHour: 20,
    reminderMinute: 0,
    celebrated: false,
    updatedAt: 0,
  };
}

export async function cargar() {
  const texto = await AsyncStorage.getItem(LLAVE);
  if (!texto) return vacio();
  return { ...vacio(), ...JSON.parse(texto) };
}

export async function guardar(estado) {
  await AsyncStorage.setItem(LLAVE, JSON.stringify(estado));
}

export function numero(texto) {
  const limpio = String(texto).trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const n = Number(limpio);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function dinero(valor) {
  const n = Number(valor) || 0;
  const texto = n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return '$' + texto;
}

export function fecha(marca) {
  return new Date(marca).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function porcentaje(estado) {
  if (!estado.target) return 0;
  const valor = Math.round((estado.saved / estado.target) * 100);
  return Math.max(0, Math.min(100, valor));
}
