import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../theme/app_theme.dart';

class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(color: AppColors.navy),
              child: Row(
                children: [
                  Image.asset(
                    'assets/images/logo-cong-an.png',
                    width: 48,
                    height: 48,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'PC02\nQuản lý',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: Text(user?['fullName'] ?? 'Người dùng'),
              subtitle: _roleChip(user?['role']),
            ),
            const Divider(),
            const Spacer(),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Đăng xuất',
                  style: TextStyle(color: Colors.red)),
              onTap: () async {
                // BUG-3: FCM cleanup runs inside AuthNotifier.logout() via
                // the onLogout callback wired in authProvider — no need to
                // reach across modules here.
                await ref.read(authProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget? _roleChip(String? role) {
    if (role == null) return null;
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.gold),
      ),
      child: Text(
        role,
        style: const TextStyle(
          fontSize: 11,
          color: AppColors.navy,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
