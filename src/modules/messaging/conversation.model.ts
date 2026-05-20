import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface ConversationAttributes {
  id: string;
  submissionId?: string; // Optional: can be a general support chat
  participantIds: string[]; // Array of user IDs
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConversationCreationAttributes extends Optional<ConversationAttributes, 'id' | 'lastMessage' | 'lastMessageAt'> {}

export class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  declare id: string;
  declare submissionId?: string;
  declare participantIds: string[];
  declare lastMessage?: string;
  declare lastMessageAt?: Date;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Conversation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    submissionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    participantIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
    },
    lastMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'conversations',
    timestamps: true,
  }
);

export default Conversation;
