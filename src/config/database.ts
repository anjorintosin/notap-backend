import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import logger from '../shared/utils/logger';

dotenv.config();

function createSequelize(): Sequelize {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const useSsl =
      process.env.DB_SSL === 'true' ||
      /sslmode=require|ssl=true/i.test(databaseUrl);

    return new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: useSsl
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : undefined,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
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
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

const sequelize = createSequelize();

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

export default sequelize;
