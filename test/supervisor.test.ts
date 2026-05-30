import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeSnapshot, getIrrigationSnapshot } from '../src/supervisor';
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
