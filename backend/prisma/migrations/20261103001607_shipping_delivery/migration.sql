-- AlterTable
ALTER TABLE `shop` ADD COLUMN `selfDelivery` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `selfDeliveryFee` INTEGER NULL;
