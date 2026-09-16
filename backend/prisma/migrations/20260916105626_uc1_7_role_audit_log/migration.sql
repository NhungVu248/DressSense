-- CreateTable
CREATE TABLE `RoleChangeLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NOT NULL,
    `targetUserId` INTEGER NOT NULL,
    `roleBefore` ENUM('CUSTOMER', 'SELLER', 'ADMIN') NOT NULL,
    `roleAfter` ENUM('CUSTOMER', 'SELLER', 'ADMIN') NOT NULL,
    `statusBefore` ENUM('ACTIVE', 'PENDING_APPROVAL', 'LOCKED', 'DISABLED') NOT NULL,
    `statusAfter` ENUM('ACTIVE', 'PENDING_APPROVAL', 'LOCKED', 'DISABLED') NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoleChangeLog_targetUserId_idx`(`targetUserId`),
    INDEX `RoleChangeLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoleChangeLog` ADD CONSTRAINT `RoleChangeLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleChangeLog` ADD CONSTRAINT `RoleChangeLog_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
