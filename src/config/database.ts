import dns from 'dns';
import { Sequelize } from 'sequelize';
import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../shared/utils/logger';
import { getDatabaseSslDialectOptions } from './database-ssl';
import { resolveDatabaseConnectionConfig } from './database-url';
import { isServerlessRuntime } from './runtime';

// Aiven and other managed Postgres endpoints are IPv4; prefer IPv4 on serverless (AWS/Netlify).
if (isServerlessRuntime() && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

const pool = {
  max: isServerlessRuntime() ? 1 : 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
};

function baseOptions() {
  const dialectOptions = getDatabaseSslDialectOptions();
  return {
    dialect: 'postgres' as const,
    dialectModule: pg,
    logging: false,
    pool,
    ...(dialectOptions ? { dialectOptions } : {}),
  };
}

function createSequelize(): Sequelize {
  const { host, port, database, username, password } = resolveDatabaseConnectionConfig();

  return new Sequelize(database, username, password, {
    host,
    port,
    ...baseOptions(),
  });
}

const sequelize = createSequelize();

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    const ssl = getDatabaseSslDialectOptions();
    logger.info(
      `PostgreSQL connected (${ssl ? 'SSL with CA' : 'SSL disabled'})`
    );
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

export default sequelize;
