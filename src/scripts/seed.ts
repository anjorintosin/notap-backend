import bcrypt from 'bcrypt';
import User from '../modules/users/users.model';
import Organization from '../modules/organizations/organizations.model';
import Submission from '../modules/submissions/submissions.model';
import sequelize from '../config/database';
import logger from '../shared/utils/logger';

const seedAdmin = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established.');

    // Sync models in order of dependency
    await Organization.sync({ alter: true });
    await User.sync({ alter: true });
    await Submission.sync({ alter: true });
    
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized.');

    const adminEmail = 'admin@notap.gov.ng';
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });

    if (existingAdmin) {
      logger.info('Admin user already exists. Skipping seed.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    await User.create({
      name: 'NOTAP Administrator',
      email: adminEmail,
      passwordHash: passwordHash,
      role: 'admin',
      isActive: true
    });

    logger.info('✅ Admin user seeded successfully!');
    logger.info(`Email: ${adminEmail}`);
    logger.info('Password: password123');
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error seeding admin user:', error);
    process.exit(1);
  }
};

seedAdmin();
