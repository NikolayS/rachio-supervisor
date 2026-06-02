import type {
  Alert,
  CurrentSchedule,
  DeviceEvent,
  DeviceSnapshot,
  IrrigationSnapshot,
  WateringReview,
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

export interface WateringReviewOptions {
  days?: number;
  now?: Date;
}

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

    if (currentSchedule.status === 'UNKNOWN') {
      alerts.push({
        severity: 'warning',
        code: 'schedule_status_unavailable',
        deviceId: device.id,
        message: `${device.name} current watering status is unavailable`,
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

export async function getWateringReview(
  rachio: Pick<RachioClient, 'getInfo' | 'getDeviceEvents'>,
  options: WateringReviewOptions = {}
): Promise<WateringReview> {
  const days = options.days ?? 2;
  const endTs = (options.now ?? new Date()).getTime();
  const startTs = endTs - days * 24 * 60 * 60 * 1000;
  const info = await rachio.getInfo();

  const devices = await Promise.all(
    info.devices.map(async (device) => {
      let events: DeviceEvent[] = [];
      let unavailable = false;

      try {
        events = await rachio.getDeviceEvents(device.id, startTs, endTs);
      } catch {
        unavailable = true;
      }

      const visibleEvents = events
        .filter((event) => !event.hidden)
        .sort((left, right) => (right.eventDate ?? 0) - (left.eventDate ?? 0));
      const wateringEvents = visibleEvents.filter(isWateringEvent);
      const completedZoneRuns = wateringEvents.filter((event) =>
        hasSubtype(event, 'ZONE_COMPLETED', 'DEVICE_ZONE_RUN_COMPLETED_EVENT')
      );
      const stoppedZoneRuns = wateringEvents.filter((event) =>
        hasSubtype(event, 'ZONE_STOPPED', 'DEVICE_ZONE_RUN_STOPPED_EVENT')
      );
      const startedZoneRuns = wateringEvents.filter((event) =>
        hasSubtype(event, 'ZONE_STARTED', 'DEVICE_ZONE_RUN_STARTED_EVENT')
      );
      const completedScheduleRuns = wateringEvents.filter((event) =>
        hasSubtype(event, 'SCHEDULE_COMPLETED')
      );
      const weatherSkipCount = visibleEvents.filter(isWeatherSkipEvent).length;
      const weatherNotSkippedCount = visibleEvents.filter((event) =>
        includesSummary(event, 'not skipped')
      ).length;
      const seasonalAdjustmentCount = visibleEvents.filter((event) =>
        includesSummary(event, 'seasonal shift') || includesSummary(event, 'flex monthly')
      ).length;
      const finishedZoneRuns = [...completedZoneRuns, ...stoppedZoneRuns];
      const estimatedWateringMinutes = finishedZoneRuns.reduce(
        (sum, event) => sum + eventDurationMinutes(event),
        0
      );
      const notes: string[] = [];

      if (unavailable) {
        notes.push('event history unavailable from Rachio');
      }
      if (!unavailable && wateringEvents.length === 0) {
        notes.push('no watering events recorded in this window');
      }
      if (stoppedZoneRuns.length > 0) {
        const summary = stoppedZoneRuns[0].summary;
        notes.push(
          summary
            ? `${stoppedZoneRuns.length} zone run(s) stopped before completion: ${summary}`
            : `${stoppedZoneRuns.length} zone run(s) stopped before completion`
        );
      }
      if (startedZoneRuns.length > completedZoneRuns.length + stoppedZoneRuns.length) {
        notes.push('some zone starts do not have matching completion/stop events yet');
      }
      if (weatherSkipCount > 0) {
        notes.push(`${weatherSkipCount} weather/rain skip event(s)`);
      }
      if (seasonalAdjustmentCount > 0) {
        notes.push(`${seasonalAdjustmentCount} seasonal/flex adjustment event(s)`);
      }

      return {
        device: { id: device.id, name: device.name },
        startTs,
        endTs,
        eventCount: visibleEvents.length,
        wateringEventCount: wateringEvents.length,
        completedZoneRuns: completedZoneRuns.length,
        stoppedZoneRuns: stoppedZoneRuns.length,
        startedZoneRuns: startedZoneRuns.length,
        completedScheduleRuns: completedScheduleRuns.length,
        estimatedWateringMinutes,
        weatherSkipCount,
        weatherNotSkippedCount,
        seasonalAdjustmentCount,
        recentWateringSummaries: wateringEvents
          .map((event) => event.summary)
          .filter((summary): summary is string => Boolean(summary))
          .slice(0, 4),
        recentNonWateringSummaries: visibleEvents
          .filter((event) => !isWateringEvent(event))
          .map((event) => event.summary)
          .filter((summary): summary is string => Boolean(summary))
          .slice(0, 4),
        notes,
      };
    })
  );

  return { days, startTs, endTs, devices };
}

function isWatering(schedule: CurrentSchedule): boolean {
  return schedule.status === 'PROCESSING';
}

function isWateringEvent(event: DeviceEvent): boolean {
  return event.topic === 'WATERING' || event.category === 'WATERING';
}

function isWeatherSkipEvent(event: DeviceEvent): boolean {
  const subtype = event.subType?.toUpperCase() ?? '';
  return (
    subtype.includes('SKIP') &&
    (includesSummary(event, 'weather') || includesSummary(event, 'rain'))
  );
}

function hasSubtype(event: DeviceEvent, ...subtypes: string[]): boolean {
  const actual = event.subType?.toUpperCase() ?? event.eventType?.toString().toUpperCase() ?? '';
  return subtypes.some((subtype) => actual === subtype.toUpperCase());
}

function includesSummary(event: DeviceEvent, text: string): boolean {
  return event.summary?.toLowerCase().includes(text.toLowerCase()) ?? false;
}

function eventDurationMinutes(event: DeviceEvent): number {
  if (typeof event.durationInMinutes === 'number') {
    return event.durationInMinutes;
  }
  if (typeof event.duration === 'number') {
    return event.duration / 60;
  }
  const payloadDuration = event.payload?.durationSeconds;
  if (typeof payloadDuration === 'number') {
    return payloadDuration / 60;
  }
  if (typeof payloadDuration === 'string') {
    const seconds = Number(payloadDuration);
    return Number.isFinite(seconds) ? seconds / 60 : 0;
  }

  const summaryMinutes = event.summary?.match(/\bfor ([0-9]+(?:\.[0-9]+)?) minutes?\b/i);
  return summaryMinutes ? Number(summaryMinutes[1]) : 0;
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
