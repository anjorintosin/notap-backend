import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface OrgRoleAttributes {
  id: string;
  organizationId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  isOwner: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrgRoleCreationAttributes
  extends Optional<OrgRoleAttributes, 'id' | 'description' | 'isSystem' | 'isOwner'> {}

export class OrgRole
  extends Model<OrgRoleAttributes, OrgRoleCreationAttributes>
  implements OrgRoleAttributes
{
  declare id: string;
  declare organizationId?: string | null;
  declare name: string;
  declare slug: string;
  declare description?: string | null;
  declare isSystem: boolean;
  declare isOwner: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

OrgRole.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    isOwner: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'roles',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['organizationId', 'slug'] },
    ],
  },
);

export default OrgRole;
