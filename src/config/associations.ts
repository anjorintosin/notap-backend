import { User } from '../modules/users/users.model';
import { Organization } from '../modules/organizations/organizations.model';
import { Submission } from '../modules/submissions/submissions.model';
import { Notification } from '../modules/notifications/notifications.model';
import { OrganizationInvitation } from '../modules/invitations/organization-invitations.model';
import { Permission } from '../modules/rbac/permission.model';
import { OrgRole } from '../modules/rbac/role.model';
import { RolePermission } from '../modules/rbac/role-permission.model';

export const setupAssociations = () => {
  // User <-> Organization
  Organization.hasMany(User, { foreignKey: 'organizationId', as: 'users' });
  User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
  User.belongsTo(OrgRole, { foreignKey: 'orgRoleId', as: 'orgRole' });
  OrgRole.hasMany(User, { foreignKey: 'orgRoleId', as: 'users' });
  OrgRole.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

  OrgRole.belongsToMany(Permission, {
    through: RolePermission,
    foreignKey: 'roleId',
    otherKey: 'permissionId',
    as: 'permissions',
  });
  Permission.belongsToMany(OrgRole, {
    through: RolePermission,
    foreignKey: 'permissionId',
    otherKey: 'roleId',
    as: 'roles',
  });

  // Organization <-> Submission (submitting org)
  Organization.hasMany(Submission, { foreignKey: 'organizationId', as: 'submissions' });
  Submission.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

  Submission.belongsTo(Organization, { foreignKey: 'partnerOrganizationId', as: 'partnerOrganization' });
  Submission.belongsTo(Organization, { foreignKey: 'acquirerOrganizationId', as: 'acquirerOrganization' });

  // Invitations
  OrganizationInvitation.belongsTo(Organization, {
    foreignKey: 'invitedByOrganizationId',
    as: 'invitedByOrganization',
  });
  OrganizationInvitation.belongsTo(Submission, {
    foreignKey: 'submissionId',
    as: 'submission',
  });
  OrganizationInvitation.belongsTo(User, {
    foreignKey: 'invitedByUserId',
    as: 'invitedByUser',
  });

  // User <-> Notification
  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  console.log('🔗 Database associations established');
};
