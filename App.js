import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { avisarMeta, programarAviso } from './avisos';
import { cargar, dinero, fecha, guardar, numero, porcentaje, vacio } from './datos';
import { enviarAlReloj, escucharReloj, leerDelReloj, relojDisponible } from './reloj';

const ATAJOS = [10, 20, 50, 100];

export default function App() {
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState(vacio());
  const [nombre, setNombre] = useState('');
  const [metaTexto, setMetaTexto] = useState('');
  const [entrada, setEntrada] = useState('');
  const [salida, setSalida] = useState('');
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState('');
  const estadoRef = useRef(estado);
  const editandoRef = useRef(false);

  useEffect(() => {
    let cancelar = () => {};
    let activo = true;

    (async () => {
      let actual = await cargar();
      const remoto = await leerDelReloj();
      if (remoto && (remoto.updatedAt || 0) > (actual.updatedAt || 0)) {
        actual = { ...vacio(), ...remoto };
        await guardar(actual);
      } else if (actual.name && (!remoto || actual.updatedAt > (remoto.updatedAt || 0))) {
        await enviarAlReloj(actual);
      }
      if (!activo) return;
      estadoRef.current = actual;
      setEstado(actual);
      setNombre(actual.name);
      setMetaTexto(actual.target ? String(actual.target) : '');
      setListo(true);
      programarAviso(actual).catch(() => {});
      cancelar = escucharReloj((remotoEstado) => {
        const local = estadoRef.current;
        if (!remotoEstado || (remotoEstado.updatedAt || 0) <= (local.updatedAt || 0)) return;
        const cruzo = local.target > 0 && local.saved < local.target && remotoEstado.saved >= remotoEstado.target;
        const siguiente = { ...vacio(), ...remotoEstado };
        estadoRef.current = siguiente;
        setEstado(siguiente);
        if (!editandoRef.current) {
          setNombre(siguiente.name);
          setMetaTexto(siguiente.target ? String(siguiente.target) : '');
        }
        guardar(siguiente);
        programarAviso(siguiente).catch(() => {});
        if (cruzo) avisarMeta(siguiente.name);
      });
    })();

    return () => {
      activo = false;
      cancelar();
    };
  }, []);

  function aplicar(cambios) {
    const siguiente = { ...estadoRef.current, ...cambios, updatedAt: Date.now() };
    estadoRef.current = siguiente;
    setEstado(siguiente);
    guardar(siguiente);
    enviarAlReloj(siguiente).catch(() => {});
    programarAviso(siguiente).catch(() => {});
  }

  function guardarMeta() {
    const name = nombre.trim();
    const target = numero(metaTexto);
    if (!name) {
      setError('Escribe el nombre de la meta.');
      return;
    }
    if (nombre.trim().length > 20) {
      setError('El nombre admite máximo 20 letras.');
      return;
    }
    if (target < 1 || target > 100000) {
      setError('La meta debe estar entre $1 y $100,000.');
      return;
    }
    if (estadoRef.current.saved > target) {
      setError('La meta no puede ser menor que lo ya ahorrado.');
      return;
    }
    const saved = estadoRef.current.saved;
    aplicar({
      name,
      target,
      celebrated: saved >= target,
    });
    editandoRef.current = false;
    setEditando(false);
    setError('');
  }

  function mover(firmado) {
    const actual = estadoRef.current;
    const amount = numero(Math.abs(firmado));
    if (amount <= 0) {
      setError('Escribe una cantidad mayor a cero.');
      return;
    }
    if (firmado < 0 && amount > actual.saved) {
      setError('No puedes retirar más de ' + dinero(actual.saved) + '.');
      return;
    }
    const falta = Math.max(0, Math.round((actual.target - actual.saved) * 100) / 100);
    if (firmado > 0 && amount > falta) {
      setError(falta <= 0 ? 'Ya llegaste al límite de la meta.' : 'Solo puedes agregar ' + dinero(falta) + '.');
      return;
    }
    const saved = Math.round((actual.saved + (firmado < 0 ? -amount : amount)) * 100) / 100;
    const cruzo = actual.target > 0 && actual.saved < actual.target && saved >= actual.target;
    aplicar({
      saved,
      celebrated: actual.target > 0 && saved >= actual.target,
      history: [
        { id: String(Date.now()), type: firmado > 0 ? 'in' : 'out', amount, at: Date.now() },
        ...actual.history,
      ].slice(0, 20),
    });
    setEntrada('');
    setSalida('');
    setError('');
    if (cruzo) avisarMeta(actual.name);
  }

  async function cambiarAviso(valor) {
    const siguiente = { ...estadoRef.current, reminderEnabled: valor, updatedAt: Date.now() };
    estadoRef.current = siguiente;
    setEstado(siguiente);
    await guardar(siguiente);
    const resultado = await programarAviso(siguiente);
    if (valor && resultado === 'denied') {
      const apagado = { ...siguiente, reminderEnabled: false, updatedAt: Date.now() };
      estadoRef.current = apagado;
      setEstado(apagado);
      await guardar(apagado);
      setError('Activa las notificaciones del teléfono para el recordatorio.');
      return;
    }
    enviarAlReloj(estadoRef.current).catch(() => {});
    setError('');
  }

  const tieneMeta = estado.name.trim().length > 0 && estado.target > 0;
  const avance = porcentaje(estado);
  const falta = Math.max(0, Math.round((estado.target - estado.saved) * 100) / 100);
  const lista = tieneMeta && !editando;
  const arriba = Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0;

  return (
    <View style={styles.pagina}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.telefono}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.contenido, { paddingTop: arriba + 18 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.cabecera}>
            <View style={styles.moneda}>
              <Text style={styles.monedaTexto}>$</Text>
            </View>
            <View>
              <Text style={styles.marca}>MetaAhorro</Text>
              <Text style={styles.lema}>Una meta, guardada en el teléfono</Text>
            </View>
          </View>

          {!listo ? <Text style={styles.aviso}>Cargando...</Text> : null}

          {listo && lista ? (
            <View style={styles.hero}>
              <Text style={styles.heroEtiqueta}>
                {estado.saved >= estado.target ? 'Meta alcanzada' : 'Total ahorrado'}
              </Text>
              <Text style={styles.heroMonto}>{dinero(estado.saved)}</Text>
              <Text style={styles.heroNombre}>{estado.name}</Text>
              <View style={styles.pista}>
                <View style={[styles.lleno, { width: `${avance}%` }]} />
              </View>
              <View style={styles.heroFila}>
                <Text style={styles.heroPorcentaje}>{avance}%</Text>
                <Text style={styles.heroMeta}>Meta: {dinero(estado.target)}</Text>
              </View>
              <Text style={styles.heroFalta}>
                {falta <= 0 ? 'Ya completaste tu objetivo.' : `Faltan ${dinero(falta)}`}
              </Text>
            </View>
          ) : null}

          {listo && (!tieneMeta || editando) ? (
            <View style={styles.tarjeta}>
              <Text style={styles.titulo}>{tieneMeta ? 'Editar meta' : 'Crear meta'}</Text>
              <Text style={styles.ayuda}>Escribe el nombre y la cantidad que deseas ahorrar.</Text>
              <Text style={styles.etiqueta}>Nombre</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Vacaciones"
                placeholderTextColor="#8C9992"
                style={styles.campo}
              />
              <Text style={styles.etiqueta}>Cantidad</Text>
              <TextInput
                value={metaTexto}
                onChangeText={setMetaTexto}
                placeholder="5000"
                placeholderTextColor="#8C9992"
                keyboardType="decimal-pad"
                style={styles.campo}
              />
              <Pressable style={styles.boton} onPress={guardarMeta}>
                <Text style={styles.botonTexto}>{tieneMeta ? 'Guardar cambios' : 'Crear meta'}</Text>
              </Pressable>
              {editando ? (
                <Pressable
                  onPress={() => {
                    editandoRef.current = false;
                    setEditando(false);
                    setNombre(estado.name);
                    setMetaTexto(String(estado.target));
                    setError('');
                  }}
                >
                  <Text style={styles.enlace}>Cancelar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {listo && lista ? (
            <View style={styles.tarjeta}>
              <Text style={styles.titulo}>Agregar ahorro</Text>
              <View style={styles.atajos}>
                {ATAJOS.map((cantidad) => (
                  <Pressable key={cantidad} style={styles.atajo} onPress={() => mover(cantidad)}>
                    <Text style={styles.atajoTexto}>${cantidad}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.fila}>
                <TextInput
                  value={entrada}
                  onChangeText={setEntrada}
                  placeholder="0.00"
                  placeholderTextColor="#8C9992"
                  keyboardType="decimal-pad"
                  style={styles.campoFlex}
                />
                <Pressable style={styles.boton} onPress={() => mover(numero(entrada))}>
                  <Text style={styles.botonTexto}>Agregar</Text>
                </Pressable>
              </View>
              <Text style={styles.tituloChico}>Retirar dinero</Text>
              <View style={styles.fila}>
                <TextInput
                  value={salida}
                  onChangeText={setSalida}
                  placeholder="0.00"
                  placeholderTextColor="#8C9992"
                  keyboardType="decimal-pad"
                  style={styles.campoFlex}
                />
                <Pressable style={styles.botonLinea} onPress={() => mover(-numero(salida))}>
                  <Text style={styles.botonLineaTexto}>Retirar</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {listo && lista ? (
            <View style={styles.tarjeta}>
              <Text style={styles.titulo}>Historial</Text>
              <Text style={styles.ayuda}>Movimientos</Text>
              {estado.history.length === 0 ? (
                <Text style={styles.vacio}>Todavía no hay depósitos ni retiros.</Text>
              ) : (
                estado.history.map((mov) => (
                  <View key={mov.id} style={styles.mov}>
                    <View>
                      <Text style={mov.type === 'in' ? styles.entradaTexto : styles.salidaTexto}>
                        {mov.type === 'in' ? 'Depósito' : 'Retiro'}
                      </Text>
                      <Text style={styles.movFecha}>{fecha(mov.at)}</Text>
                    </View>
                    <Text style={mov.type === 'in' ? styles.entradaTexto : styles.salidaTexto}>
                      {mov.type === 'in' ? '+' : '−'} {dinero(mov.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {listo && lista ? (
            <View style={styles.tarjeta}>
              <View style={styles.filaCentro}>
                <View style={styles.flex}>
                  <Text style={styles.titulo}>Recordatorio</Text>
                  <Text style={styles.ayuda}>Un aviso diario para seguir ahorrando.</Text>
                </View>
                <Switch
                  value={estado.reminderEnabled}
                  onValueChange={cambiarAviso}
                  trackColor={{ false: '#D5DDD8', true: '#8FCBB0' }}
                  thumbColor={estado.reminderEnabled ? '#0E4F38' : '#F7F4EE'}
                />
              </View>
              <View style={styles.horaFila}>
                <Pressable
                  style={styles.horaBoton}
                  onPress={() => aplicar({ reminderHour: (estado.reminderHour + 23) % 24 })}
                >
                  <Text style={styles.horaBotonTexto}>−</Text>
                </Pressable>
                <Text style={styles.hora}>
                  {String(estado.reminderHour).padStart(2, '0')}:00
                </Text>
                <Pressable
                  style={styles.horaBoton}
                  onPress={() => aplicar({ reminderHour: (estado.reminderHour + 1) % 24 })}
                >
                  <Text style={styles.horaBotonTexto}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {listo && lista ? (
            <Pressable
              onPress={() => {
                editandoRef.current = true;
                setEditando(true);
              }}
            >
              <Text style={styles.enlace}>Editar meta</Text>
            </Pressable>
          ) : null}
          <Text style={styles.nota}>
            {relojDisponible()
              ? 'Los cambios se guardan en el teléfono y se envían al reloj.'
              : 'Los cambios se guardan en este teléfono.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: {
    flex: 1,
    backgroundColor: '#E7EFEA',
    alignItems: 'center',
  },
  telefono: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#F7F4EE',
  },
  contenido: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  moneda: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0E4F38',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  monedaTexto: {
    color: '#F2C14E',
    fontSize: 22,
    fontWeight: '700',
  },
  marca: {
    color: '#1C2B24',
    fontSize: 22,
    fontWeight: '700',
  },
  lema: {
    color: '#5E7067',
    fontSize: 13,
    marginTop: 2,
  },
  hero: {
    backgroundColor: '#0E4F38',
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
  },
  heroEtiqueta: {
    color: '#D5E6DC',
    fontSize: 13,
    letterSpacing: 0.4,
  },
  heroMonto: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '700',
    marginTop: 4,
  },
  heroNombre: {
    color: '#F2C14E',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  pista: {
    height: 10,
    borderRadius: 99,
    backgroundColor: '#2F6B56',
    marginTop: 16,
    overflow: 'hidden',
  },
  lleno: {
    height: '100%',
    backgroundColor: '#F2C14E',
  },
  heroFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  heroPorcentaje: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroMeta: {
    color: '#D5E6DC',
    fontSize: 15,
  },
  heroFalta: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 6,
  },
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  titulo: {
    color: '#1C2B24',
    fontSize: 18,
    fontWeight: '700',
  },
  tituloChico: {
    color: '#1C2B24',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  ayuda: {
    color: '#5E7067',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
  },
  etiqueta: {
    color: '#3E5148',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  campo: {
    backgroundColor: '#F7F4EE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C2B24',
    marginBottom: 12,
  },
  campoFlex: {
    flex: 1,
    backgroundColor: '#F7F4EE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C2B24',
    marginRight: 8,
  },
  boton: {
    backgroundColor: '#147A56',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  botonTexto: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  botonLinea: {
    borderWidth: 1.5,
    borderColor: '#147A56',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  botonLineaTexto: {
    color: '#147A56',
    fontWeight: '700',
    fontSize: 15,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filaCentro: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
    paddingRight: 8,
  },
  atajos: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  atajo: {
    flex: 1,
    backgroundColor: '#E7F5EE',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  atajoTexto: {
    color: '#0E4F38',
    fontWeight: '700',
  },
  mov: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE3',
  },
  entradaTexto: {
    color: '#147A56',
    fontWeight: '700',
    fontSize: 15,
  },
  salidaTexto: {
    color: '#B42318',
    fontWeight: '700',
    fontSize: 15,
  },
  movFecha: {
    color: '#5E7067',
    fontSize: 12,
    marginTop: 2,
  },
  vacio: {
    color: '#5E7067',
    fontSize: 14,
  },
  horaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  horaBoton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E7F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horaBotonTexto: {
    color: '#0E4F38',
    fontSize: 22,
    fontWeight: '700',
  },
  hora: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C2B24',
    marginHorizontal: 22,
  },
  enlace: {
    textAlign: 'center',
    color: '#147A56',
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  error: {
    color: '#B42318',
    textAlign: 'center',
    marginBottom: 8,
  },
  nota: {
    color: '#5E7067',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 18,
  },
  aviso: {
    color: '#5E7067',
    marginBottom: 12,
  },
});
