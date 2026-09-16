import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  STYLE_OPTIONS,
  COLOR_OPTIONS,
  GARMENT_OPTIONS,
  MATERIAL_OPTIONS,
  OCCASION_OPTIONS,
  FREQUENCY_OPTIONS,
  STANDARD_SIZES,
  NUMERIC_SIZE_RANGE,
  MEASUREMENT_RANGE,
  isValidOption,
  deriveSizeFromMeasurements,
} from '../constants/personalization';

// ============================================================
//  UC2.1 - THIẾT LẬP HỒ SƠ CÁ NHÂN HÓA
//  UC2.2 - QUẢN LÝ THÔNG TIN SIZE
// ============================================================

// GET /api/personalization/catalog - bước 2: danh mục chuẩn dùng cho biểu mẫu
export async function getCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json({
      styles: STYLE_OPTIONS,
      colors: COLOR_OPTIONS,
      garments: GARMENT_OPTIONS,
      materials: MATERIAL_OPTIONS,
      occasions: OCCASION_OPTIONS,
      frequencies: FREQUENCY_OPTIONS,
      standardSizes: STANDARD_SIZES,
      numericSizeRange: NUMERIC_SIZE_RANGE,
      measurementRange: MEASUREMENT_RANGE,
      categories: categories.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
    });
  } catch (err) {
    next(err);
  }
}

function serializeProfile(profile: any) {
  if (!profile) {
    return {
      style: null,
      budgets: [],
      occasions: [],
    };
  }
  return {
    style: profile.styleDeclaredAt
      ? {
          preferredStyles: profile.preferredStyles ?? [],
          preferredColors: profile.preferredColors ?? [],
          avoidColors: profile.avoidColors ?? [],
          preferredGarments: profile.preferredGarments ?? [],
          avoidGarments: profile.avoidGarments ?? [],
          preferredMaterials: profile.preferredMaterials ?? [],
          preferredBrands: profile.preferredBrands ?? [],
          declaredAt: profile.styleDeclaredAt,
        }
      : null,
    budgets: (profile.budgets ?? []).map((b: any) => ({
      categoryId: b.categoryId,
      categoryName: b.category?.name,
      minPrice: b.minPrice,
      maxPrice: b.maxPrice,
    })),
    occasions: (profile.occasions ?? []).map((o: any) => ({
      occasion: o.occasion,
      customLabel: o.customLabel,
      frequency: o.frequency,
    })),
  };
}

// GET /api/personalization/profile - bước 2-3: hồ sơ hiện có (nếu đã khai báo)
export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.customerProfile.findUnique({
      where: { userId: req.user!.userId },
      include: { budgets: { include: { category: true } }, occasions: true },
    });
    res.json(serializeProfile(profile));
  } catch (err) {
    next(err);
  }
}

const styleSchema = z
  .object({
    preferredStyles: z.array(z.object({ style: z.string(), priority: z.number().int().min(1) })).default([]),
    preferredColors: z.array(z.string()).default([]),
    avoidColors: z.array(z.string()).default([]),
    preferredGarments: z.array(z.string()).default([]),
    avoidGarments: z.array(z.string()).default([]),
    preferredMaterials: z.array(z.string()).default([]),
    preferredBrands: z.array(z.string()).default([]),
  })
  .nullable();

const budgetsSchema = z
  .array(
    z.object({
      categoryId: z.number().int(),
      minPrice: z.number().min(0, 'Mức giá phải là số không âm'),
      maxPrice: z.number().min(0, 'Mức giá phải là số không âm'),
    })
  )
  .nullable();

const occasionsSchema = z
  .array(
    z.object({
      occasion: z.enum(['WORK', 'SCHOOL', 'STREET', 'PARTY', 'SPORT', 'TRAVEL', 'CUSTOM']),
      customLabel: z.string().trim().optional(),
      frequency: z.enum(['RARELY', 'SOMETIMES', 'OFTEN']).default('SOMETIMES'),
    })
  )
  .nullable();

const updateProfileSchema = z.object({
  style: styleSchema.optional(),
  budgets: budgetsSchema.optional(),
  occasions: occasionsSchema.optional(),
});

