-- UC5.1 (6a) - bổ sung hành vi HIDE ("không quan tâm"/ẩn) vào enum BehaviorAction
ALTER TABLE `UserBehavior`
    MODIFY `action` ENUM('VIEW', 'WISHLIST', 'ADD_TO_CART', 'PURCHASE', 'HIDE') NOT NULL;
