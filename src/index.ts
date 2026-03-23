import 'dotenv/config';
import { client } from './rachio';

const TOKEN = process.env.RACHIO_API_KEY!;
if (!TOKEN) {
  console.error('RACHIO_API_KEY not set');
  process.exit(1);
}

const rachio = client(TOKEN);
const cmd = process.argv[2] || 'status';

async function main() {
  switch (cmd) {
    case 'status': {
      const info = await rachio.getInfo();
      console.log(`Account: ${info.username} (${info.email})`);
      for (const device of info.devices) {
        console.log(`\nDevice: ${device.name} [${device.id}]`);
        console.log(`  Model: ${device.model}, Status: ${device.status}`);
        console.log(`  Zones (${device.zones.length}):`);
        for (const z of device.zones) {
          const enabled = z.enabled ? '✅' : '⬜';
          console.log(`    ${enabled} Zone ${z.zoneNumber}: ${z.name || 'Unnamed'} [${z.id}]`);
        }
        const sched = await rachio.getCurrentSchedule(device.id);
        if (sched.status === 'PROCESSING') {
          console.log(`  🚿 Currently running: Zone ${sched.zoneNumber} — ${Math.round(sched.remainingDuration / 60)}min remaining`);
        } else {
          console.log(`  💤 Not currently running`);
        }
      }
      break;
    }

    case 'zones': {
      const info = await rachio.getInfo();
      for (const device of info.devices) {
        for (const z of device.zones) {
          console.log(`${z.zoneNumber}\t${z.name || 'Unnamed'}\t${z.id}`);
        }
      }
      break;
    }

    case 'schedules': {
      const info = await rachio.getInfo();
      for (const device of info.devices) {
        console.log(`Device: ${device.name}`);
        for (const sr of device.scheduleRules) {
          const days = sr.days?.join(', ') ?? 'flexible';
          console.log(`  📅 ${sr.name} [${sr.id}]`);
          console.log(`     Enabled: ${sr.enabled}, Days: ${days}, Start: ${sr.startTime}`);
        }
      }
      break;
    }

    case 'stop': {
      const info = await rachio.getInfo();
      for (const device of info.devices) {
        await rachio.stopDevice(device.id);
        console.log(`⏹ Stopped all watering on ${device.name}`);
      }
      break;
    }

    default:
      console.log('Commands: status | zones | schedules | stop');
  }
}

main().catch(err => {
  console.error(err.response?.data ?? err.message);
  process.exit(1);
});
