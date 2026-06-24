import serverless from 'serverless-http';
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import app from '../../dist/app';

const serverlessHandler = serverless(app, {
  binary: [
    'image/*',
    'application/pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
});

/** Decode base64 bodies Netlify sends so Express can read JSON POST data. */
function normalizeNetlifyEvent(event: HandlerEvent): HandlerEvent {
  if (!event.body || !event.isBase64Encoded) {
    return event;
  }

  const contentType = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    return event;
  }

  return {
    ...event,
    body: Buffer.from(event.body, 'base64').toString('utf8'),
    isBase64Encoded: false,
  };
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const normalized = normalizeNetlifyEvent(event);

  // Ensure JSON POSTs have a content-type when clients omit it
  if (
    normalized.body &&
    typeof normalized.body === 'string' &&
    normalized.body.trim().startsWith('{') &&
    !normalized.headers?.['content-type'] &&
    !normalized.headers?.['Content-Type']
  ) {
    normalized.headers = {
      ...normalized.headers,
      'content-type': 'application/json',
    };
  }

  return serverlessHandler(normalized, context);
};
