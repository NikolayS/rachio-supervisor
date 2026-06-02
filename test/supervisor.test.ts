import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeSnapshot,
  getIrrigationSnapshot,
  getWateringReview,
} from '../src/supervisor';
import type { AccountInfo, IrrigationSnapshot } from '../src/types';

const account: AccountInfo = {
  username: 'nik',
  email: 'nik@example.com',
  devices: [
    {
      id: 'dev-1',
      name: 'Front Controller',
      model: 'Gen 3',
      status: 'ONLINE',
      zones: [{ id: 'zone-1', zoneNumber: 1, name: 'Citrus', enabled: true }],
      scheduleRules: [{ id: 'sched-1', name: 'Morning', enabled: true, days: ['MONDAY'], startTime: '05:00' }],
    },
  ],
};

describe('getIrrigationSnapshot', () => {
  it('combines account devices with current watering state', async () => {
    const snapshot = await getIrrigationSnapshot({
      async getInfo() {
        return account;
      },
      async getCurrentSchedule(deviceId: string) {
        assert.equal(deviceId, 'dev-1');
        return { status: 'PROCESSING', zoneNumber: 1, remainingDuration: 600 };
      },
    });

    assert.equal(snapshot.account.email, 'nik@example.com');
    assert.equal(snapshot.devices[0].device.name, 'Front Controller');
    assert.equal(snapshot.devices[0].currentSchedule.status, 'PROCESSING');
  });

  it('keeps snapshot generation alive when current schedule lookup fails', async () => {
    const snapshot = await getIrrigationSnapshot({
      async getInfo() {
        return account;
      },
      async getCurrentSchedule() {
        throw new Error('temporary Rachio error');
      },
    });

    assert.equal(snapshot.devices[0].currentSchedule.status, 'UNKNOWN');
  });
});

describe('analyzeSnapshot', () => {
  it('returns no alerts for a healthy controller', () => {
    assert.deepEqual(analyzeSnapshot(snapshot()), []);
  });

  it('raises critical alert for an offline controller', () => {
    const alerts = analyzeSnapshot(
      snapshot({ status: 'OFFLINE' })
    );

    assert.equal(alerts[0].severity, 'critical');
    assert.equal(alerts[0].code, 'device_offline');
  });

  it('warns when all schedules are disabled', () => {
    const alerts = analyzeSnapshot(
      snapshot({ scheduleRules: [{ id: 'sched-1', name: 'Morning', enabled: false }] })
    );

    assert.equal(alerts[0].code, 'no_enabled_schedules');
  });

  it('warns when current watering status is unavailable', () => {
    const alerts = analyzeSnapshot(snapshot(undefined, { status: 'UNKNOWN' }));

    assert.equal(alerts[0].code, 'schedule_status_unavailable');
  });

  it('can flag disabled zones when policy asks for it', () => {
    const alerts = analyzeSnapshot(
      snapshot({ zones: [{ id: 'zone-1', zoneNumber: 1, name: 'Citrus', enabled: false }] }),
      { warnWhenAnyZoneDisabled: true, maxRemainingWateringMinutes: 120 }
    );

    assert.equal(alerts[0].code, 'zone_disabled');
  });

  it('warns on unusually long watering runs', () => {
    const alerts = analyzeSnapshot(
      snapshot(undefined, { status: 'PROCESSING', zoneNumber: 1, remainingDuration: 3 * 60 * 60 })
    );

    assert.equal(alerts[0].code, 'long_watering_run');
  });
});

describe('getWateringReview', () => {
  it('summarizes recent watering and weather events', async () => {
    const review = await getWateringReview(
      {
        async getInfo() {
          return account;
        },
        async getDeviceEvents(deviceId: string, startTs: number, endTs: number) {
          assert.equal(deviceId, 'dev-1');
          assert.equal(endTs - startTs, 2 * 24 * 60 * 60 * 1000);
          return [
            {
              eventDate: endTs - 1000,
              topic: 'WATERING',
              subType: 'ZONE_COMPLETED',
              summary: 'Citrus completed watering at 05:30 AM (PDT) for 12 minutes.',
            },
            {
              eventDate: endTs - 2000,
              topic: 'WATERING',
              subType: 'ZONE_STOPPED',
              summary: 'Citrus stopped watering at 05:15 AM (PDT) for 1 minutes.',
            },
            {
              eventDate: endTs - 3000,
              topic: 'WATERING',
              subType: 'SCHEDULE_COMPLETED',
              summary: 'Morning ran for 12 minutes.',
            },
            {
              eventDate: endTs - 4000,
              category: 'SCHEDULE',
              subType: 'SCHEDULE_RULE_SKIP_ADDED',
              summary: 'Morning was skipped because rain was observed.',
            },
          ];
        },
      },
      { now: new Date('2026-06-02T00:00:00Z') }
    );

    assert.equal(review.devices[0].completedZoneRuns, 1);
    assert.equal(review.devices[0].stoppedZoneRuns, 1);
    assert.equal(review.devices[0].completedScheduleRuns, 1);
    assert.equal(review.devices[0].weatherSkipCount, 1);
    assert.equal(review.devices[0].estimatedWateringMinutes, 13);
    assert.match(review.devices[0].notes.join('\n'), /weather\/rain skip/);
    assert.match(review.devices[0].notes.join('\n'), /stopped watering/);
  });

  it('keeps reporting when event history is unavailable', async () => {
    const review = await getWateringReview({
      async getInfo() {
        return account;
      },
      async getDeviceEvents() {
        throw new Error('temporary Rachio error');
      },
    });

    assert.equal(review.devices[0].eventCount, 0);
    assert.match(review.devices[0].notes.join('\n'), /event history unavailable/);
  });
});

function snapshot(
  deviceOverrides: Partial<IrrigationSnapshot['devices'][number]['device']> = {},
  schedule = { status: 'NOT_RUNNING' }
): IrrigationSnapshot {
  return {
    account: { username: 'nik', email: 'nik@example.com' },
    devices: [
      {
        device: {
          ...account.devices[0],
          ...deviceOverrides,
        },
        currentSchedule: schedule,
      },
    ],
  };
}
