import 'package:flutter/material.dart';

class AppColors {
  static const navy = Color(0xFF1B2B4E);
  static const gold = Color(0xFFD4AF37);
  static const slate = Color(0xFF64748B);
  static const red = Color(0xFFEF4444);
  static const yellow = Color(0xFFF59E0B);
  static const green = Color(0xFF10B981);
}

final appTheme = ThemeData(
  useMaterial3: true,
  colorSchemeSeed: AppColors.navy,
  appBarTheme: const AppBarTheme(
    backgroundColor: AppColors.navy,
    foregroundColor: Colors.white,
    elevation: 0,
  ),
  tabBarTheme: const TabBarThemeData(
    labelColor: Colors.white,
    unselectedLabelColor: Colors.white60,
    indicatorColor: Colors.white,
  ),
  drawerTheme: const DrawerThemeData(
    backgroundColor: Colors.white,
  ),
);
