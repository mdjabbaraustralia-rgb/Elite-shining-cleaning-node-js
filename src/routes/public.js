const express = require('express');
const router = express.Router();
const models = require('../lib/models');

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// shared locals every page view needs
router.use((req, res, next) => {
  res.locals.featuresList = models.featuresList;
  res.locals.formatDate = formatDate;
  res.locals.footerServices = models.services.published().map((s) => s.title);
  next();
});

router.get('/', (req, res) => {
  const testimonials = models.testimonials.published();
  const services = models.services.published();

  const rawHeadlines = (() => {
    try {
      const parsed = JSON.parse(require('../lib/settings').get('hero_headlines', ''));
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch (e) {
      return null;
    }
  })() || [
    { words: [{ text: 'Spotless Homes,', color: '#ffffff', underline: false }] },
    { words: [{ text: 'Sparkling', color: '#eab030', underline: true }] },
    { words: [{ text: 'Standards.', color: '#ffffff', underline: false }] },
  ];
  const heroHeadlines = rawHeadlines.map((line) =>
    line.words ? line : { words: [{ text: line.text || '', color: line.color || '#ffffff', underline: !!line.underline }] }
  );

  res.render('home', { testimonials, services, heroHeadlines });
});

router.get('/services', (req, res) => {
  res.render('services', { services: models.services.published() });
});

router.get('/pricing', (req, res) => {
  res.render('pricing', { plans: models.pricingPlans.published() });
});

router.get('/about', (req, res) => {
  res.render('about', {});
});

router.get('/gallery', (req, res) => {
  res.render('gallery', { images: models.galleryImages.published() });
});

router.get('/faq', (req, res) => {
  res.render('faq', { faqs: models.faqs.published() });
});

router.get('/contact', (req, res) => {
  res.render('contact', {});
});

router.get('/testimonials', (req, res) => {
  res.render('testimonials', { testimonials: models.testimonials.published() });
});

router.get('/blog', (req, res) => {
  res.render('blog', { posts: models.blogPosts.published() });
});

router.get('/privacy-policy', (req, res) => {
  res.render('privacy', {});
});

router.get('/terms-conditions', (req, res) => {
  res.render('terms', {});
});

router.get('/sitemap.xml', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  const routes = [
    { url: base + '/', priority: '1.0' },
    { url: base + '/services', priority: '0.9' },
    { url: base + '/pricing', priority: '0.8' },
    { url: base + '/about', priority: '0.8' },
    { url: base + '/gallery', priority: '0.7' },
    { url: base + '/testimonials', priority: '0.7' },
    { url: base + '/blog', priority: '0.7' },
    { url: base + '/faq', priority: '0.6' },
    { url: base + '/contact', priority: '0.9' },
    { url: base + '/privacy-policy', priority: '0.3' },
    { url: base + '/terms-conditions', priority: '0.3' },
  ];
  res.type('application/xml');
  res.render('sitemap', { routes }, (err, html) => {
    if (err) return res.status(500).send('sitemap error');
    res.send(html);
  });
});

module.exports = router;
