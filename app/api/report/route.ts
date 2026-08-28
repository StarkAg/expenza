import { NextRequest, NextResponse } from 'next/server';
import { generateReportHTML } from '../../utils/report';
import { listRows } from '../../lib/convexServer';

// Reads nextUrl.searchParams, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const expenses = (await listRows('expenses', username))
      .sort((a, b) => `${a.date}:${a.created_at}`.localeCompare(`${b.date}:${b.created_at}`));

    // Fetch accounts for expense account_ids
    const accountIds = [...new Set((expenses || []).map((e: any) => e.account_id).filter(Boolean))];
    let accountsMap = new Map();
    
    if (accountIds.length > 0) {
      const accounts = (await listRows('accounts', username)).filter((account) => accountIds.includes(account.id));
      accountsMap = new Map(accounts.map((acc: any) => [acc.id, acc]));
    }

    // Map expenses to include account data
    const mappedExpenses = expenses.map((expense: any) => ({
      ...expense,
      account: expense.account_id ? accountsMap.get(expense.account_id) || null : null,
    }));

    // Generate report HTML
    const html = generateReportHTML({
      expenses: mappedExpenses,
      username,
      generatedBy: username,
      generatedOn: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    });

    // Return HTML response
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
