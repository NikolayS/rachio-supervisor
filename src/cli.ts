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

    case 'schedule-start': {
      const selector = requiredArg(argv, 1, 'schedule-start <schedule-id-or-name>');
      const info = await rachio.getInfo();
      const rule = findScheduleRule(info, selector);
      await rachio.startSchedule(rule.id);
      log(`Started schedule: ${rule.name} [${rule.id}]`);
      break;
    }

    case 'schedule-skip': {
      const selector = requiredArg(argv, 1, 'schedule-skip <schedule-id-or-name>');
      const info = await rachio.getInfo();
      const rule = findScheduleRule(info, selector);
      await rachio.skipSchedule(rule.id);
      log(`Skipped next schedule run: ${rule.name} [${rule.id}]`);
      break;
    }

    default:
      log('Commands: status | zones | schedules | check | stop | schedule-start <id-or-name> | schedule-skip <id-or-name>');
      process.exitCode = 1;
  }
}

function requiredArg(argv: string[], index: number, usage: string): string {
  const value = argv[index]?.trim();
  if (!value) {
    throw new Error(`Usage: ${usage}`);
  }

  return value;
}

function findScheduleRule(
  info: Awaited<ReturnType<RachioClient['getInfo']>>,
  selector: string
) {
  const normalized = selector.toLowerCase();
  const rules = info.devices.flatMap((device) => device.scheduleRules);
  const matches = rules.filter((rule) => {
    return (
      rule.id === selector ||
      rule.name.toLowerCase() === normalized ||
      rule.externalName?.toLowerCase() === normalized
    );
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(
      `Schedule selector "${selector}" is ambiguous; use the schedule ID`
    );
  }

  throw new Error(`Schedule not found: ${selector}`);
}

function exitCodeForAlerts(alerts: ReturnType<typeof analyzeSnapshot>): number {
  if (alerts.some((alert) => alert.severity === 'critical')) {
    return 2;
  }

  return alerts.length > 0 ? 1 : 0;
}
