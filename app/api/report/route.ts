import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReportHTML } from '../../utils/report';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch expenses
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('username', username)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching expenses:', error);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    // Fetch accounts for expense account_ids
    const accountIds = [...new Set((expenses || []).map((e: any) => e.account_id).filter(Boolean))];
    let accountsMap = new Map();
    
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, type')
        .in('id', accountIds)
        .eq('username', username);
      
      if (accounts) {
        accountsMap = new Map(accounts.map((acc: any) => [acc.id, acc]));
      }
    }

    // Map expenses to include account data
    const mappedExpenses = (expenses || []).map((expense: any) => ({
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