// PUT /api/personalization/profile - bước 4-9: khai báo/cập nhật hồ sơ cá nhân hóa
export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateProfileSchema.parse(req.body);
    const userId = req.user!.userId;

    // --- 6E: sở thích mâu thuẫn (một thuộc tính vừa "ưa thích" vừa "muốn tránh") ---
    if (data.style) {
      const colorOverlap = data.style.preferredColors.filter((c) => data.style!.avoidColors.includes(c));
      const garmentOverlap = data.style.preferredGarments.filter((g) => data.style!.avoidGarments.includes(g));
      if (colorOverlap.length > 0 || garmentOverlap.length > 0) {
        return res.status(400).json({
          message: 'Một số lựa chọn vừa nằm trong nhóm "ưa thích" vừa nằm trong nhóm "muốn tránh". Vui lòng điều chỉnh lại.',
          conflicts: { colors: colorOverlap, garments: garmentOverlap },
        });
      }
      const invalidStyle = data.style.preferredStyles.find((s) => !isValidOption(s.style, STYLE_OPTIONS));
      const invalidColor = [...data.style.preferredColors, ...data.style.avoidColors].find(
        (c) => !isValidOption(c, COLOR_OPTIONS)
      );
      const invalidGarment = [...data.style.preferredGarments, ...data.style.avoidGarments].find(
        (g) => !isValidOption(g, GARMENT_OPTIONS)
      );
      const invalidMaterial = data.style.preferredMaterials.find((m) => !isValidOption(m, MATERIAL_OPTIONS));
      if (invalidStyle || invalidColor || invalidGarment || invalidMaterial) {
        return res.status(400).json({ message: 'Lựa chọn không thuộc danh mục chuẩn của hệ thống. Vui lòng chọn lại.' });
      }
    }

    // --- 6F: ngân sách không hợp lệ ---
    if (data.budgets) {
      for (const b of data.budgets) {
        if (b.minPrice > b.maxPrice) {
          return res.status(400).json({
            message: `Mức giá tối thiểu không được lớn hơn mức tối đa (danh mục #${b.categoryId}).`,
          });
        }
      }
      const categoryIds = data.budgets.map((b) => b.categoryId);
      if (new Set(categoryIds).size !== categoryIds.length) {
        return res.status(400).json({ message: 'Mỗi nhóm sản phẩm chỉ được thiết lập một khoảng ngân sách.' });
      }
      if (categoryIds.length > 0) {
        const found = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
        if (found.length !== new Set(categoryIds).size) {
          return res.status(400).json({ message: 'Có nhóm sản phẩm không tồn tại trong danh mục hệ thống.' });
        }
      }
    }

    // --- 6G: dịp sử dụng không hợp lệ ---
    if (data.occasions) {
      for (const o of data.occasions) {
        if (o.occasion === 'CUSTOM' && !o.customLabel) {
          return res.status(400).json({ message: 'Vui lòng đặt tên cho dịp sử dụng tùy chỉnh.' });
        }
      }
      const keys = data.occasions.map((o) => `${o.occasion}:${o.occasion === 'CUSTOM' ? o.customLabel : ''}`);
      if (new Set(keys).size !== keys.length) {
        return res.status(400).json({ message: 'Danh sách dịp sử dụng bị trùng lặp. Vui lòng kiểm tra lại.' });
      }
    }

    // --- 7E: mọi thay đổi được bọc trong 1 transaction, lỗi thì giữ nguyên hồ sơ cũ ---
    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      if (data.style !== undefined) {
        await tx.customerProfile.update({
          where: { userId },
          data: data.style
            ? {
                preferredStyles: data.style.preferredStyles,
                preferredColors: data.style.preferredColors,
                avoidColors: data.style.avoidColors,
                preferredGarments: data.style.preferredGarments,
                avoidGarments: data.style.avoidGarments,
                preferredMaterials: data.style.preferredMaterials,
                preferredBrands: data.style.preferredBrands,
                styleDeclaredAt: new Date(),
              }
            : {
                // 4b: "Để sau" -> xóa khai báo, dùng gợi ý mặc định
                preferredStyles: undefined,
                preferredColors: undefined,
                avoidColors: undefined,
                preferredGarments: undefined,
                avoidGarments: undefined,
                preferredMaterials: undefined,
                preferredBrands: undefined,
                styleDeclaredAt: null,
              },
        });
      }

      if (data.budgets !== undefined) {
        const budgetList = data.budgets ?? [];
        await tx.profileBudget.deleteMany({ where: { profileId: existing.id } });
        if (budgetList.length > 0) {
          await tx.profileBudget.createMany({
            data: budgetList.map((b) => ({
              profileId: existing.id,
              categoryId: b.categoryId,
              minPrice: b.minPrice,
              maxPrice: b.maxPrice,
            })),
          });
        }
      }

      if (data.occasions !== undefined) {
        const occasionList = data.occasions ?? [];
        await tx.profileOccasion.deleteMany({ where: { profileId: existing.id } });
        if (occasionList.length > 0) {
          await tx.profileOccasion.createMany({
            data: occasionList.map((o) => ({
              profileId: existing.id,
              occasion: o.occasion,
              customLabel: o.occasion === 'CUSTOM' ? o.customLabel : null,
              frequency: o.frequency,
            })),
          });
        }
      }

      return tx.customerProfile.findUnique({
        where: { userId },
        include: { budgets: { include: { category: true } }, occasions: true },
      });
    });

    res.json({ message: 'Lưu hồ sơ cá nhân hóa thành công', ...serializeProfile(profile) });
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  UC2.2 - QUẢN LÝ THÔNG TIN SIZE
// ============================================================

