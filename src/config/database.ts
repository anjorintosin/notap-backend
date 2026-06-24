import { Sequelize } from 'sequelize';
import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../shared/utils/logger';
import { getDatabaseSslDialectOptions } from './database-ssl';
import { parsePostgresUrl } from './database-url';
import { isServerlessRuntime } from './runtime';

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
  const databaseUrl = process.env.DATABASE_URL;

  // Use discrete fields so dialectOptions.ssl (with ca.pem) is not overridden by URL sslmode
  if (databaseUrl) {
    const { host, port, database, username, password } = parsePostgresUrl(databaseUrl);
    return new Sequelize(database, username, password, {
      host,
      port,
      ...baseOptions(),
    });
  }

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  const dbName = process.env.DB_NAME || 'notap_db';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || '';

  return new Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
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
