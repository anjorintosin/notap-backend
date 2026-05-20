import { Op } from 'sequelize';
import { Permission, PermissionScope } from './permission.model';
import { OrgRole } from './role.model';
import { RolePermission } from './role-permission.model';
import { User } from '../users/users.model';
import {
  PERMISSION_CATALOG,
  PLATFORM_ROLE_TEMPLATES,
  PARTNER_ROLE_TEMPLATES,
  ACQUIRER_ROLE_TEMPLATES,
  DefaultRoleTemplate,
} from './rbac.catalog';
import { AppError } from '../../shared/utils/app-error';
import sequelize from '../../config/database';

export type UserAuthContext = {
  orgRoleId?: string | null;
  orgRoleName?: string | null;
  isOwner: boolean;
  permissions: string[];
};

export class RbacService {
  /**
   * Drop legacy UNIQUE(code) constraints/indexes left by sequelize.sync alter.
   * Permissions must be unique per (code, scope), not code alone.
   */
  static async ensurePermissionSchema(): Promise<void> {
    await sequelize.query(`
      DO $fix$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'public.permissions'::regclass
            AND contype = 'u'
            AND conname ~ '^permissions_code_key'
        LOOP
          EXECUTE format('ALTER TABLE permissions DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
      END
      $fix$;
    `);

    const [indexes] = (await sequelize.query(`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'permissions'
        AND indexname ~ '^permissions_code_key'
    `)) as [{ name: string }[], unknown];

    for (const row of indexes || []) {
      if (row?.name) {
        await sequelize.query(`DROP INDEX IF EXISTS "${row.name}"`);
      }
    }

    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS permissions_code_scope_unique ON permissions (code, scope)`,
    );
  }

  static async seedPermissions(): Promise<void> {
    await this.ensurePermissionSchema();

    for (const row of PERMISSION_CATALOG) {
      const existing = await Permission.findOne({
        where: { code: row.code, scope: row.scope },
      });
      if (existing) {
        await existing.update({
          label: row.label,
          description: row.description,
          module: row.module,
        });
        continue;
      }

      await Permission.create({
        code: row.code,
        label: row.label,
        description: row.description,
        module: row.module,
        scope: row.scope,
      });
    }
  }

  static scopeForTenant(role: 'admin' | 'partner' | 'acquirer'): PermissionScope {
    return role;
  }

  static async listPermissions(scope: PermissionScope): Promise<Permission[]> {
    return Permission.findAll({
      where: { scope },
      order: [
        ['module', 'ASC'],
        ['label', 'ASC'],
      ],
    });
  }

  static async getPermissionIdsByCodes(codes: string[], scope: PermissionScope): Promise<string[]> {
    if (!codes.length) return [];
    const rows = await Permission.findAll({
      where: { code: { [Op.in]: codes }, scope },
    });
    return rows.map((p) => p.id);
  }

  static async getAllPermissionIdsForScope(scope: PermissionScope): Promise<string[]> {
    const rows = await Permission.findAll({ where: { scope } });
    return rows.map((p) => p.id);
  }

  static async createRoleFromTemplate(
    organizationId: string | null,
    template: DefaultRoleTemplate,
    scope: PermissionScope,
  ): Promise<OrgRole> {
    const [role] = await OrgRole.findOrCreate({
      where: { organizationId, slug: template.slug },
      defaults: {
        organizationId,
        name: template.name,
        slug: template.slug,
        description: template.description,
        isSystem: true,
        isOwner: !!template.isOwner,
      },
    });

    if (template.isOwner) {
      const allIds = await this.getAllPermissionIdsForScope(scope);
      await this.setRolePermissions(role.id, allIds, scope);
    } else if (template.permissionCodes.length) {
      const ids = await this.getPermissionIdsByCodes(template.permissionCodes, scope);
      await this.setRolePermissions(role.id, ids, scope);
    }

    return role;
  }

  static async ensurePlatformRoles(): Promise<void> {
    for (const template of PLATFORM_ROLE_TEMPLATES) {
      await this.createRoleFromTemplate(null, template, 'admin');
    }
  }

  static async ensureOrgRoles(organizationId: string, tenantRole: 'partner' | 'acquirer'): Promise<void> {
    const templates = tenantRole === 'partner' ? PARTNER_ROLE_TEMPLATES : ACQUIRER_ROLE_TEMPLATES;
    const scope = tenantRole;
    for (const template of templates) {
      await this.createRoleFromTemplate(organizationId, template, scope);
    }
  }

  static async getOwnerRole(
    organizationId: string | null,
    scope: PermissionScope,
  ): Promise<OrgRole | null> {
    return OrgRole.findOne({
      where: { organizationId, isOwner: true },
    });
  }

  static async assignOwnerRoleToUser(user: User): Promise<void> {
    const scope = this.scopeForTenant(user.role);
    const orgId = user.role === 'admin' ? null : user.organizationId ?? null;

    if (user.role !== 'admin' && !orgId) return;

    if (user.role === 'admin') {
      await this.ensurePlatformRoles();
    } else {
      await this.ensureOrgRoles(orgId!, user.role as 'partner' | 'acquirer');
    }

    const owner = await this.getOwnerRole(orgId, scope);
    if (owner && !user.orgRoleId) {
      await user.update({ orgRoleId: owner.id });
    }
  }

  static async migrateUsersWithoutOrgRole(): Promise<number> {
    const users = await User.findAll({ where: { orgRoleId: { [Op.is]: null } } });
    let count = 0;
    for (const user of users) {
      await this.assignOwnerRoleToUser(user);
      count += 1;
    }
    return count;
  }

  static async setRolePermissions(
    roleId: string,
    permissionIds: string[],
    scope: PermissionScope,
  ): Promise<void> {
    const valid = await Permission.findAll({
      where: { id: { [Op.in]: permissionIds }, scope },
    });
    const validIds = valid.map((p) => p.id);
    await RolePermission.destroy({ where: { roleId } });
    if (validIds.length) {
      await RolePermission.bulkCreate(
        validIds.map((permissionId) => ({ roleId, permissionId })),
      );
    }
  }

  static async getRolePermissionCodes(role: OrgRole): Promise<string[]> {
    if (role.isOwner) {
      const scope =
        role.organizationId === null || role.organizationId === undefined
          ? 'admin'
          : await this.inferOrgScope(role.organizationId);
      const perms = await Permission.findAll({ where: { scope } });
      return perms.map((p) => p.code);
    }
    const roleWithPerms = await OrgRole.findByPk(role.id, {
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });
    const perms = (roleWithPerms as any)?.permissions as Permission[] | undefined;
    return (perms || []).map((p) => p.code);
  }

  static async inferOrgScope(organizationId: string): Promise<PermissionScope> {
    const { Organization } = await import('../organizations/organizations.model');
    const org = await Organization.findByPk(organizationId);
    if (org?.type === 'local_partner') return 'partner';
    return 'acquirer';
  }

  static async getUserAuthContext(userId: string): Promise<UserAuthContext> {
    const user = await User.findByPk(userId, {
      include: [{ model: OrgRole, as: 'orgRole' }],
    });
    if (!user) {
      return { permissions: [], isOwner: false };
    }

    let orgRole = (user as any).orgRole as OrgRole | undefined;
    if (!orgRole && user.orgRoleId) {
      orgRole = (await OrgRole.findByPk(user.orgRoleId)) || undefined;
    }
    if (!orgRole) {
      await this.assignOwnerRoleToUser(user);
      await user.reload({ include: [{ model: OrgRole, as: 'orgRole' }] });
      orgRole = (user as any).orgRole as OrgRole | undefined;
    }

    if (!orgRole) {
      return { permissions: [], isOwner: false };
    }

    const permissions = await this.getRolePermissionCodes(orgRole);
    return {
      orgRoleId: orgRole.id,
      orgRoleName: orgRole.name,
      isOwner: orgRole.isOwner,
      permissions: [...new Set(permissions)],
    };
  }

  static async listRolesForCaller(
    tenantRole: 'admin' | 'partner' | 'acquirer',
    organizationId?: string | null,
  ): Promise<OrgRole[]> {
    const orgFilter =
      tenantRole === 'admin' ? { organizationId: { [Op.is]: null } } : { organizationId };

    return OrgRole.findAll({
      where: orgFilter,
      order: [
        ['isOwner', 'DESC'],
        ['name', 'ASC'],
      ],
    });
  }

  static async getRoleById(roleId: string): Promise<OrgRole | null> {
    return OrgRole.findByPk(roleId, {
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });
  }

  static assertRoleInScope(
    role: OrgRole,
    tenantRole: 'admin' | 'partner' | 'acquirer',
    organizationId?: string | null,
  ): void {
    if (tenantRole === 'admin') {
      if (role.organizationId != null) {
        throw new AppError('Role not found', 404);
      }
      return;
    }
    if (role.organizationId !== organizationId) {
      throw new AppError('Role not found', 404);
    }
  }

  static async createCustomRole(
    tenantRole: 'admin' | 'partner' | 'acquirer',
    organizationId: string | null,
    data: { name: string; description?: string; permissionIds: string[] },
  ): Promise<OrgRole> {
    const scope = this.scopeForTenant(tenantRole);
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    const existing = await OrgRole.findOne({
      where: { organizationId, slug },
    });
    if (existing) throw new AppError('A role with this name already exists', 400);

    const role = await OrgRole.create({
      organizationId,
      name: data.name,
      slug: `${slug}-${Date.now().toString(36)}`,
      description: data.description,
      isSystem: false,
      isOwner: false,
    });

    await this.setRolePermissions(role.id, data.permissionIds, scope);
    return (await this.getRoleById(role.id))!;
  }

  static async updateRole(
    role: OrgRole,
    tenantRole: 'admin' | 'partner' | 'acquirer',
    data: { name?: string; description?: string; permissionIds?: string[] },
  ): Promise<OrgRole> {
    if (role.isOwner && data.permissionIds) {
      throw new AppError('Cannot change permissions on the owner role', 400);
    }

    if (data.name) await role.update({ name: data.name });
    if (data.description !== undefined) await role.update({ description: data.description });

    if (data.permissionIds && !role.isOwner) {
      const scope = this.scopeForTenant(tenantRole);
      await this.setRolePermissions(role.id, data.permissionIds, scope);
    }

    return (await this.getRoleById(role.id))!;
  }

  static async deleteRole(role: OrgRole): Promise<void> {
    if (role.isSystem) {
      throw new AppError('System roles cannot be deleted', 400);
    }
    const assigned = await User.count({ where: { orgRoleId: role.id } });
    if (assigned > 0) {
      throw new AppError('Cannot delete a role that is assigned to users', 400);
    }
    await role.destroy();
  }

  static serializeRole(role: OrgRole) {
    const perms = (role as any).permissions as Permission[] | undefined;
    return {
      id: role.id,
      organizationId: role.organizationId,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      isOwner: role.isOwner,
      permissions: perms?.map((p) => ({
        id: p.id,
        code: p.code,
        label: p.label,
        module: p.module,
      })),
      permissionCodes: perms?.map((p) => p.code) ?? [],
    };
  }
}
