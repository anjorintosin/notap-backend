import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export type PermissionScope = 'admin' | 'partner' | 'acquirer';

export interface PermissionAttributes {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  module: string;
  scope: PermissionScope;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermissionCreationAttributes
  extends Optional<PermissionAttributes, 'id' | 'description'> {}

export class Permission
  extends Model<PermissionAttributes, PermissionCreationAttributes>
  implements PermissionAttributes
{
  declare id: string;
  declare code: string;
  declare label: string;
  declare description?: string | null;
  declare module: string;
  declare scope: PermissionScope;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Permission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    module: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    scope: {
      type: DataTypes.ENUM('admin', 'partner', 'acquirer'),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'permissions',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['code', 'scope'],
        name: 'permissions_code_scope_unique',
      },
    ],
  },
);

export default Permission;
