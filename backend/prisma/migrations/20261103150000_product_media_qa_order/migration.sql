-- Ảnh sản phẩm: thêm thứ tự hiển thị
ALTER TABLE `ProductImage` ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

-- Hỏi đáp gắn với đơn hàng
ALTER TABLE `ProductQuestion` ADD COLUMN `orderId` INTEGER NULL;
CREATE INDEX `ProductQuestion_orderId_idx` ON `ProductQuestion`(`orderId`);
ALTER TABLE `ProductQuestion` ADD CONSTRAINT `ProductQuestion_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Video sản phẩm
CREATE TABLE `ProductVideo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ProductVideo_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductVideo` ADD CONSTRAINT `ProductVideo_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Kho ảnh tái sử dụng của gian hàng
CREATE TABLE `MediaAsset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sellerId` INTEGER NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MediaAsset_sellerId_idx`(`sellerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
