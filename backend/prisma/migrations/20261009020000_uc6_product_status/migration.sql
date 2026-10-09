-- UC6.3/6.4/6.5 - trạng thái bán + xóa mềm cho sản phẩm
ALTER TABLE `Product`
    ADD COLUMN `status` ENUM('DRAFT', 'PENDING', 'ACTIVE', 'HIDDEN', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `Product_status_idx` ON `Product`(`status`);
