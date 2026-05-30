import { loadConfig } from './config';
import { formatAlerts, formatSchedules, formatStatus, formatZones } from './format';
import { createRachioClient } from './rachio';
import { analyzeSnapshot, getIrrigationSnapshot } from './supervisor';

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const config = loadConfig();
  const rachio = createRachioClient(config.rachioApiKey);
  const command = argv[0] ?? 'status';

  switch (command) {
    case 'status': {
      const snapshot = await getIrrigationSnapshot(rachio);
      console.log(formatStatus(snapshot));
      break;
    }

    case 'zones': {
      const snapshot = await getIrrigationSnapshot(rachio);
      console.log(formatZones(snapshot));
      break;
    }

    case 'schedules': {
      const snapshot = await getIrrigationSnapshot(rachio);
      console.log(formatSchedules(snapshot));
      break;
    }

    case 'check': {
      const snapshot = await getIrrigationSnapshot(rachio);
      const alerts = analyzeSnapshot(snapshot);
      console.log(formatAlerts(alerts));
      process.exitCode = alerts.some((alert) => alert.severity === 'critical')
        ? 2
        : 0;
      break;
    }

    case 'stop': {
      const snapshot = await getIrrigationSnapshot(rachio);
      for (const { device } of snapshot.devices) {
        await rachio.stopDevice(device.id);
        console.log(`Stopped all watering on ${device.name}`);
      }
      break;
    }

    default:
      console.log('Commands: status | zones | schedules | check | stop');
      process.exitCode = 1;
  }
}
