import '../../core/models/notification.dart';

/// Number of unread notifications in `list`. Pure function so the AppBar
/// badge and any future consumer (FCM token registration, dashboard widget,
/// etc.) can use the same logic without duplicating the predicate.
int unreadCount(List<AppNotification> list) =>
    list.where((n) => !n.isRead).length;
