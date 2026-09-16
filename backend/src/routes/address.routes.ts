import { Router } from 'express';
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate); // UC1.6: yêu cầu đăng nhập

router.get('/', listAddresses);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);
router.post('/:id/default', setDefaultAddress);

export default router;
