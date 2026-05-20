import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database';

export interface RolePermissionAttributes {
  roleId: string;
  permissionId: string;
}

export class RolePermission
  extends Model<RolePermissionAttributes>
  implements RolePermissionAttributes
{
  declare roleId: string;
  declare permissionId: string;
}

RolePermission.init(
  {
    roleId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: 'roles', key: 'id' },
      onDelete: 'CASCADE',
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: 'permissions', key: 'id' },
      onDelete: 'CASCADE',
    },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    timestamps: false,
  },
);

export default RolePermission;
