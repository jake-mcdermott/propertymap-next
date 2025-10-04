/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: process.env.SITE_URL || 'https://www.propertymap.ie',
    generateRobotsTxt: true,          // also generates /robots.txt
    changefreq: 'daily',
    priority: 0.7,
    sitemapSize: 7000,                // split if you have lots of URLs
    exclude: [
      '/admin/*',
      '/api/*',
    ],
    // If you have dynamic listings pages:
    additionalSitemaps: [
      // You can generate extra sitemaps programmatically and list them here
      // 'https://www.propertymap.ie/sitemaps/sitemap-listings.xml',
    ],
    // Optional: transform each URL
    transform: async (config, url) => {
      return {
        loc: url,
        changefreq: config.changefreq,
        priority: url === '/' ? 1.0 : config.priority,
        lastmod: new Date().toISOString(),
        alternateRefs: [], // hreflang if you have locales
      };
    },
  };
  