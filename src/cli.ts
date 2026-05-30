import { loadConfig } from './config';
import {
  formatAlerts,
  formatSchedules,
  formatStatus,
  formatZones,
} from './format';
import { createRachioClient } from './rachio';
import type { RachioClient } from './rachio';
import { analyzeSnapshot, getIrrigationSnapshot } from './supervisor';
import type { AppConfig } from './config';

export interface CliDeps {
  loadConfig?: () => AppConfig;
  createClient?: (token: string) => RachioClient;
  log?: (message: string) => void;
}

export async function runCli(
  argv = process.argv.slice(2),
  deps: CliDeps = {}
): Promise<void> {
  const config = (deps.loadConfig ?? loadConfig)();
  const rachio = (deps.createClient ?? createRachioClient)(config.rachioApiKey);
  const log = deps.log ?? console.log;
  const command = argv[0] ?? 'status';

  switch (command) {
    case 'status': {
      const snapshot = await getIrrigationSnapshot(rachio);
      log(formatStatus(snapshot));
      break;
    }

    case 'zones': {
      const snapshot = await getIrrigationSnapshot(rachio);
      log(formatZones(snapshot));
      break;
    }

    case 'schedules': {
      const snapshot = await getIrrigationSnapshot(rachio);
      log(formatSchedules(snapshot));
      break;
    }

    case 'check': {
      const snapshot = await getIrrigationSnapshot(rachio);
      const alerts = analyzeSnapshot(snapshot);
      log(formatAlerts(alerts));
      process.exitCode = exitCodeForAlerts(alerts);
      break;
    }

    case 'stop': {
      const info = await rachio.getInfo();
      for (const device of info.devices) {
        await rachio.stopDevice(device.id);
        log(`Stopped all watering on ${device.name}`);
      }
      break;
    }

    default:
      log('Commands: status | zones | schedules | check | stop');
      process.exitCode = 1;
  }
}

function exitCodeForAlerts(alerts: ReturnType<typeof analyzeSnapshot>): number {
  if (alerts.some((alert) => alert.severity === 'critical')) {
    return 2;
  }

  return alerts.length > 0 ? 1 : 0;
}
