import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface OrganizationInvitationAttributes {
  id: string;
  email: string;
  inviteeName?: string | null;
  intendedRole: 'local_partner' | 'acquirer';
  invitedByUserId: string;
  invitedByOrganizationId: string;
  submissionId?: string | null;
  token: string;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  acceptedOrganizationId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationInvitationCreationAttributes
  extends Optional<OrganizationInvitationAttributes, 'id' | 'status' | 'submissionId' | 'acceptedOrganizationId'> {}

export class OrganizationInvitation
  extends Model<OrganizationInvitationAttributes, OrganizationInvitationCreationAttributes>
  implements OrganizationInvitationAttributes
{
  declare id: string;
  declare email: string;
  declare inviteeName?: string | null;
  declare intendedRole: 'local_partner' | 'acquirer';
  declare invitedByUserId: string;
  declare invitedByOrganizationId: string;
  declare submissionId?: string | null;
  declare token: string;
  declare expiresAt: Date;
  declare status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  declare acceptedOrganizationId?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

OrganizationInvitation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    inviteeName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    intendedRole: {
      type: DataTypes.ENUM('local_partner', 'acquirer'),
      allowNull: false,
    },
    invitedByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    invitedByOrganizationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'organizations', key: 'id' },
    },
    submissionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'submissions', key: 'id' },
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'expired', 'cancelled'),
      defaultValue: 'pending',
    },
    acceptedOrganizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'organization_invitations',
    timestamps: true,
  },
);

export default OrganizationInvitation;
