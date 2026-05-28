// backend/tests/fakes/fakeSupabase.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { supabase, supabaseAdmin, reset, seed } from './fakeSupabase.js';

beforeEach(() => reset());

describe('fakeSupabase basic CRUD', () => {
  it('insert + select returns the inserted row', async () => {
    const { data, error } = await supabase.from('workers').insert({ name: 'Bob', phone: '+1' })
      .select('id, name, phone, language, role, status').single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: 'Bob', phone: '+1' });
    expect(data.id).toBeTruthy();
  });

  it('select by eq returns the matching row', async () => {
    seed({ workers: [{ id: 'w1', name: 'Alice', phone: '+2' }] });
    const { data } = await supabase.from('workers').select('id, name').eq('phone', '+2').single();
    expect(data).toEqual({ id: 'w1', name: 'Alice' });
  });

  it('select by eq with no match returns PGRST116 from .single()', async () => {
    const { data, error } = await supabase.from('workers').select('id').eq('phone', 'missing').single();
    expect(data).toBeNull();
    expect(error?.code).toBe('PGRST116');
  });

  it('update by eq writes patch and returns row', async () => {
    seed({ workers: [{ id: 'w1', name: 'Alice', phone: '+2' }] });
    const { data } = await supabase.from('workers').update({ name: 'Alicia' }).eq('id', 'w1')
      .select('id, name').single();
    expect(data).toEqual({ id: 'w1', name: 'Alicia' });
  });

  it('select * with embedded join returns nested objects', async () => {
    seed({
      workers: [{ id: 'w1', name: 'Bob' }],
      worksites: [{ id: 's1', name: 'Simons' }],
      time_cards: [{ id: 't1', worker_id: 'w1', worksite_id: 's1', action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending' }],
    });
    const { data } = await supabase.from('time_cards').select('*, workers(name), worksites(name)')
      .order('created_at', { ascending: false });
    expect(data).toHaveLength(1);
    expect(data[0].workers).toEqual({ name: 'Bob' });
    expect(data[0].worksites).toEqual({ name: 'Simons' });
  });

  it('limit clamps result count', async () => {
    seed({ time_cards: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, status: 'pending' })) });
    const { data } = await supabase.from('time_cards').select('*').limit(3);
    expect(data).toHaveLength(3);
  });

  it('insert with duplicate unique field returns 23505', async () => {
    seed({ workers: [{ id: 'w1', phone: '+1' }] });
    const { error } = await supabase.from('workers').insert({ phone: '+1' }).select().single();
    expect(error?.code).toBe('23505');
  });

  it('storage upload + signed url roundtrip', async () => {
    const up = await supabaseAdmin.storage.from('audio').upload('a/b.webm', Buffer.from('x'), { contentType: 'audio/webm', upsert: false });
    expect(up.error).toBeNull();
    expect(up.data.path).toBe('a/b.webm');
    const { data } = await supabaseAdmin.storage.from('audio').createSignedUrl('a/b.webm', 60);
    expect(data.signedUrl).toMatch(/^http:\/\/test\/audio\/a\/b\.webm/);
  });

  it('throws not-implemented on unknown chain method', () => {
    expect(() => supabase.from('workers').rpc('foo')).toThrow(/not implemented/i);
  });
});
