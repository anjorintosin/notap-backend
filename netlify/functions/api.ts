import serverless from 'serverless-http';
import app from '../../dist/app';

export const handler = serverless(app, {
  binary: [
    'image/*',
    'application/pdf',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
});
