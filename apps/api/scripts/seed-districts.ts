import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createPgPool } from '../src/prisma/create-pg-pool';
import { isPointInPolygon } from '../src/common/geo.util';
import { RIGA_DISTRICTS } from './riga-districts.data';

async function main() {
  const pool = createPgPool();
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    for (const districtData of RIGA_DISTRICTS) {
      let district = await prisma.district.findFirst({
        where: { name: districtData.name },
      });

      if (district) {
        district = await prisma.district.update({
          where: { id: district.id },
          data: { polygon: districtData.polygon },
        });
      } else {
        district = await prisma.district.create({
          data: {
            name: districtData.name,
            polygon: districtData.polygon,
          },
        });
      }

      console.log(`District ready: ${district.name}`);

      const cells = await prisma.cell.findMany();
      let linked = 0;

      for (const cell of cells) {
        const center = cell.center as { lat: number; lng: number } | null;
        if (!center) {
          continue;
        }

        if (!isPointInPolygon(center.lat, center.lng, districtData.polygon)) {
          continue;
        }

        await prisma.districtCell.upsert({
          where: {
            districtId_h3Index: {
              districtId: district.id,
              h3Index: cell.h3Index,
            },
          },
          update: {},
          create: {
            districtId: district.id,
            h3Index: cell.h3Index,
          },
        });
        linked++;
      }

      console.log(`  Linked ${linked} existing cells`);
    }

    console.log('District seed completed');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
