#!/bin/bash
# Deploy to Vercel - Interactive Script

echo "🚀 Deploying Expenza to Vercel"
echo ""

# Check if logged in
if ! vercel whoami &>/dev/null; then
  echo "Please login to Vercel first:"
  vercel login
fi

echo "📦 Starting deployment..."
echo "When prompted for project name, enter: expenza-expense-tracker"
echo ""

# Deploy (interactive)
vercel

echo ""
echo "✅ Deployment started!"
echo ""
echo "After deployment, add environment variables:"
echo "  vercel env add NEXT_PUBLIC_SUPABASE_URL production"
echo "  vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production"
echo ""
echo "Then deploy to production:"
echo "  vercel --prod"

