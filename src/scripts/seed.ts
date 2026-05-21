import sequelize from '../config/database';
import { setupAssociations } from '../config/associations';
import logger from '../shared/utils/logger';
import { ensureDefaultAdmin } from '../shared/services/admin-seed.service';

const seedAdmin = async () => {
  try {
    setupAssociations();
    await sequelize.authenticate();
    logger.info('Database connection established.');

    await sequelize.sync({ alter: true });
    logger.info('Database synchronized.');

    const created = await ensureDefaultAdmin();
    if (!created) {
      logger.info('Admin user already exists. Skipping seed.');
    } else {
      logger.info('Admin user seeded successfully.');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin user:', error);
    process.exit(1);
  }
};

seedAdmin();
