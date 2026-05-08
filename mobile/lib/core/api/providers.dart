import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../auth/token_storage.dart';
import 'api_client.dart';
import 'auth_api.dart';
import 'cases_api.dart';
import 'dashboard_api.dart';
import 'devices_api.dart';
import 'incidents_api.dart';
import 'notifications_api.dart';
import 'petitions_api.dart';
import 'settings_api.dart';

// Single source of truth for API clients and storage. Feature screens import
// from here instead of declaring providers inline.

final _storageProvider = Provider((_) => const FlutterSecureStorage());

final apiClientProvider =
    Provider((ref) => ApiClient(ref.read(_storageProvider)));

final tokenStorageProvider =
    Provider((ref) => TokenStorage(ref.read(_storageProvider)));

final authApiProvider =
    Provider((ref) => AuthApi(ref.read(apiClientProvider)));
final casesApiProvider =
    Provider((ref) => CasesApi(ref.read(apiClientProvider)));
final dashboardApiProvider =
    Provider((ref) => DashboardApi(ref.read(apiClientProvider)));
final devicesApiProvider =
    Provider((ref) => DevicesApi(ref.read(apiClientProvider)));
final incidentsApiProvider =
    Provider((ref) => IncidentsApi(ref.read(apiClientProvider)));
final notificationsApiProvider =
    Provider((ref) => NotificationsApi(ref.read(apiClientProvider)));
final petitionsApiProvider =
    Provider((ref) => PetitionsApi(ref.read(apiClientProvider)));
final settingsApiProvider =
    Provider((ref) => SettingsApi(ref.read(apiClientProvider)));
