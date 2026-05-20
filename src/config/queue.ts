import { Queue, Worker, Job } from 'bullmq';
import IORedis, { RedisOptions } from 'ioredis';
import logger from '../shared/utils/logger';
import { ComplianceService } from '../modules/compliance/compliance.service';

let redisConnection: IORedis | null = null;
let submissionQueue: Queue | null = null;

function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    return new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };

  if (process.env.REDIS_PASSWORD) {
    options.password = process.env.REDIS_PASSWORD;
  }

  return new IORedis(options);
}

function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = createRedisConnection();
  }
  return redisConnection;
}

export function getSubmissionQueue(): Queue {
  if (!submissionQueue) {
    submissionQueue = new Queue('submission-processing', { connection: getRedisConnection() });
  }
  return submissionQueue;
}

function shouldRunQueueWorker(): boolean {
  if (process.env.ENABLE_QUEUE_WORKER === 'false') return false;
  if (process.env.ENABLE_QUEUE_WORKER === 'true') return true;
  return !process.env.VERCEL;
}

/** On Vercel (no worker), run compliance inline so submissions still process. */
export async function enqueueSubmissionProcessing(submissionId: string): Promise<void> {
  if (shouldRunQueueWorker()) {
    await getSubmissionQueue().add('process-submission', { submissionId });
    return;
  }
  await ComplianceService.processSubmission(submissionId);
}

export const startWorker = () => {
  const worker = new Worker(
    'submission-processing',
    async (job: Job) => {
      const { submissionId } = job.data;
      logger.info(`Processing compliance engine for submission ${submissionId}`);

      await ComplianceService.processSubmission(submissionId);
    },
    { connection: getRedisConnection() }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
  });

  return worker;
};
