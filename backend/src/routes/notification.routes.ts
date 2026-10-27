import { Router } from 'express';
import { listNotifications, unreadCount, markRead, markAllRead } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

// UC12.4 - thông báo của khách
router.get('/', listNotifications);
router.get('/count', unreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
