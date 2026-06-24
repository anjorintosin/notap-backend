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

/** Decode base64 bodies Netlify may send so Express JSON parsing works. */
function normalizeNetlifyEvent(event: HandlerEvent): HandlerEvent {
  if (!event.body || !event.isBase64Encoded) {
    return event;
  }

  const contentType = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
  const isTextOrJson =
    contentType.includes('json') ||
    contentType.includes('text') ||
    contentType.includes('application/x-www-form-urlencoded');

  if (!isTextOrJson) {
    return event;
  }

  return {
    ...event,
    body: Buffer.from(event.body, 'base64').toString('utf8'),
    isBase64Encoded: false,
  };
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  return serverlessHandler(normalizeNetlifyEvent(event), context);
};
