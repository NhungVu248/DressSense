import { Router } from 'express';
import {
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  previewAudience, sendCampaign, scheduleCampaign, cancelCampaign,
} from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC13.3 - chiến dịch thông báo khuyến mãi: chỉ Quản trị viên
router.use(authenticate, authorize('ADMIN'));

router.get('/', listCampaigns);
router.post('/', createCampaign);
router.patch('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);
router.get('/:id/audience', previewAudience);
router.post('/:id/send', sendCampaign);
router.post('/:id/schedule', scheduleCampaign);
router.post('/:id/cancel', cancelCampaign);

export default router;
