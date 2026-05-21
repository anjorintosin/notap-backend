import { Sequelize } from 'sequelize';
import pg from 'pg';
import dotenv from 'dotenv';
import logger from '../shared/utils/logger';
import { getDatabaseSslDialectOptions } from './database-ssl';

dotenv.config();

const pool = {
  max: 5,
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

  if (databaseUrl) {
    return new Sequelize(databaseUrl, baseOptions());
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
      `PostgreSQL connected (${ssl ? 'SSL enabled' : 'SSL disabled'})`
    );
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

export default sequelize;