// GET /api/personalization/sizes - bước 2-3
export async function listSizes(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.customerProfile.findUnique({ where: { userId: req.user!.userId } });
    if (!profile) return res.json({ sizes: [] });
    const sizes = await prisma.customerSize.findMany({
      where: { profileId: profile.id },
      include: { category: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({
      sizes: sizes.map((s: any) => ({
        categoryId: s.categoryId,
        categoryName: s.category.name,
        sizeSystem: s.sizeSystem,
        sizeValue: s.sizeValue,
        measurements: s.measurements,
        source: s.source,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

const upsertSizeSchema = z
  .object({
    sizeSystem: z.enum(['STANDARD', 'NUMERIC', 'MEASUREMENT']),
    sizeValue: z.string().trim().optional(),
    measurements: z
      .object({
        chest: z.number().optional(),
        waist: z.number().optional(),
        hip: z.number().optional(),
        length: z.number().optional(),
      })
      .optional(),
  })
  .refine((d) => d.sizeSystem === 'MEASUREMENT' || !!d.sizeValue, {
    message: 'Vui lòng chọn hoặc nhập size',
    path: ['sizeValue'],
  });

// PUT /api/personalization/sizes/:categoryId - bước 4-7 (+ luồng thay thế 4c nhập theo số đo)
export async function upsertSize(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = Number(req.params.categoryId);
    const data = upsertSizeSchema.parse(req.body);
    const userId = req.user!.userId;

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ message: 'Danh mục sản phẩm không tồn tại' });

    let sizeValue = data.sizeValue ?? '';
    let measurements: Record<string, number> | undefined;

    // --- 6E: kiểm tra tính hợp lệ theo từng hệ size ---
    if (data.sizeSystem === 'STANDARD') {
      if (!isValidOption(sizeValue, STANDARD_SIZES.map((v) => ({ value: v })))) {
        return res.status(400).json({ message: 'Size được chọn không thuộc hệ size chuẩn (XS–XXL).' });
      }
    } else if (data.sizeSystem === 'NUMERIC') {
      const n = Number(sizeValue);
      if (Number.isNaN(n) || n < NUMERIC_SIZE_RANGE.min || n > NUMERIC_SIZE_RANGE.max) {
        return res.status(400).json({
          message: `Số size phải nằm trong khoảng ${NUMERIC_SIZE_RANGE.min}–${NUMERIC_SIZE_RANGE.max}.`,
        });
      }
      sizeValue = String(n);
    } else {
      // MEASUREMENT - luồng thay thế 4c
      const m = data.measurements ?? {};
      const values = Object.values(m).filter((v): v is number => v != null);
      if (values.length === 0) {
        return res.status(400).json({ message: 'Vui lòng nhập ít nhất một số đo cơ thể.' });
      }
      const outOfRange = values.find((v) => v < MEASUREMENT_RANGE.min || v > MEASUREMENT_RANGE.max);
      if (outOfRange !== undefined) {
        return res.status(400).json({
          message: `Số đo phải nằm trong khoảng ${MEASUREMENT_RANGE.min}–${MEASUREMENT_RANGE.max}cm.`,
        });
      }
      const derived = deriveSizeFromMeasurements(m);
      if (!derived) {
        return res.status(400).json({ message: 'Không thể quy đổi size từ số đo đã nhập. Vui lòng kiểm tra lại.' });
      }
      sizeValue = derived;
      measurements = m as Record<string, number>;
    }

    // --- 7E: transaction để đảm bảo hồ sơ cũ được giữ nguyên nếu có lỗi ---
    const size = await prisma.$transaction(async (tx) => {
      const profile = await tx.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      return tx.customerSize.upsert({
        where: { profileId_categoryId: { profileId: profile.id, categoryId } },
        update: { sizeSystem: data.sizeSystem, sizeValue, measurements: measurements ?? null, source: 'MANUAL' },
        create: {
          profileId: profile.id,
          categoryId,
          sizeSystem: data.sizeSystem,
          sizeValue,
          measurements: measurements ?? null,
          source: 'MANUAL',
        },
        include: { category: true },
      });
    });

    res.json({
      message: 'Lưu thông tin size thành công',
      size: {
        categoryId: size.categoryId,
        categoryName: size.category.name,
        sizeSystem: size.sizeSystem,
        sizeValue: size.sizeValue,
        measurements: size.measurements,
        source: size.source,
        updatedAt: size.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/personalization/sizes/:categoryId - luồng thay thế 4d
export async function deleteSize(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = Number(req.params.categoryId);
    const userId = req.user!.userId;
    const profile = await prisma.customerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: 'Chưa có thông tin size nào được lưu' });

    const existing = await prisma.customerSize.findUnique({
      where: { profileId_categoryId: { profileId: profile.id, categoryId } },
    });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy thông tin size cho danh mục này' });

    await prisma.customerSize.delete({ where: { id: existing.id } });
    res.json({ message: 'Đã xóa thông tin size' });
  } catch (err) {
    next(err);
  }
}
