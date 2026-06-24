import sequelize from '../config/database';
import { setupAssociations } from '../config/associations';
import logger from '../shared/utils/logger';
import { runSchemaMigrations } from '../shared/db/schema-migrate';

async function migrate() {
  try {
    setupAssociations();
    await sequelize.authenticate();
    logger.info('Database connection established.');

    await runSchemaMigrations();
    logger.info('Schema migrations complete.');

    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
