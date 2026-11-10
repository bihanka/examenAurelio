import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CANAL = 'ahorro';
const AVISO = 'metaahorro-diario';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function pedirPermiso() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Recordatorios de ahorro',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
    });
  }
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

export async function programarAviso(estado) {
  if (Platform.OS === 'web') return 'web';
  await Notifications.cancelScheduledNotificationAsync(AVISO).catch(() => {});
  if (!estado.reminderEnabled || !estado.name) return 'off';

  const permitido = await pedirPermiso();
  if (!permitido) return 'denied';

  await Notifications.scheduleNotificationAsync({
    identifier: AVISO,
    content: {
      title: 'Hora de ahorrar',
      body: `Agrega un poco a ${estado.name}.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: estado.reminderHour,
      minute: estado.reminderMinute || 0,
      channelId: CANAL,
    },
  });
  return 'ok';
}

export async function avisarMeta(nombre) {
  if (Platform.OS === 'web') return;
  const permitido = await pedirPermiso();
  if (!permitido) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Meta alcanzada',
      body: `Completaste ${nombre}.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 1000),
      channelId: CANAL,
    },
  });
}
