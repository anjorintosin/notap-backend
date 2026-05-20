import { Request, Response, NextFunction } from 'express';
import { Organization } from './organizations.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { RbacService } from '../rbac/rbac.service';
import { User } from '../users/users.model';

function generateTransfereeId(org: Organization) {
  const year = new Date().getFullYear();
  const suffix = org.id.replace(/-/g, '').slice(-6).toUpperCase();
  return `NTP-TRF-${year}-${suffix}`;
}

export class OrganizationsController {
  static async getMine(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const orgId = (authReq.user as any)?.organizationId;
      if (!orgId) {
        return res.json(responseFormatter.success(null));
      }
      const org = await Organization.findByPk(orgId);
      if (!org) return res.status(404).json(responseFormatter.error('Organization not found', 404));
      if (org.type === 'local_partner' && org.status === 'active' && !org.transfereeId) {
        org.transfereeId = generateTransfereeId(org);
        await org.save();
      }
      res.json(responseFormatter.success(org));
    } catch (error) { next(error); }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, type } = req.query;
      const where: any = {};
      if (status) where.status = status;
      if (type) where.type = type;
      
      const orgs = await Organization.findAll({ where });
      res.json(responseFormatter.success(orgs));
    } catch (error) { next(error); }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await Organization.findByPk(req.params.id as string);
      if (!org) return res.status(404).json(responseFormatter.error('Organization not found', 404));
      
      org.status = 'active';
      if (org.type === 'local_partner' && !org.transfereeId) {
        org.transfereeId = generateTransfereeId(org);
      }
      await org.save();

      const tenantRole = org.type === 'local_partner' ? 'partner' : 'acquirer';
      await RbacService.ensureOrgRoles(org.id, tenantRole);
      const orgUsers = await User.findAll({ where: { organizationId: org.id } });
      for (const u of orgUsers) {
        await RbacService.assignOwnerRoleToUser(u);
      }

      res.json(responseFormatter.success(org, 'Organization approved successfully'));
    } catch (error) { next(error); }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await Organization.findByPk(req.params.id as string);
      if (!org) return res.status(404).json(responseFormatter.error('Organization not found', 404));
      
      org.status = 'rejected';
      await org.save();
      
      res.json(responseFormatter.success(org, 'Organization rejected'));
    } catch (error) { next(error); }
  }

  static async listActiveAcquirers(req: Request, res: Response, next: NextFunction) {
    try {
      const orgs = await Organization.findAll({
        where: { type: 'acquirer', status: 'active' },
        order: [['name', 'ASC']],
      });
      res.json(responseFormatter.success(orgs));
    } catch (error) { next(error); }
  }

  static async listActivePartners(req: Request, res: Response, next: NextFunction) {
    try {
      const orgs = await Organization.findAll({
        where: { type: 'local_partner', status: 'active' },
        order: [['name', 'ASC']],
      });
      res.json(responseFormatter.success(orgs));
    } catch (error) { next(error); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await Organization.create({
        ...req.body,
        status: 'pending'
      });
      res.status(201).json(responseFormatter.success(org, 'Organization registration submitted', 201));
    } catch (error) { next(error); }
  }
}
