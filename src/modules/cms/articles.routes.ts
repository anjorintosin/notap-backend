import { Router, Request, Response, NextFunction } from 'express';
import { Article } from './articles.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { authenticate, AuthRequest } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/rbac.middleware';
import { loadPermissions, requirePermission } from '../../shared/middleware/permission.middleware';
import { upload } from '../../shared/middleware/upload.middleware';

const router = Router();

// Admin: all articles (drafts + published) — must be before /:slug
router.get('/manage', authenticate, loadPermissions, authorize('admin'), requirePermission('cms.manage'), async (req, res, next) => {
  try {
    const articles = await Article.findAll({ order: [['createdAt', 'DESC']] });
    res.json(responseFormatter.success(articles));
  } catch (error) { next(error); }
});

router.get('/manage/:id', authenticate, loadPermissions, authorize('admin'), requirePermission('cms.manage'), async (req, res, next) => {
  try {
    const article = await Article.findByPk(req.params.id as string);
    if (!article) return res.status(404).json(responseFormatter.error('Article not found', 404));
    res.json(responseFormatter.success(article));
  } catch (error) { next(error); }
});

// Public routes
router.get('/', async (req, res, next) => {
  try {
    const articles = await Article.findAll({ where: { status: 'published' }, order: [['publishedAt', 'DESC']] });
    res.json(responseFormatter.success(articles));
  } catch (error) { next(error); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const article = await Article.findOne({ where: { slug: req.params.slug } });
    if (!article) return res.status(404).json(responseFormatter.error('Article not found', 404));
    res.json(responseFormatter.success(article));
  } catch (error) { next(error); }
});

// Admin routes
router.use(authenticate, loadPermissions, authorize('admin'), requirePermission('cms.manage'));

router.post('/', upload.single('featuredImage'), async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    const { title, content, category, status, summary } = req.body;
    const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    
    const article = await Article.create({
      title,
      slug,
      content,
      summary,
      category,
      status: status || 'draft',
      authorId: authReq.user!.id,
      featuredImage: req.file?.path,
      publishedAt: status === 'published' ? new Date() : undefined
    });

    res.status(201).json(responseFormatter.success(article, 'Article created successfully', 201));
  } catch (error) { next(error); }
});

router.patch('/:id', upload.single('featuredImage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const article = await Article.findByPk(req.params.id as string);
    if (!article) return res.status(404).json(responseFormatter.error('Article not found', 404));

    const { title, content, category, status, summary } = req.body;
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) {
      updateData.title = title;
      updateData.slug = String(title).toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    }
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (summary !== undefined) updateData.summary = summary;
    if (status !== undefined) updateData.status = status;
    if (req.file) updateData.featuredImage = req.file.path;
    if (updateData.status === 'published' && article.status !== 'published') {
      updateData.publishedAt = new Date();
    }
    if (updateData.status === 'draft' && article.status === 'published') {
      updateData.publishedAt = null;
    }

    await article.update(updateData);
    await article.reload();
    res.json(responseFormatter.success(article, 'Article updated successfully'));
  } catch (error) { next(error); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const article = await Article.findByPk(req.params.id as string);
    if (!article) return res.status(404).json(responseFormatter.error('Article not found', 404));
    await article.destroy();
    res.json(responseFormatter.success(null, 'Article deleted successfully'));
  } catch (error) { next(error); }
});

export default router;
