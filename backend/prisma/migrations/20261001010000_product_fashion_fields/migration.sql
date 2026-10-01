-- UC6/Tầng A - bổ sung trường sản phẩm theo lược đồ DeepFashion2
ALTER TABLE `Product`
    ADD COLUMN `garmentType` VARCHAR(191) NULL,
    ADD COLUMN `targetGender` VARCHAR(191) NULL,
    ADD COLUMN `brand` VARCHAR(191) NULL,
    ADD COLUMN `occasion` VARCHAR(191) NULL,
    ADD COLUMN `tags` JSON NULL;
