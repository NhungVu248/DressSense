-- UC6.6 - quản lý tồn kho theo biến thể: số giữ chỗ + ngưỡng cảnh báo tồn thấp
ALTER TABLE `ProductVariant`
    ADD COLUMN `reserved` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lowStockThreshold` INTEGER NULL;
