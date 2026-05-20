import app from './app';
import { isServerlessRuntime, runBootstrap } from './bootstrap';

let ready = false;

export async function getExpressApp() {
  if (!ready) {
    await runBootstrap(isServerlessRuntime() ? 'serverless' : 'server');
    ready = true;
  }
  return app;
}
