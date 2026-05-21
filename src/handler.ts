import app from './app';

/** Express app for Vercel (@vercel/node) and local server. Bootstrap runs via app middleware. */
export async function getExpressApp() {
  return app;
}

export default app;
