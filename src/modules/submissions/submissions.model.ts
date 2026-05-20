import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

export interface SubmissionAttributes {
  id: string;
  organizationId: string;
  createdByRole?: 'partner' | 'acquirer';
  partnerOrganizationId?: string | null;
  acquirerOrganizationId?: string | null;
  invitedPartnerEmail?: string | null;
  invitedAcquirerEmail?: string | null;
  invitedPartnerName?: string | null;
  invitedAcquirerName?: string | null;
  counterpartyStatus?: 'linked' | 'invite_sent' | 'registered';
  acquirerName: string;
  oemName: string;
  oemCountry?: string;
  technologyName?: string;
  category?: string;
  version?: string;
  technology: string;
  agreementFee: string;
  currency: string;
  signingDate?: Date;
  effectiveDate?: Date;
  notes?: string;
  agreementUrl?: string;
  taxClearanceUrl?: string;
  complianceFeeNGN?: number;
  complianceFeeIsManual?: boolean;
  paymentStatus: 'unpaid' | 'pending' | 'paid';
  paymentMethod?: 'remita' | 'bank_transfer';
  status: 'pending_review' | 'approved' | 'returned' | 'rejected' | 'draft';
  submittedDate: Date;
  expiryDate?: Date;
  reviewComment?: string;
  certificateId?: string;
  certificateVerificationToken?: string | null;
  certificateIssuedAt?: Date | null;
  remitaRrr?: string;
  isRenewal?: boolean;
  /** Active renewal workflow — main status stays approved while cert remains valid */
  renewalStatus?: 'pending_review' | 'pending_payment' | 'returned' | 'rejected' | null;
  renewalReference?: string;
  previousCertificateId?: string;
  renewalPrevFeeReceiptUrl?: string;
  renewalWhtCertificateUrl?: string;
  renewalVatCertificateUrl?: string;
  renewalProjectFeeUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SubmissionCreationAttributes extends Optional<SubmissionAttributes, 'id' | 'status' | 'submittedDate'> {}

export class Submission extends Model<SubmissionAttributes, SubmissionCreationAttributes> implements SubmissionAttributes {
  declare id: string;
  declare organizationId: string;
  declare createdByRole?: 'partner' | 'acquirer';
  declare partnerOrganizationId?: string | null;
  declare acquirerOrganizationId?: string | null;
  declare invitedPartnerEmail?: string | null;
  declare invitedAcquirerEmail?: string | null;
  declare invitedPartnerName?: string | null;
  declare invitedAcquirerName?: string | null;
  declare counterpartyStatus?: 'linked' | 'invite_sent' | 'registered';
  declare acquirerName: string;
  declare oemName: string;
  declare oemCountry?: string;
  declare technologyName?: string;
  declare category?: string;
  declare version?: string;
  declare technology: string;
  declare signingDate?: Date;
  declare effectiveDate?: Date;
  declare notes?: string;
  declare agreementFee: string;
  declare currency: string;
  declare agreementUrl?: string;
  declare taxClearanceUrl?: string;
  declare complianceFeeNGN?: number;
  declare complianceFeeIsManual?: boolean;
  declare paymentStatus: 'unpaid' | 'pending' | 'paid';
  declare paymentMethod?: 'remita' | 'bank_transfer';
  declare status: 'pending_review' | 'approved' | 'returned' | 'rejected' | 'draft';
  declare submittedDate: Date;
  declare expiryDate?: Date;
  declare reviewComment?: string;
  declare certificateId?: string;
  declare certificateVerificationToken?: string | null;
  declare certificateIssuedAt?: Date | null;
  declare remitaRrr?: string;
  declare isRenewal?: boolean;
  declare renewalStatus?: 'pending_review' | 'pending_payment' | 'returned' | 'rejected' | null;
  declare renewalReference?: string;
  declare previousCertificateId?: string;
  declare renewalPrevFeeReceiptUrl?: string;
  declare renewalWhtCertificateUrl?: string;
  declare renewalVatCertificateUrl?: string;
  declare renewalProjectFeeUrl?: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Submission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id',
      },
    },
    createdByRole: {
      type: DataTypes.ENUM('partner', 'acquirer'),
      allowNull: true,
      defaultValue: 'partner',
    },
    partnerOrganizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
    },
    acquirerOrganizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
    },
    invitedPartnerEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invitedAcquirerEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invitedPartnerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invitedAcquirerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    counterpartyStatus: {
      type: DataTypes.ENUM('linked', 'invite_sent', 'registered'),
      allowNull: true,
      defaultValue: 'linked',
    },
    acquirerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    oemName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    oemCountry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    technologyName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    version: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    technology: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    signingDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    agreementFee: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'NGN',
    },
    agreementUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    taxClearanceUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    complianceFeeNGN: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
    },
    complianceFeeIsManual: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    paymentStatus: {
      type: DataTypes.ENUM('unpaid', 'pending', 'paid'),
      defaultValue: 'unpaid',
    },
    paymentMethod: {
      type: DataTypes.ENUM('remita', 'bank_transfer'),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending_review', 'approved', 'returned', 'rejected', 'draft'),
      defaultValue: 'pending_review',
    },
    submittedDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    certificateId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    certificateVerificationToken: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
    },
    certificateIssuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    remitaRrr: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isRenewal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    renewalStatus: {
      type: DataTypes.ENUM('pending_review', 'pending_payment', 'returned', 'rejected'),
      allowNull: true,
    },
    renewalReference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    previousCertificateId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    renewalPrevFeeReceiptUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    renewalWhtCertificateUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    renewalVatCertificateUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    renewalProjectFeeUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'submissions',
    timestamps: true,
  }
);

export default Submission;
