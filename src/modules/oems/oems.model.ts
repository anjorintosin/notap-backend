import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface OEMAttributes {
  id: string;
  name: string;
  country: string;
  category: string;
  website?: string;
  complianceEmail: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OEMCreationAttributes extends Optional<OEMAttributes, 'id'> {}

export class OEM extends Model<OEMAttributes, OEMCreationAttributes> implements OEMAttributes {
  declare id: string;
  declare name: string;
  declare country: string;
  declare category: string;
  declare website?: string;
  declare complianceEmail: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

OEM.init(
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
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    complianceEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
  },
  {
    sequelize,
    tableName: 'oems',
    timestamps: true,
  }
);

export default OEM;
