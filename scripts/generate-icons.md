# Icon Generation Guide

The PWA requires icon files for iOS Home Screen installation. You need to create:

1. `/public/icon-192.png` - 192x192 pixels
2. `/public/icon-512.png` - 512x512 pixels

## Option 1: Use Online Tool

1. Go to [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
2. Or use [RealFaviconGenerator](https://realfavicongenerator.net/)
3. Upload a 512x512 source image
4. Download generated icons
5. Place them in `/public/` directory

## Option 2: Create Manually

1. Create a 512x512 square image with your app icon
2. Export as `icon-512.png`
3. Resize to 192x192 and export as `icon-192.png`
4. Place both in `/public/` directory

## Option 3: Use Placeholder (Development Only)

For development, you can create simple colored squares:

```bash
# Using ImageMagick (if installed)
convert -size 512x512 xc:#007AFF icon-512.png
convert -size 192x192 xc:#007AFF icon-192.png
```

Or use any image editor to create simple placeholder icons.

## Icon Design Tips

- Use a simple, recognizable design
- Ensure good contrast
- Test on both light and dark backgrounds
- Follow iOS Human Interface Guidelines
- Use rounded corners (iOS will add mask automatically)

