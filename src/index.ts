import 'dotenv/config';
import { runCli } from './cli';

runCli().catch((error) => {
  console.error(error.response?.data ?? error.message);
  process.exit(1);
});
