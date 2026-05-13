import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/api/providers.dart';
import '../../core/logging/log.dart';
import '../../core/models/notification.dart';
import '../../shared/theme/app_theme.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/offline_banner.dart';
import 'unread_count.dart';

final _notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.read(notificationsApiProvider).getNotifications();
});

/// BUG-8: derived from the notifications future. Replaces the dead
/// StateProvider<int> that was declared but never written/read.
final unreadNotificationCountProvider = Provider.autoDispose<int>((ref) {
  final async = ref.watch(_notificationsProvider);
  return async.maybeWhen(data: unreadCount, orElse: () => 0);
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(_notificationsProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('Thông báo'),
            if (unread > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.red,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  unread > 99 ? '99+' : '$unread',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_notificationsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: data.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => EmptyState(
                message: 'Không thể tải thông báo',
                icon: Icons.error_outline,
                onRetry: () => ref.invalidate(_notificationsProvider),
              ),
              data: (notifications) {
                if (notifications.isEmpty) {
                  return const EmptyState(
                    message: 'Không có thông báo',
                    icon: Icons.notifications_none_outlined,
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(_notificationsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: notifications.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1),
                    itemBuilder: (ctx, i) =>
                        _NotificationTile(notification: notifications[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends ConsumerStatefulWidget {
  final AppNotification notification;
  const _NotificationTile({required this.notification});

  @override
  ConsumerState<_NotificationTile> createState() =>
      _NotificationTileState();
}

class _NotificationTileState extends ConsumerState<_NotificationTile> {
  late bool _isRead;

  @override
  void initState() {
    super.initState();
    _isRead = widget.notification.isRead;
  }

  Future<void> _markRead() async {
    if (_isRead) return;
    setState(() => _isRead = true);
    try {
      await ref
          .read(notificationsApiProvider)
          .markRead(widget.notification.id);
    } catch (e, st) {
      // BUG-4: log non-fatal mark-read failure + revert optimistic update.
      logError('notifications.markRead', e, st);
      setState(() => _isRead = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.notification;
    return InkWell(
      onTap: _markRead,
      child: Container(
        color: _isRead ? null : Colors.blue.withValues(alpha: 0.04),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6, right: 12),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isRead ? Colors.transparent : Colors.blue,
              ),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n.title,
                    style: TextStyle(
                      fontWeight:
                          _isRead ? FontWeight.normal : FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  if (n.body != null) ...[
                    const SizedBox(height: 2),
                    Text(n.body!,
                        style: TextStyle(
                            color: Colors.grey[600], fontSize: 13),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('HH:mm dd/MM/yyyy', 'vi_VN')
                        .format(n.createdAt.toLocal()),
                    style: TextStyle(
                        color: Colors.grey[500], fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
