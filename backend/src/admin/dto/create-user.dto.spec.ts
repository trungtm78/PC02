import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { USERNAME_MESSAGES, usernameProblems } from '../../common/validators/username.rule';

// One rule for every way an account is named: lowercase letters, digits, "_" and "."; 3-50 characters; at least one
// letter (a name of digits only would be taken for the officer's code).

const messagesOf = async (cls: new () => object, username: string) => {
  const errors = await validate(plainToInstance(cls, { workId: '277-001', roleId: 'role-1', username }) as object);
  return Object.values(errors.find((e) => e.property === 'username')?.constraints ?? {});
};

describe('the login name rule', () => {
  it.each([
    // Real accounts made by the CLI of 21/09 (".doi2"): up to 22 characters, with dots. They could not be saved.
    'huy.trannguyenanh.doi2',
    'tu.nguyenhoanganh.doi2',
    'khanh.nguyensy.doi2',
    // The default accounts of the unit chart.
    'to2.doi1.truong',
    'tct10.canbo',
    // What was accepted before stays accepted.
    'abc123',
    '001abc',
    'user_001',
    'admin',
    'a'.repeat(50),
  ])('accepts "%s", on create and on edit', async (name) => {
    expect(await messagesOf(CreateUserDto, name)).toEqual([]);
    expect(await messagesOf(UpdateUserDto, name)).toEqual([]);
    expect(usernameProblems(name)).toEqual([]);
  });

  it.each([
    ['12345', [USERNAME_MESSAGES.letter]],
    ['001', [USERNAME_MESSAGES.letter]],
    ['ab', [USERNAME_MESSAGES.length]],
    ['a'.repeat(51), [USERNAME_MESSAGES.length]],
    ['Huy.Tran', [USERNAME_MESSAGES.characters]],
    ['huy tran', [USERNAME_MESSAGES.characters]],
    ['huy-tran', [USERNAME_MESSAGES.characters]],
    ['.huytran', [USERNAME_MESSAGES.characters]],
    ['huytran.', [USERNAME_MESSAGES.characters]],
    ['huy..tran', [USERNAME_MESSAGES.characters]],
    ['trần.huy', [USERNAME_MESSAGES.characters]],
  ])('refuses "%s" and says why, without blaming another rule', async (name, expected) => {
    const said = await messagesOf(CreateUserDto, name);
    expect([...new Set(said)].sort()).toEqual([...expected].sort());
    expect(usernameProblems(name)).toEqual(expected);
  });
});
