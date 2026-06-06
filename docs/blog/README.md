# TradeMind AI Blog

Welcome to the TradeMind AI blog! This blog is built with [Jekyll](https://jekyllrb.com/) and hosted on [GitHub Pages](https://pages.github.com/).

## 🚀 Quick Start

### Local Development

1. Install Ruby and Bundler:
```bash
# macOS
brew install ruby bundler

# Ubuntu/Debian
sudo apt install ruby-full bundler

# Windows
# Download RubyInstaller from https://rubyinstaller.org/
```

2. Install Jekyll dependencies:
```bash
cd docs/blog
bundle install
```

3. Start the development server:
```bash
bundle exec jekyll serve
```

4. Open your browser:
```
http://localhost:4000
```

## 📝 Writing Articles

### Create a New Post

1. Create a new file in `_posts/` with the naming convention:
```
YEAR-MONTH-DAY-title.md
```

Example: `2025-03-28-new-feature.md`

2. Add front matter:
```yaml
---
layout: post
title: "Your Article Title"
date: 2025-03-28 09:00:00 +0000
tags: [Tag1, Tag2]
excerpt: "Brief description of the article"
author: "Your Name"
---
```

3. Write your content in Markdown.

### Front Matter Options

| Field | Required | Description |
|-------|----------|-------------|
| `layout` | Yes | Must be "post" |
| `title` | Yes | Article title |
| `date` | Yes | Publication date |
| `tags` | No | Array of tags |
| `excerpt` | No | Brief description |
| `author` | No | Author name |

## 📂 Directory Structure

```
docs/blog/
├── _config.yml          # Jekyll configuration
├── _includes/           # Reusable components
├── _layouts/            # Page templates
│   ├── default.html    # Default layout
│   └── post.html       # Blog post layout
├── _posts/             # Blog articles
│   ├── 2025-03-28-article1.md
│   └── 2025-03-27-article2.md
├── assets/             # Static files
│   ├── css/           # Custom styles
│   └── img/           # Images
└── index.md           # Blog homepage
```

## 🎨 Customization

### Modify Colors

Edit the color variables in the `<style>` blocks of layouts:

```css
/* Primary color */
--primary: #0066CC;

/* Accent color */
--accent: #0088FF;
```

### Add Custom CSS

1. Create a CSS file in `assets/css/`
2. Add it to your front matter:

```yaml
---
css: /assets/css/custom.css
---
```

## 🚢 Deployment

### Automatic Deployment

The blog is automatically deployed to GitHub Pages when you push to the `main` branch:

1. Make changes to blog files
2. Commit and push:
```bash
git add docs/blog/
git commit -m "Update blog"
git push origin main
```

3. GitHub Actions will build and deploy automatically
4. Your blog will be available at:
```
https://zouksw.github.io/MT/blog/
```

### Manual Deployment

To manually trigger deployment:

1. Go to Actions tab in GitHub
2. Select "Deploy Blog to GitHub Pages"
3. Click "Run workflow"

## 📊 Analytics

### View Site Statistics

GitHub Pages provides built-in analytics:

1. Go to repository Settings
2. Navigate to Pages
3. View traffic statistics

### Add Google Analytics

1. Create a Google Analytics property
2. Add your tracking ID to `_config.yml`:

```yaml
google_analytics: UA-XXXXXXXXX-X
```

## 🔗 Integration with Main Project

The blog is part of the main project documentation:

- **Main Site**: https://zouksw.github.io/MT/
- **Blog**: https://zouksw.github.io/MT/blog/
- **Docs**: https://zouksw.github.io/MT/docs/

## 📝 Content Guidelines

### Article Topics

We welcome articles on:

- New features and releases
- Tutorials and how-to guides
- Best practices and tips
- Case studies and use cases
- Security updates
- Performance optimization

### Writing Style

- Use clear, concise language
- Include code examples where applicable
- Add images and diagrams when helpful
- Write for a technical audience
- Include a call-to-action at the end

### Article Length

- **Short**: 500-800 words (quick tips)
- **Medium**: 800-1500 words (tutorials)
- **Long**: 1500-2500 words (in-depth guides)

## 🤝 Contributing

We welcome blog post contributions! Please:

1. Read our [Contributing Guidelines](../../docs/guides/CONTRIBUTING.md)
2. Check existing posts for style consistency
3. Test locally before submitting
4. Submit a pull request with your article

## 📧 Contact

Questions about the blog? Contact us at:
- **Email**: blog@mt-platform.dev
- **GitHub Discussions**: https://github.com/Zouksw/MT/discussions
- **Issues**: https://github.com/Zouksw/MT/issues

---

**Happy Blogging!** ✨
