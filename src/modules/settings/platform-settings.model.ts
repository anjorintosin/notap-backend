import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export const PLATFORM_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export interface PlatformSettingsAttributes {
  id: string;
  defaultComplianceFeeNGN: number;
  updatedByUserId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlatformSettingsCreationAttributes
  extends Optional<PlatformSettingsAttributes, 'id' | 'updatedByUserId'> {}

export class PlatformSettings
  extends Model<PlatformSettingsAttributes, PlatformSettingsCreationAttributes>
  implements PlatformSettingsAttributes
{
  declare id: string;
  declare defaultComplianceFeeNGN: number;
  declare updatedByUserId?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PlatformSettings.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: PLATFORM_SETTINGS_ID,
    },
    defaultComplianceFeeNGN: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: false,
      defaultValue: 150000,
    },
    updatedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'platform_settings',
    timestamps: true,
  },
);

export default PlatformSettings;
