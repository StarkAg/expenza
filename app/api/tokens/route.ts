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
    const tokens = (await listRows('ingest_tokens', username))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(({ token_hash: _tokenHash, ...token }) => token);
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('[tokens] list failed:', error);
    return NextResponse.json({ error: 'Could not load devices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 60) : '';
  const platform = body.platform;
  if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  if (!label) return NextResponse.json({ error: 'A device name is required' }, { status: 400 });
  if (platform !== 'ios' && platform !== 'android' && platform !== 'other') return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  try {
    const active = (await listRows('ingest_tokens', username)).filter((token) => !token.revoked_at);
    if (active.length >= 10) return NextResponse.json({ error: 'Device limit reached. Revoke one first.' }, { status: 409 });
    const token = `exp_${randomBytes(32).toString('base64url')}`;
    const created = await insertRow('ingest_tokens', {
      username, label, platform, token_hash: hashToken(token), token_hint: token.slice(-6),
    });
    if (!created) throw new Error('No token returned');
    const { token_hash: _tokenHash, ...metadata } = created;
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
