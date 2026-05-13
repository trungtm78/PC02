import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/api/api_base_url.dart';
import 'core/auth/auth_provider.dart';
import 'core/fcm/notification_router.dart';
import 'core/logging/log.dart';
import 'features/auth/first_login_change_password_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/two_fa_screen.dart';
import 'features/cases/case_detail_screen.dart';
import 'features/cases/cases_screen.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/incidents/incident_detail_screen.dart';
import 'features/incidents/incidents_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/petitions/petition_detail_screen.dart';
import 'features/petitions/petitions_screen.dart';
import 'shared/theme/app_theme.dart';

// Kept alive to keep semantics enabled in debug builds for Maestro E2E flows.
// Reading this field is intentionally absent — its only job is anchoring the
// SemanticsHandle so it survives garbage collection. Removing the field would
// also break the Maestro selector tree.
// ignore: unused_element
SemanticsHandle? _semanticsHandle;

void main() async {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  // Refuse to run a release build that points at a dev/emulator API URL.
  assertProductionApiUrl(apiBaseUrl);
  if (kDebugMode) _semanticsHandle = binding.ensureSemantics();
  await initializeDateFormatting('vi_VN', null);
  try {
    await Firebase.initializeApp().timeout(const Duration(seconds: 3));
  } catch (e, st) {
    // BUG-4: Firebase init failure is non-fatal (the app still works without
    // FCM) but absolutely worth a debug log — otherwise silently-broken
    // push registration is invisible during development.
    logError('firebase.init', e, st);
  }
  runApp(const ProviderScope(child: _AppInit()));
}

// Restores auth state before the router runs its first redirect check.
class _AppInit extends ConsumerWidget {
  const _AppInit();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder(
      future: ref.read(authProvider.notifier).init(),
      builder: (_, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const MaterialApp(
            home: Scaffold(body: Center(child: CircularProgressIndicator())),
          );
        }
        return const PC02App();
      },
    );
  }
}

class PC02App extends ConsumerWidget {
  const PC02App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = _buildRouter(ref);
    // BUG-2: wire FCM deep-link handler so tapping a push notification while
    // app is backgrounded routes to /cases/:id (or whatever `link` payload
    // the server sent) instead of dropping the user on the dashboard.
    NotificationRouter.init(router);
    return MaterialApp.router(
      title: 'PC02 Quản lý',
      theme: appTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }

  GoRouter _buildRouter(WidgetRef ref) {
    return GoRouter(
      initialLocation: '/login',
      redirect: (context, state) {
        final authState = ref.read(authProvider);
        final isAuth = authState.isAuthenticated;
        final loc = state.matchedLocation;
        final isPublicRoute = loc.startsWith('/login') ||
            loc == '/auth/first-login-change-password';
        if (!isAuth && !isPublicRoute) return '/login';
        if (isAuth && loc == '/login') return '/';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/login/2fa', builder: (_, __) => const TwoFaScreen()),
        GoRoute(
          path: '/auth/first-login-change-password',
          builder: (_, __) => const FirstLoginChangePasswordScreen(),
        ),
        ShellRoute(
          builder: (context, state, child) => _Shell(child: child),
          routes: [
            GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
            GoRoute(
              path: '/cases',
              builder: (_, __) => const CasesScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) =>
                      CaseDetailScreen(id: state.pathParameters['id']!),
                ),
              ],
            ),
            GoRoute(
              path: '/incidents',
              builder: (_, __) => const IncidentsScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) =>
                      IncidentDetailScreen(id: state.pathParameters['id']!),
                ),
              ],
            ),
            GoRoute(
              path: '/petitions',
              builder: (_, __) => const PetitionsScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) =>
                      PetitionDetailScreen(id: state.pathParameters['id']!),
                ),
              ],
            ),
            GoRoute(
              path: '/notifications',
              builder: (_, __) => const NotificationsScreen(),
            ),
          ],
        ),
      ],
    );
  }
}

class _Shell extends StatefulWidget {
  final Widget child;
  const _Shell({required this.child});

  @override
  State<_Shell> createState() => _ShellState();
}

class _ShellState extends State<_Shell> {
  int _currentIndex = 0;

  static const _routes = [
    '/',
    '/cases',
    '/incidents',
    '/petitions',
    '/notifications',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: AppColors.navy,
        unselectedItemColor: AppColors.slate,
        type: BottomNavigationBarType.fixed,
        onTap: (i) {
          setState(() => _currentIndex = i);
          context.go(_routes[i]);
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Tổng quan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.folder_outlined),
            activeIcon: Icon(Icons.folder),
            label: 'Hồ sơ',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.report_outlined),
            activeIcon: Icon(Icons.report),
            label: 'Vụ việc',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.mail_outlined),
            activeIcon: Icon(Icons.mail),
            label: 'Đơn thư',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.notifications_outlined),
            activeIcon: Icon(Icons.notifications),
            label: 'Thông báo',
          ),
        ],
      ),
    );
  }
}
