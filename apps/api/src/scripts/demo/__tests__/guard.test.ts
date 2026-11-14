import { describe, expect, it } from 'vitest';

import { assessTarget, dbNameFromUri, resolveTarget } from '../guard';

const ATLAS = 'mongodb+srv://user:p%40ss@cluster0.abc.mongodb.net/?retryWrites=true';
const LOCAL = 'mongodb://127.0.0.1:27017';

const base = {
  uri: LOCAL,
  dbNameEnv: 'acadin_demo',
  nodeEnv: 'development',
  apply: true,
  confirmTarget: '127.0.0.1/acadin_demo',
  approvedTargets: undefined,
};

describe('resolveTarget', () => {
  it('never puts credentials in the target id', () => {
    const { targetId } = resolveTarget(ATLAS, 'acadin');
    expect(targetId).toBe('cluster0.abc.mongodb.net/acadin');
    expect(targetId).not.toContain('user');
    expect(targetId).not.toContain('p%40ss');
  });

  it('falls back to the database in the URI path', () => {
    expect(dbNameFromUri('mongodb://localhost:27017/aip?w=1')).toBe('aip');
    expect(dbNameFromUri('mongodb+srv://u:p@c.net/?w=1')).toBeUndefined();
    expect(resolveTarget('mongodb://localhost/aip', undefined).targetId).toBe('localhost/aip');
  });
});

describe('assessTarget', () => {
  it('is a dry run unless --apply is passed', () => {
    expect(assessTarget({ ...base, apply: false })).toMatchObject({ mode: 'dry-run' });
    expect(assessTarget({ ...base, apply: false }).refusal).toBeUndefined();
  });

  it('allows a confirmed local target', () => {
    expect(assessTarget(base)).toMatchObject({ mode: 'apply', local: true });
  });

  it('refuses without an exact confirmation', () => {
    expect(assessTarget({ ...base, confirmTarget: undefined }).mode).toBe('dry-run');
    expect(assessTarget({ ...base, confirmTarget: '127.0.0.1/other' }).refusal).toMatch(
      /confirm-target/,
    );
  });

  it('refuses when no database name can be determined', () => {
    const r = assessTarget({
      ...base,
      dbNameEnv: undefined,
      confirmTarget: '127.0.0.1/(no-db-name)',
    });
    expect(r.mode).toBe('dry-run');
    expect(r.refusal).toMatch(/MONGODB_DB_NAME/);
  });

  it('refuses a confirmed remote target that is not on the approved list', () => {
    const r = assessTarget({
      ...base,
      uri: ATLAS,
      dbNameEnv: 'acadin',
      confirmTarget: 'cluster0.abc.mongodb.net/acadin',
    });
    expect(r.mode).toBe('dry-run');
    expect(r.refusal).toMatch(/DEMO_SEED_APPROVED_TARGETS/);
  });

  it('allows a remote target only when confirmed AND approved', () => {
    const r = assessTarget({
      ...base,
      uri: ATLAS,
      dbNameEnv: 'acadin',
      confirmTarget: 'cluster0.abc.mongodb.net/acadin',
      approvedTargets: 'other.net/x, cluster0.abc.mongodb.net/acadin',
    });
    expect(r.mode).toBe('apply');
  });

  it('requires approval for a local database when NODE_ENV=production', () => {
    const r = assessTarget({ ...base, nodeEnv: 'production' });
    expect(r.mode).toBe('dry-run');
    expect(r.refusal).toMatch(/DEMO_SEED_APPROVED_TARGETS/);
    expect(
      assessTarget({ ...base, nodeEnv: 'production', approvedTargets: '127.0.0.1/acadin_demo' })
        .mode,
    ).toBe('apply');
  });

  it('does not accept an approval for a different database on the same host', () => {
    const r = assessTarget({
      ...base,
      uri: ATLAS,
      dbNameEnv: 'acadin',
      confirmTarget: 'cluster0.abc.mongodb.net/acadin',
      approvedTargets: 'cluster0.abc.mongodb.net/academia_industry_portal',
    });
    expect(r.mode).toBe('dry-run');
  });
});
