---
layout: default
title: MT Blog
---
<!-- Hero Section -->
<div class="hero">
  <div class="hero-content">
    <h1 class="hero-title">MT Blog</h1>
    <p class="hero-subtitle">
      Enterprise time series database platform with AI-powered forecasting and real-time analytics
    </p>
    <div class="hero-buttons">
      <a href="https://github.com/Zouksw/MT" class="btn btn-primary">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-1.664-1.653-2.729-2.756-1.604-1.656-1.604-1.656 3.006 3.006 7.668 3.006 10.337 0 6.037-2.463 10.937-6.557 10.937-1.921 0-3.732-.565-5.252-1.537-.139.25-.293.511-.293.828 0 1.516 3.006 2.729 3.006 2.729 1.729 0 3.231-1.089 3.754-2.619.107-.651.196-1.453.196-2.231 0-1.607-.577-3.194-1.777-4.489-2.026-3.618-3.006-7.668-3.006-10.337 0-6.627 5.373-12 12-12z"/>
        </svg>
        Star on GitHub
      </a>
      <a href="/blog/" class="btn btn-secondary">Read Articles</a>
    </div>
  </div>
</div>

<!-- Features Grid -->
<div class="features">
  <div class="feature-card">
    <div class="feature-icon">⚡</div>
    <h3>Lightning Fast</h3>
    <p>Process millions of data points per second with sub-millisecond latency</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🤖</div>
    <h3>AI-Powered</h3>
    <p>Built-in forecasting and anomaly detection powered by machine learning</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">🔒</div>
    <h3>Enterprise Security</h3>
    <p>End-to-end encryption, role-based access control, and audit logs</p>
  </div>
  <div class="feature-card">
    <div class="feature-icon">📊</div>
    <h3>Real-Time Analytics</h3>
    <p>Monitor your data in real-time with interactive dashboards</p>
  </div>
</div>

<!-- Latest Posts -->
<div class="latest-posts">
  <h2>Latest Articles</h2>
  <div class="posts-grid">
    {% for post in site.posts limit:6 %}
      <article class="post-card">
        <div class="post-meta">
          <time datetime="{{ post.date }}">{{ post.date | date: "%B %d, %Y" }}</time>
          <span class="post-tags">
            {% for tag in post.tags %}
              <span class="tag">{{ tag }}</span>
            {% endfor %}
          </span>
        </div>
        <h3 class="post-title">
          <a href="{{ post.url }}">{{ post.title }}</a>
        </h3>
        <p class="post-excerpt">{{ post.excerpt | strip_html | truncate: 150 }}</p>
        <a href="{{ post.url }}" class="read-more">Read More →</a>
      </article>
    {% endfor %}
  </div>
</div>

<!-- Newsletter -->
<div class="newsletter">
  <h2>Stay Updated</h2>
  <p>Get the latest updates, tutorials, and news delivered to your inbox</p>
  <form class="newsletter-form">
    <input type="email" placeholder="Enter your email" required>
    <button type="submit" class="btn btn-primary">Subscribe</button>
  </form>
</div>

<style>
  /* Hero Section */
  .hero {
    background: linear-gradient(135deg, #0066CC 0%, #0088FF 100%);
    color: white;
    padding: 80px 20px;
    text-align: center;
  }

  .hero-content {
    max-width: 800px;
    margin: 0 auto;
  }

  .hero-title {
    font-size: clamp(40px, 6vw, 64px);
    font-weight: 700;
    margin-bottom: 20px;
    line-height: 1.2;
  }

  .hero-subtitle {
    font-size: clamp(18px, 2vw, 24px);
    opacity: 0.95;
    margin-bottom: 40px;
    line-height: 1.6;
  }

  .hero-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s ease;
  }

  .btn-primary {
    background: white;
    color: #0066CC;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid white;
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Features Grid */
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 30px;
    padding: 60px 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .feature-card {
    padding: 30px;
    border-radius: 12px;
    background: white;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transition: transform 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-4px);
  }

  .feature-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .feature-card h3 {
    font-size: 20px;
    margin-bottom: 12px;
    color: #111827;
  }

  .feature-card p {
    color: #64748b;
    line-height: 1.6;
  }

  /* Latest Posts */
  .latest-posts {
    padding: 60px 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .latest-posts h2 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 40px;
    text-align: center;
  }

  .posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 30px;
  }

  .post-card {
    padding: 24px;
    border-radius: 12px;
    background: white;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
  }

  .post-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .post-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    color: #64748b;
  }

  .post-tags {
    display: flex;
    gap: 8px;
  }

  .tag {
    padding: 4px 12px;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 12px;
    color: #0066CC;
  }

  .post-title {
    margin-bottom: 12px;
  }

  .post-title a {
    color: #111827;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }

  .post-title a:hover {
    color: #0066CC;
  }

  .post-excerpt {
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 16px;
  }

  .read-more {
    color: #0066CC;
    text-decoration: none;
    font-weight: 600;
  }

  .read-more:hover {
    text-decoration: underline;
  }

  /* Newsletter */
  .newsletter {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 60px 20px;
    text-align: center;
  }

  .newsletter h2 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .newsletter p {
    font-size: 18px;
    opacity: 0.95;
    margin-bottom: 30px;
  }

  .newsletter-form {
    display: flex;
    gap: 12px;
    max-width: 500px;
    margin: 0 auto;
  }

  .newsletter-form input {
    flex: 1;
    padding: 14px 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
  }

  @media (max-width: 768px) {
    .newsletter-form {
      flex-direction: column;
    }
  }
</style>
