import { describe, it, expect } from 'vitest';
import { Eye } from 'lucide-react';
import {
  createRowActionRegistry,
  type RowAction,
} from '../registry';

interface TestRow {
  id: string;
  status: string;
}

describe('createRowActionRegistry', () => {
  it('returns empty actions array when no actions registered', () => {
    const reg = createRowActionRegistry<TestRow>();
    expect(reg.all()).toEqual([]);
  });

  it('register adds a single action to the registry', () => {
    const reg = createRowActionRegistry<TestRow>();
    const action: RowAction<TestRow> = {
      key: 'view',
      label: 'View',
      icon: Eye,
      position: 'inline',
      execute: () => {},
      testid: 'btn-view',
    };
    reg.register(action);
    expect(reg.all()).toHaveLength(1);
    expect(reg.all()[0].key).toBe('view');
  });

  it('registerMany adds multiple actions in order', () => {
    const reg = createRowActionRegistry<TestRow>();
    reg.registerMany([
      { key: 'a', label: 'A', icon: Eye, position: 'inline', execute: () => {}, testid: 't-a' },
      { key: 'b', label: 'B', icon: Eye, position: 'menu', execute: () => {}, testid: 't-b' },
    ]);
    expect(reg.all().map((x) => x.key)).toEqual(['a', 'b']);
  });

  it('register returns the registry for chaining', () => {
    const reg = createRowActionRegistry<TestRow>();
    const ret = reg.register({
      key: 'x',
      label: 'X',
      icon: Eye,
      position: 'inline',
      execute: () => {},
      testid: 't-x',
    });
    expect(ret).toBe(reg);
  });
});
