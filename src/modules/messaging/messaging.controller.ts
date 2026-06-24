import { Request, Response, NextFunction } from 'express';
import { Conversation } from './conversation.model';
import { Message } from './message.model';
import { User } from '../users/users.model';
import { Organization } from '../organizations/organizations.model';
import { Submission } from '../submissions/submissions.model';
import { responseFormatter } from '../../shared/utils/response-formatter';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { AppError } from '../../shared/utils/app-error';
import { Op } from 'sequelize';

function parseTechnologyLabel(technology?: string | null) {
  if (!technology) return { name: '—' };
  const match = technology.match(/^(.+?)\s+\((.+?)(?:,\s*v(.+))?\)\s*$/);
  if (match) return { name: match[1].trim() };
  return { name: technology };
}

function submissionTechnologyName(sub: Submission) {
  const name = sub.get('technologyName') as string | undefined;
  if (name) return name;
  return parseTechnologyLabel(sub.get('technology') as string).name;
}

function getParticipantIds(conversation: Conversation): string[] {
  const ids = conversation.get('participantIds') as string[] | undefined;
  return Array.isArray(ids) ? ids : [];
}

function sortedPair(a: string, b: string) {
  return [a, b].sort();
}

function sameParticipants(ids: string[], a: string, b: string) {
  const sorted = [...ids].sort();
  const pair = sortedPair(a, b);
  return sorted.length === 2 && sorted[0] === pair[0] && sorted[1] === pair[1];
}

async function findExistingConversation(
  userId1: string,
  userId2: string,
  submissionId?: string | null,
) {
  const where: Record<string, unknown> = {
    participantIds: { [Op.contains]: [userId1] },
  };
  if (submissionId) {
    where.submissionId = submissionId;
  } else {
    where.submissionId = { [Op.is]: null };
  }

  const candidates = await Conversation.findAll({ where: where as any });
  return candidates.find((c) =>
    sameParticipants(getParticipantIds(c), userId1, userId2),
  );
}

