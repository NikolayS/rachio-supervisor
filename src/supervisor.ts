import type {
  Alert,
  CurrentSchedule,
  DeviceSnapshot,
  IrrigationSnapshot,
} from './types';
import type { RachioClient } from './rachio';

export interface AlertPolicy {
  warnWhenAnyZoneDisabled: boolean;
  maxRemainingWateringMinutes: number;
}

export const DEFAULT_ALERT_POLICY: AlertPolicy = {
  warnWhenAnyZoneDisabled: false,
  maxRemainingWateringMinutes: 120,
};

export async function getIrrigationSnapshot(
  rachio: Pick<RachioClient, 'getInfo' | 'getCurrentSchedule'>
): Promise<IrrigationSnapshot> {
  const info = await rachio.getInfo();
  const devices: DeviceSnapshot[] = await Promise.all(
    info.devices.map(async (device) => ({
      device,
      currentSchedule: await safeCurrentSchedule(rachio, device.id),
    }))
  );

  return {
    account: {
      username: info.username,
      email: info.email,
    },
    devices,
  };
}

export function analyzeSnapshot(
  snapshot: IrrigationSnapshot,
  policy: AlertPolicy = DEFAULT_ALERT_POLICY
): Alert[] {
  const alerts: Alert[] = [];

  for (const { device, currentSchedule } of snapshot.devices) {
    if (device.status !== 'ONLINE') {
      alerts.push({
        severity: 'critical',
        code: 'device_offline',
        deviceId: device.id,
        message: `${device.name} is ${device.status}`,
      });
    }

    if (device.zones.length === 0) {
      alerts.push({
        severity: 'warning',
        code: 'no_zones',
        deviceId: device.id,
        message: `${device.name} has no zones returned by Rachio`,
      });
    }

    if (device.scheduleRules.every((rule) => !rule.enabled)) {
      alerts.push({
        severity: 'warning',
        code: 'no_enabled_schedules',
        deviceId: device.id,
        message: `${device.name} has no enabled schedules`,
      });
    }

    if (policy.warnWhenAnyZoneDisabled) {
      for (const zone of device.zones.filter((zone) => !zone.enabled)) {
        alerts.push({
          severity: 'info',
          code: 'zone_disabled',
          deviceId: device.id,
          zoneId: zone.id,
          message: `${device.name} zone ${zone.zoneNumber} (${zone.name ?? 'Unnamed'}) is disabled`,
        });
      }
    }

    if (isWatering(currentSchedule)) {
      const remainingMinutes = Math.ceil(
        (currentSchedule.remainingDuration ?? 0) / 60
      );
      if (remainingMinutes > policy.maxRemainingWateringMinutes) {
        alerts.push({
          severity: 'warning',
          code: 'long_watering_run',
          deviceId: device.id,
          message: `${device.name} has ${remainingMinutes} minutes of watering remaining`,
        });
      }
    }
  }

  return alerts;
}

function isWatering(schedule: CurrentSchedule): boolean {
  return schedule.status === 'PROCESSING';
}

async function safeCurrentSchedule(
  rachio: Pick<RachioClient, 'getCurrentSchedule'>,
  deviceId: string
): Promise<CurrentSchedule> {
  try {
    return await rachio.getCurrentSchedule(deviceId);
  } catch (error) {
    return {
      status: 'UNKNOWN',
      remainingDuration: 0,
    };
  }
}
