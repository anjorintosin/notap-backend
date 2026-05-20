import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface UserAttributes {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'partner' | 'acquirer';
  organizationId?: string;
  orgRoleId?: string | null;
  department?: string | null;
  isActive: boolean;
  /** Set when the user chooses their password (signup or invite activation). */
  passwordSetAt?: Date | null;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: 'admin' | 'partner' | 'acquirer';
  declare organizationId?: string;
  declare orgRoleId?: string | null;
  declare department?: string | null;
  declare isActive: boolean;
  declare passwordSetAt?: Date | null;
  declare resetPasswordToken?: string;
  declare resetPasswordExpires?: Date;
  declare lastLoginAt?: Date;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'partner', 'acquirer'),
      allowNull: false,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    orgRoleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'roles', key: 'id' },
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    passwordSetAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
  }
);

export default User;