async function enrichConversations(conversations: Conversation[], currentUserId: string) {
  if (!conversations.length) return [];

  const allIds = new Set<string>();
  conversations.forEach((c) => {
    getParticipantIds(c).forEach((id) => allIds.add(id));
  });

  const users = await User.findAll({
    where: { id: { [Op.in]: [...allIds] } },
    include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const submissionIds = conversations
    .map((c) => c.submissionId)
    .filter(Boolean) as string[];
  const submissions =
    submissionIds.length > 0
      ? await Submission.findAll({ where: { id: { [Op.in]: submissionIds } }, attributes: ['id', 'technology'] })
      : [];
  const subMap = new Map(submissions.map((s) => [s.id, s]));

  return conversations.map((c) => {
    const plain = c.get({ plain: true }) as unknown as Record<string, unknown>;
    const otherId = getParticipantIds(c).find((id) => id !== currentUserId);
    const other = otherId ? userMap.get(otherId) : undefined;
    const org = (other as any)?.organization;
    const sub = c.submissionId ? subMap.get(c.submissionId) : undefined;

    let title = other?.name || 'Conversation';
    if (other?.role === 'partner' && org?.name) title = org.name;
    if (other?.role === 'acquirer' && org?.name) title = org.name;
    if (other?.role === 'admin') title = 'NOTAP Support';

    const subtitle = sub
      ? (sub.get('technology') as string) || `Submission ${String(c.submissionId).slice(0, 8)}`
      : 'General inquiry';

    return {
      ...plain,
      title,
      subtitle,
      otherUserId: otherId,
      otherUserName: other?.name,
      lastMessagePreview: c.lastMessage || null,
    };
  });
}

export class MessagingController {
  static async listConversations(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const conversations = await Conversation.findAll({
        where: {
          participantIds: { [Op.contains]: [authReq.user!.id] },
        },
        order: [
          ['lastMessageAt', 'DESC NULLS LAST'],
          ['updatedAt', 'DESC'],
        ],
      });
      const enriched = await enrichConversations(conversations, authReq.user!.id);
      res.json(responseFormatter.success(enriched));
    } catch (error) {
      next(error);
    }
  }

  static async getMessages(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const conversation = await Conversation.findByPk(req.params.conversationId as string);
      if (!conversation) {
        return res.status(404).json(responseFormatter.error('Conversation not found', 404));
      }
      if (!getParticipantIds(conversation).includes(authReq.user!.id)) {
        return res.status(403).json(responseFormatter.error('Unauthorized', 403));
      }

      const messages = await Message.findAll({
        where: { conversationId: conversation.id },
        order: [['createdAt', 'ASC']],
      });
      res.json(responseFormatter.success(messages));
    } catch (error) {
      next(error);
    }
  }

  static async getOrCreateConversation(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { submissionId, participantId } = req.body as {
        submissionId?: string;
        participantId?: string;
      };

      let otherUserId = participantId;

      if (authReq.user!.role === 'partner' || authReq.user!.role === 'acquirer') {
        const admin = await User.findOne({
          where: { role: 'admin', isActive: true },
          order: [['createdAt', 'ASC']],
        });
        if (!admin) return next(new AppError('No NOTAP administrator available for messaging', 503));
        otherUserId = admin.id;

        if (submissionId) {
          const sub = await Submission.findByPk(submissionId);
          if (!sub) return next(new AppError('Submission not found', 404));
          const orgId = authReq.user!.organizationId;
          if (authReq.user!.role === 'partner') {
            if (sub.organizationId !== orgId && sub.partnerOrganizationId !== orgId) {
              return next(new AppError('You do not have access to this submission', 403));
            }
          } else {
            const canAccess =
              sub.acquirerOrganizationId === orgId ||
              (sub.organizationId === orgId && sub.get('createdByRole') === 'acquirer');
            if (!canAccess) {
              return next(new AppError('You do not have access to this submission', 403));
            }
          }
        }
      } else if (authReq.user!.role === 'admin') {
        if (!participantId) {
          return next(new AppError('participantId is required', 400));
        }
        const contact = await User.findByPk(participantId);
        if (!contact || (contact.role !== 'partner' && contact.role !== 'acquirer')) {
          return next(new AppError('Invalid contact user', 400));
        }
        otherUserId = participantId;
      } else {
        return next(new AppError('Messaging is not available for this role', 403));
      }

      if (submissionId && authReq.user!.role === 'admin') {
        const sub = await Submission.findByPk(submissionId);
        if (!sub) return next(new AppError('Submission not found', 404));
      }

      let conversation = await findExistingConversation(
        authReq.user!.id,
        otherUserId!,
        submissionId || null,
      );

      if (!conversation) {
        conversation = await Conversation.create({
          submissionId: submissionId || undefined,
          participantIds: sortedPair(authReq.user!.id, otherUserId!),
        });
      }

      const [enriched] = await enrichConversations([conversation], authReq.user!.id);
      res.json(responseFormatter.success(enriched));
    } catch (error) {
      next(error);
    }
  }

  /** Partner or acquirer: open NOTAP support thread. Admin: must pass participantId. */
  static async startConversation(req: Request, res: Response, next: NextFunction) {
    return MessagingController.getOrCreateConversation(req, res, next);
  }

  static async sendMessage(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      const { content } = req.body;
      if (!content?.trim()) {
        return res.status(400).json(responseFormatter.error('Message content is required', 400));
      }

      const conversation = await Conversation.findByPk(req.params.conversationId as string);
      if (!conversation) {
        return res.status(404).json(responseFormatter.error('Conversation not found', 404));
      }

      const participantIds = getParticipantIds(conversation);
      if (!participantIds.includes(authReq.user!.id)) {
        return res.status(403).json(responseFormatter.error('Unauthorized', 403));
      }

      const message = await Message.create({
        conversationId: conversation.id,
        senderId: authReq.user!.id,
        content: content.trim(),
      });

      conversation.lastMessage = content.trim().slice(0, 200);
      conversation.lastMessageAt = new Date();
      await conversation.save();

      res.status(201).json(responseFormatter.success(message, 'Message sent', 201));
    } catch (error) {
      next(error);
    }
  }

  /** Admin: list acquirer users that can be messaged */
  static async listAcquirerContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const acquirers = await User.findAll({
        where: { role: 'acquirer', isActive: true },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
        order: [['name', 'ASC']],
      });

      const contacts = acquirers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        organizationId: u.organizationId,
        organizationName: (u as any).organization?.name || '—',
      }));

      res.json(responseFormatter.success(contacts));
    } catch (error) {
      next(error);
    }
  }

  /** Admin: list partner users that can be messaged */
  static async listPartnerContacts(req: Request, res: Response, next: NextFunction) {
    try {
      const partners = await User.findAll({
        where: { role: 'partner', isActive: true },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
        order: [['name', 'ASC']],
      });

      const contacts = partners.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        organizationId: u.organizationId,
        organizationName: (u as any).organization?.name || '—',
      }));

      res.json(responseFormatter.success(contacts));
    } catch (error) {
      next(error);
    }
  }

  /** Admin: submissions to link when starting a conversation */
  static async listSubmissionsForMessaging(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      if (!organizationId) {
        return next(new AppError('organizationId is required', 400));
      }

      const subs = await Submission.findAll({
        where: {
          [Op.or]: [{ organizationId }, { acquirerOrganizationId: organizationId }],
        },
        include: [
          { model: Organization, as: 'organization', attributes: ['name'] },
          { model: Organization, as: 'acquirerOrganization', attributes: ['name'] },
        ],
        attributes: ['id', 'technology', 'technologyName', 'status', 'organizationId', 'acquirerOrganizationId', 'createdByRole'],
        order: [['submittedDate', 'DESC']],
      });

      const items = subs.map((sub) => {
        const partnerOrg = (sub as any).organization as Organization | undefined;
        const acquirerOrg = (sub as any).acquirerOrganization as Organization | undefined;
        const createdByRole = sub.get('createdByRole') as string | undefined;
        const contextLabel =
          createdByRole === 'acquirer'
            ? acquirerOrg?.name || partnerOrg?.name || '—'
            : partnerOrg?.name || acquirerOrg?.name || '—';

        return {
          id: sub.id,
          technologyName: submissionTechnologyName(sub),
          localPartnerName: contextLabel,
          status: sub.get('status'),
        };
      });

      res.json(responseFormatter.success(items));
    } catch (error) {
      next(error);
    }
  }

  /** Start conversation with the partner or acquirer linked to a submission */
  static async conversationForSubmission(req: Request, res: Response, next: NextFunction) {
    const authReq = req as AuthRequest;
    try {
      if (authReq.user!.role !== 'admin') {
        return next(new AppError('Forbidden', 403));
      }

      const sub = await Submission.findByPk(req.params.submissionId as string);
      if (!sub) return next(new AppError('Submission not found', 404));

      const createdByRole = sub.get('createdByRole') as string | undefined;
      let contactUser: User | null = null;

      if (createdByRole === 'acquirer') {
        contactUser = await User.findOne({
          where: { organizationId: sub.organizationId, role: 'acquirer', isActive: true },
          order: [['createdAt', 'ASC']],
        });
      } else {
        contactUser = await User.findOne({
          where: { organizationId: sub.organizationId, role: 'partner', isActive: true },
          order: [['createdAt', 'ASC']],
        });
      }

      if (!contactUser && sub.acquirerOrganizationId) {
        contactUser = await User.findOne({
          where: { organizationId: sub.acquirerOrganizationId, role: 'acquirer', isActive: true },
          order: [['createdAt', 'ASC']],
        });
      }

      if (!contactUser) {
        return next(new AppError('No active contact user found for this submission', 404));
      }

      req.body = { participantId: contactUser.id, submissionId: sub.id };
      return MessagingController.getOrCreateConversation(req, res, next);
    } catch (error) {
      next(error);
    }
  }
}
