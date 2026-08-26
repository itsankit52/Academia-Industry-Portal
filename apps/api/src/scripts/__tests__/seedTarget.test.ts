import { describe, expect, it } from 'vitest';

import { isLocalTarget, targetHosts } from '../seedTarget';

describe('targetHosts', () => {
  it('reads the host out of a plain local URI', () => {
    expect(targetHosts('mongodb://localhost:27017/aip')).toEqual(['localhost']);
  });

  it('drops credentials so they cannot reach a log line', () => {
    const hosts = targetHosts('mongodb+srv://admin:s3cret@cluster0.abc.mongodb.net/aip');
    expect(hosts).toEqual(['cluster0.abc.mongodb.net']);
  });

  // A Mongo password is allowed to contain '@', so splitting at the first one
  // would leave part of the password being treated as the hostname.
  it('splits at the last @ when the password itself contains one', () => {
    const hosts = targetHosts('mongodb+srv://admin:p@ss@w0rd@cluster0.abc.mongodb.net/aip');
    expect(hosts).toEqual(['cluster0.abc.mongodb.net']);
  });

  it('returns every host of a replica-set URI', () => {
    const hosts = targetHosts('mongodb://a.example.com:27017,b.example.com:27017/aip');
    expect(hosts).toEqual(['a.example.com', 'b.example.com']);
  });

  it('keeps an IPv6 literal intact instead of truncating it at the first colon', () => {
    expect(targetHosts('mongodb://[::1]:27017/aip')).toEqual(['::1']);
  });

  it('ignores the database name and query string', () => {
    const hosts = targetHosts('mongodb://127.0.0.1:27017/aip?retryWrites=true&w=majority');
    expect(hosts).toEqual(['127.0.0.1']);
  });

  it('handles a URI with no port and no database', () => {
    expect(targetHosts('mongodb://localhost')).toEqual(['localhost']);
  });
});

describe('isLocalTarget', () => {
  it.each([
    'mongodb://localhost:27017/aip',
    'mongodb://127.0.0.1:27017/aip',
    'mongodb://[::1]:27017/aip',
    'mongodb://mongo:27017/aip',
  ])('treats %s as local', (uri) => {
    expect(isLocalTarget(uri)).toBe(true);
  });

  it('treats an Atlas cluster as remote so the wipe needs confirmation', () => {
    expect(isLocalTarget('mongodb+srv://admin:s3cret@cluster0.abc.mongodb.net/aip')).toBe(false);
  });

  // The seed deletes every collection, so anything it cannot positively identify
  // as local has to be treated as remote.
  it('fails closed on a URI it cannot parse', () => {
    expect(isLocalTarget('')).toBe(false);
    expect(isLocalTarget('not-a-uri')).toBe(false);
  });

  it('refuses a mixed replica set that is only partly local', () => {
    expect(isLocalTarget('mongodb://localhost:27017,prod.example.com:27017/aip')).toBe(false);
  });

  // A host that merely starts with a local-looking label is not local.
  it('does not treat a lookalike hostname as local', () => {
    expect(isLocalTarget('mongodb://localhost.evil.example.com:27017/aip')).toBe(false);
    expect(isLocalTarget('mongodb://127.0.0.1.evil.example.com:27017/aip')).toBe(false);
  });
});
