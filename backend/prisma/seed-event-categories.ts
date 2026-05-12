/**
 * Seed 5 default EventCategory rows (PR 1, v0.16.0.0).
 *
 * Idempotent — uses upsert by slug. `isSystem=true` flags these categories
 * so PR 2's DELETE endpoint will refuse to remove them.
 *
 * Colors map 1:1 to the legacy HolidayCategory enum colors used in
 * frontend/src/pages/calendar/CalendarPage.tsx so existing 25 holiday rows
 * (which will be migrated in PR 3) render identically.
 */
import { PrismaClient } from '@prisma/client';

const DEFAULT_CATEGORIES = [
  { slug: 'national', name: 'Quốc gia', color: '#dc2626', icon: 'flag', sortOrder: 10 },
  { slug: 'police', name: 'Ngành Công an', color: '#1e40af', icon: 'shield', sortOrder: 20 },
  { slug: 'military', name: 'Quân đội', color: '#15803d', icon: 'star', sortOrder: 30 },
  { slug: 'international', name: 'Quốc tế', color: '#ea580c', icon: 'globe', sortOrder: 40 },
  { slug: 'other', name: 'Khác', color: '#64748b', icon: 'calendar', sortOrder: 100 },
] as const;

export async function seedEventCategories(prisma: PrismaClient): Promise<number> {
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.eventCategory.upsert({
      where: { slug: cat.slug },
      update: {
        // Refresh display fields, but DO NOT touch sortOrder (admin may reorder).
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isSystem: true,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isSystem: true,
        sortOrder: cat.sortOrder,
      },
    });
  }
  return DEFAULT_CATEGORIES.length;
}
