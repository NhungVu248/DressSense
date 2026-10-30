import { Router } from 'express';
import { openConversation, listConversations, getConversation, sendMessage, toggleStar } from '../controllers/message.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Tin nhắn / CSKH - yêu cầu đăng nhập
router.use(authenticate);

router.post('/conversation', openConversation); // khách mở hội thoại với người bán/CSKH
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/star', toggleStar);

export default router;
