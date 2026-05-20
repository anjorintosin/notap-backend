import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface NotificationAttributes {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'submission_update' | 'payment_reminder' | 'system_alert';
  isRead: boolean;
  link?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'id' | 'isRead'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  declare id: string;
  declare userId: string;
  declare title: string;
  declare message: string;
  declare type: 'submission_update' | 'payment_reminder' | 'system_alert';
  declare isRead: boolean;
  declare link?: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('submission_update', 'payment_reminder', 'system_alert'),
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'notifications',
    timestamps: true,
  }
);

export default Notification;
