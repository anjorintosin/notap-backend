import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface OrganizationAttributes {
  id: string;
  name: string;
  type: 'local_partner' | 'acquirer';
  registrationNumber?: string;
  sector?: string;
  address?: string;
  contactEmail: string;
  contactPhone?: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  transfereeId?: string;
  verificationDocumentUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationCreationAttributes extends Optional<OrganizationAttributes, 'id' | 'status'> {}

export class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> implements OrganizationAttributes {
  declare id: string;
  declare name: string;
  declare type: 'local_partner' | 'acquirer';
  declare registrationNumber?: string;
  declare sector?: string;
  declare address?: string;
  declare contactEmail: string;
  declare contactPhone?: string;
  declare status: 'pending' | 'active' | 'suspended' | 'rejected';
  declare transfereeId?: string;
  declare verificationDocumentUrl?: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Organization.init(
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
    type: {
      type: DataTypes.ENUM('local_partner', 'acquirer'),
      allowNull: false,
    },
    registrationNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sector: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'suspended', 'rejected'),
      defaultValue: 'pending',
    },
    transfereeId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    verificationDocumentUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'organizations',
    timestamps: true,
  }
);

export default Organization;
