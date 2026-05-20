import { Router, Request, Response, NextFunction } from 'express';
import { OEM } from './oems.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const oems = await OEM.findAll({ order: [['name', 'ASC']] });
    res.json(responseFormatter.success(oems));
  } catch (error) { next(error); }
});

router.post('/', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, country, category, website, complianceEmail, contactEmail } = req.body;
    const oem = await OEM.create({
      name,
      country,
      category,
      website,
      complianceEmail: complianceEmail || contactEmail,
    });
    res.status(201).json(responseFormatter.success(oem, 'OEM added to registry', 201));
  } catch (error) { next(error); }
});

export default router;
