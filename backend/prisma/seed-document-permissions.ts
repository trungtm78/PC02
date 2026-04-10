import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();

    const permissions = [
        { action: 'read', subject: 'Document' },
        { action: 'write', subject: 'Document' },
        { action: 'edit', subject: 'Document' },
        { action: 'delete', subject: 'Document' },
    ];

    console.log('Seeding Document permissions...');

    for (const perm of permissions) {
        await prisma.permission.upsert({
            where: { action_subject: perm },
            update: {},
            create: perm,
        });
    }

    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (adminRole) {
        const allDocPerms = await prisma.permission.findMany({
            where: { subject: 'Document' },
        });

        for (const perm of allDocPerms) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
                update: {},
                create: { roleId: adminRole.id, permissionId: perm.id },
            });
        }
        console.log('Assigned Document permissions to ADMIN role.');
    }

    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
