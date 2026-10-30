-- AlterTable
ALTER TABLE `notification` MODIFY `type` ENUM('ORDER', 'PAYMENT', 'RETURN', 'COMPLAINT', 'REVIEW', 'QA', 'PROMO', 'SUGGEST', 'SHOP', 'MESSAGE') NOT NULL;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('SELLER', 'ADMIN') NOT NULL,
    `customerId` INTEGER NOT NULL,
    `sellerId` INTEGER NULL,
    `orderId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `customerReadAt` DATETIME(3) NULL,
    `partnerReadAt` DATETIME(3) NULL,
    `customerStarred` BOOLEAN NOT NULL DEFAULT false,
    `partnerStarred` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Conversation_customerId_idx`(`customerId`),
    INDEX `Conversation_sellerId_idx`(`sellerId`),
    INDEX `Conversation_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
