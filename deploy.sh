#!/bin/bash
echo "🚀 Deploying Expenza to Vercel..."
echo ""

# Check if logged in to Vercel
if ! vercel whoami &>/dev/null; then
  echo "📝 Please login to Vercel first:"
  vercel login
fi

echo "📦 Deploying project..."
vercel --yes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To set environment variables, run:"
echo "  vercel env add NEXT_PUBLIC_SUPABASE_URL"
echo "  vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY"
