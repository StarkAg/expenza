import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { insertRow, listRows, updateRow } from '../../lib/convexServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hashToken = (raw: string) => createHash('sha256').update(raw, 'utf8').digest('hex');

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  try {
    const rows = await listRows('ingest_tokens', username);
    const connection = rows.find((token) => token.connection_scope === 'account' && !token.revoked_at);
    const tokens = rows
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(({ token_hash: _tokenHash, connection_token: _connectionToken, ...token }) => token);
    return NextResponse.json({ tokens, connectionToken: connection?.connection_token || null });
  } catch (error) {
    console.error('[tokens] list failed:', error);
    return NextResponse.json({ error: 'Could not load devices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  try {
    const rows = await listRows('ingest_tokens', username);
    const existing = rows.find((token) => token.connection_scope === 'account' && !token.revoked_at);
    if (existing?.connection_token) {
      const { token_hash: _tokenHash, connection_token: _connectionToken, ...metadata } = existing;
      return NextResponse.json({ ...metadata, token: existing.connection_token, reused: true });
    }

    // Older per-device links cannot be recovered because only their hashes were
    // stored. Revoke them once and replace them with one reusable account link.
    const revokedAt = new Date().toISOString();
    await Promise.all(rows
      .filter((token) => !token.revoked_at)
      .map((token) => updateRow('ingest_tokens', token.id, username, { revoked_at: revokedAt })));

    const token = `exp_${randomBytes(32).toString('base64url')}`;
    const created = await insertRow('ingest_tokens', {
      username,
      label: 'Auto-Tracking connection',
      platform: 'other',
      connection_scope: 'account',
      connection_token: token,
      token_hash: hashToken(token),
      token_hint: token.slice(-6),
    });
    if (!created) throw new Error('No token returned');
    const { token_hash: _tokenHash, connection_token: _connectionToken, ...metadata } = created;
    return NextResponse.json({ ...metadata, token }, { status: 201 });
  } catch (error) {
    console.error('[tokens] create failed:', error);
    return NextResponse.json({ error: 'Could not create the device token' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username');
  const id = request.nextUrl.searchParams.get('id');
  if (!username || !id) return NextResponse.json({ error: 'username and id are required' }, { status: 400 });
  try {
    await updateRow('ingest_tokens', id, username, { revoked_at: new Date().toISOString() });
    return NextResponse.json({ status: 'revoked' });
  } catch (error) {
    console.error('[tokens] revoke failed:', error);
    return NextResponse.json({ error: 'Could not revoke' }, { status: 500 });
  }
}
