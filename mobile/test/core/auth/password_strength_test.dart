import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/auth/password_strength.dart';

void main() {
  group('PasswordRules', () {
    test('passes all 4 rules for a strong password', () {
      expect(isStrongPassword('Abc12345!'), isTrue);
    });

    test('fails when shorter than 8 chars', () {
      expect(isStrongPassword('Ab1!'), isFalse);
    });

    test('fails when no uppercase', () {
      expect(isStrongPassword('abcdef12!'), isFalse);
    });

    test('fails when no digit', () {
      expect(isStrongPassword('Abcdefgh!'), isFalse);
    });

    test('fails when no special char', () {
      expect(isStrongPassword('Abcdefg12'), isFalse);
    });

    test('passwordRules returns 4 rules in order: length, upper, digit, special', () {
      expect(passwordRules.length, 4);
      expect(passwordRules[0].test('12345678'), isTrue);
      expect(passwordRules[1].test('A'), isTrue);
      expect(passwordRules[2].test('5'), isTrue);
      expect(passwordRules[3].test('!'), isTrue);
    });
  });
}
