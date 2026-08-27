const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const router = express.Router();

const models = require('../lib/models');
const settings = require('../lib/settings');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { storeOptimizedImage, deleteOldUpload } = require('../lib/uploads');
const { renderQuotationPdf } = require('../lib/quotationPdf');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function boolField(v) {
  return v === '1' || v === 'on' || v === true;
}

// Wraps an async route handler so a thrown/rejected error is forwarded to
// Express's error handler instead of crashing the whole process.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Returns the list of missing/blank required fields (Laravel-style "required" check).
function missingFields(body, fields) {
  return fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
}

// Flashes a friendly validation error and redirects back to the given page.
function failValidation(req, res, redirectTo, message) {
  req.flash('errors', { _general: message });
  req.flash('old', req.body);
  res.redirect(redirectTo);
}

// ---------------- AUTH ----------------
router.get('/login', requireGuest, (req, res) => {
  res.render('admin/login', { error: req.flash('loginError')[0] || null });
});

router.post('/login', requireGuest, (req, res) => {
  const { name, password } = req.body;
  const user = models.users.findByName(name || '');
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    req.flash('loginError', 'Those credentials do not match our records.');
    req.flash('old', { name });
    return res.redirect('/admin/login');
  }
  req.session.admin = { id: user.id, name: user.name };
  const redirectTo = req.session.intendedUrl || '/admin';
  delete req.session.intendedUrl;
  res.redirect(redirectTo);
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(requireAuth);

// ---------------- DASHBOARD ----------------
router.get('/', (req, res) => {
  const all = models.bookings.all();
  const stats = {
    total: all.length,
    new: all.filter((b) => b.status === 'new').length,
    contacted: all.filter((b) => b.status === 'contacted').length,
    completed: all.filter((b) => b.status === 'completed').length,
  };
  const recent = all.slice(0, 5);
  res.render('admin/dashboard', { stats, recent });
});

// ---------------- BOOKINGS (Quote Requests) ----------------
router.get('/bookings', (req, res) => {
  const bookings = models.bookings.all({
    search: req.query.q || '',
    dateFrom: req.query.date_from || '',
    dateTo: req.query.date_to || '',
  }).filter((b) => !req.query.status || b.status === req.query.status);
  res.render('admin/bookings/index', { bookings, query: req.query });
});

router.get('/bookings/:id', (req, res) => {
  const booking = models.bookings.find(req.params.id);
  if (!booking) return res.status(404).send('Not found');
  res.render('admin/bookings/show', { booking });
});

router.post('/bookings/:id/status', (req, res) => {
  models.bookings.updateStatus(req.params.id, req.body.status);
  req.flash('success', 'Status updated.');
  res.redirect(`/admin/bookings/${req.params.id}`);
});

router.post('/bookings/:id', (req, res) => {
  if (req.body._method === 'DELETE') {
    models.bookings.remove(req.params.id);
    req.flash('success', 'Quote request deleted.');
    return res.redirect('/admin/bookings');
  }
  res.status(405).send('Method not allowed');
});

// ---------------- SETTINGS ----------------
router.get('/settings', (req, res) => {
  const keys = [
    'business_name', 'phone', 'email', 'address', 'business_hours', 'announcement_text', 'abn',
    'facebook_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'tiktok_url', 'twitter_url',
    'facebook_enabled', 'instagram_enabled', 'linkedin_enabled', 'youtube_enabled', 'tiktok_enabled', 'twitter_enabled',
    'footer_tagline', 'footer_service_areas', 'hero_subtitle', 'banner_image', 'site_logo', 'site_logo_white',
    'service_area_image', 'about_title', 'about_subtitle', 'about_story_heading', 'about_story_para1', 'about_story_para2',
    'about_team_photo', 'about_stat_1_num', 'about_stat_1_label', 'about_stat_2_num', 'about_stat_2_label',
    'about_stat_3_num', 'about_stat_3_label', 'about_stat_4_num', 'about_stat_4_label',
  ];
  const settingsData = {};
  keys.forEach((k) => { settingsData[k] = settings.get(k); });

  let rawHeadlines;
  try {
    rawHeadlines = JSON.parse(settings.get('hero_headlines', '')) || null;
  } catch (e) {
    rawHeadlines = null;
  }
  if (!rawHeadlines || !rawHeadlines.length) {
    rawHeadlines = [
      { words: [{ text: 'Spotless Homes,', color: '#ffffff', underline: false }] },
      { words: [{ text: 'Sparkling', color: '#eab030', underline: true }] },
      { words: [{ text: 'Standards.', color: '#ffffff', underline: false }] },
    ];
  }
  const heroHeadlines = rawHeadlines.map((line) =>
    line.words ? line : { words: [{ text: line.text || '', color: line.color || '#ffffff', underline: !!line.underline }] }
  );

  res.render('admin/settings/edit', { settings: settingsData, heroHeadlines });
});

router.post('/settings', upload.fields([
  { name: 'banner_image', maxCount: 1 },
  { name: 'site_logo', maxCount: 1 },
  { name: 'site_logo_white', maxCount: 1 },
  { name: 'service_area_image', maxCount: 1 },
  { name: 'about_team_photo', maxCount: 1 },
]), asyncHandler(async (req, res) => {
  const body = req.body;
  const simpleKeys = [
    'business_name', 'phone', 'email', 'address', 'business_hours', 'announcement_text', 'abn',
    'facebook_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'tiktok_url', 'twitter_url',
    'footer_tagline', 'footer_service_areas', 'hero_subtitle',
    'about_title', 'about_subtitle', 'about_story_heading', 'about_story_para1', 'about_story_para2',
    'about_stat_1_num', 'about_stat_1_label', 'about_stat_2_num', 'about_stat_2_label',
    'about_stat_3_num', 'about_stat_3_label', 'about_stat_4_num', 'about_stat_4_label',
  ];
  // Only overwrite a key if it was actually present in the submission — an
  // admin clearing a field on purpose sends it as an empty string (still
  // written), but a key missing entirely (partial/malformed request) leaves
  // the existing value untouched instead of silently blanking real content.
  simpleKeys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(body, k)) settings.set(k, body[k]);
  });

  ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'twitter'].forEach((platform) => {
    settings.set(`${platform}_enabled`, boolField(body[`${platform}_enabled`]) ? '1' : '0');
  });

  // headline words -> hero_headlines JSON
  // Note: headline_word_underline is deliberately keyed as a flat "i_j" string
  // (not nested "[i][j]") because unchecked boxes don't submit at all, and
  // qs silently compacts sparse nested-array indices — e.g. only line 1's box
  // checked would parse as index 0, corrupting which word gets the underline.
  // A flat key has no array to compact, so this is immune to that.
  const wordText = body.headline_word_text || {};
  const wordColor = body.headline_word_color || {};
  const wordUnderline = body.headline_word_underline || {};
  const lines = Object.keys(wordText).sort((a, b) => a - b).map((i) => {
    const words = wordText[i] || {};
    return {
      words: Object.keys(words).sort((a, b) => a - b).map((j) => ({
        text: words[j],
        color: (wordColor[i] && wordColor[i][j]) || '#ffffff',
        underline: !!wordUnderline[`${i}_${j}`],
      })),
    };
  });
  if (lines.length) settings.set('hero_headlines', JSON.stringify(lines));

  const files = req.files || {};
  const imageFields = [
    ['banner_image', 'banner', { maxWidth: 1920, quality: 78 }],
    ['site_logo', 'logo', { maxWidth: 600, preserveTransparency: true }],
    ['site_logo_white', 'logo', { maxWidth: 600, preserveTransparency: true }],
    ['service_area_image', 'service-area', { maxWidth: 1920, quality: 78 }],
    ['about_team_photo', 'team', { maxWidth: 1200, quality: 82 }],
  ];
  for (const [field, dir, opts] of imageFields) {
    if (files[field] && files[field][0]) {
      const optimized = await storeOptimizedImage(files[field][0].buffer, dir, opts);
      deleteOldUpload(settings.get(field));
      settings.set(field, optimized);
    }
  }

  req.flash('success', 'Settings updated successfully.');
  res.redirect('/admin/settings');
}));

// ================= SERVICES =================
router.get('/services', (req, res) => res.render('admin/services/index', { services: models.services.allOrdered() }));
router.get('/services/create', (req, res) => res.render('admin/services/create', {}));
router.get('/services/:id/edit', (req, res) => {
  const service = models.services.find(req.params.id);
  if (!service) return res.status(404).send('Not found');
  res.render('admin/services/edit', { service });
});
const SERVICE_REQUIRED = ['title', 'short_description', 'description'];

router.post('/services', upload.single('image_upload'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (missingFields(b, SERVICE_REQUIRED).length) {
    return failValidation(req, res, '/admin/services/create', 'Title, short description and description are required.');
  }
  const data = {
    icon: b.icon || '', title: b.title, short_description: b.short_description, description: b.description,
    features: b.features || '', badge_text: b.badge_text || '', image: null,
    sort_order: parseInt(b.sort_order || '0', 10), is_published: boolField(b.is_published) ? 1 : 0,
  };
  if (req.file) data.image = await storeOptimizedImage(req.file.buffer, 'services', { maxWidth: 1200, quality: 80 });
  models.services.create(data);
  req.flash('success', 'Service added.');
  res.redirect('/admin/services');
}));
router.post('/services/:id', upload.single('image_upload'), asyncHandler(async (req, res, next) => {
  if (req.body._method !== 'PUT') return next();
  const b = req.body;
  const service = models.services.find(req.params.id);
  if (!service) return res.status(404).send('Not found');
  if (missingFields(b, SERVICE_REQUIRED).length) {
    return failValidation(req, res, `/admin/services/${req.params.id}/edit`, 'Title, short description and description are required.');
  }
  const data = {
    icon: b.icon || '', title: b.title, short_description: b.short_description, description: b.description,
    features: b.features || '', badge_text: b.badge_text || '',
    sort_order: parseInt(b.sort_order || '0', 10), is_published: boolField(b.is_published) ? 1 : 0,
  };
  if (req.file) {
    data.image = await storeOptimizedImage(req.file.buffer, 'services', { maxWidth: 1200, quality: 80 });
    deleteOldUpload(service.image);
  }
  models.services.update(req.params.id, data);
  req.flash('success', 'Service updated.');
  res.redirect('/admin/services');
}));
router.post('/services/:id', (req, res) => {
  if (req.body._method !== 'DELETE') return res.status(405).send('Method not allowed');
  const service = models.services.find(req.params.id);
  if (service) deleteOldUpload(service.image);
  models.services.remove(req.params.id);
  req.flash('success', 'Service deleted.');
  res.redirect('/admin/services');
});

// ================= GALLERY =================
router.get('/gallery', (req, res) => res.render('admin/gallery/index', { images: models.galleryImages.allOrdered() }));
router.get('/gallery/create', (req, res) => res.render('admin/gallery/create', {}));
router.get('/gallery/:id/edit', (req, res) => {
  const image = models.galleryImages.find(req.params.id);
  if (!image) return res.status(404).send('Not found');
  res.render('admin/gallery/edit', { image });
});
router.post('/gallery', upload.single('image_upload'), asyncHandler(async (req, res) => {
  const b = req.body;
  const missing = missingFields(b, ['label']);
  if (missing.length) return failValidation(req, res, '/admin/gallery/create', 'Label is required.');
  if (!req.file) return failValidation(req, res, '/admin/gallery/create', 'An image is required.');
  const image = await storeOptimizedImage(req.file.buffer, 'gallery', { maxWidth: 1600, quality: 80 });
  models.galleryImages.create({
    label: b.label, image, sort_order: parseInt(b.sort_order || '0', 10), is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'Image added.');
  res.redirect('/admin/gallery');
}));
router.post('/gallery/:id', upload.single('image_upload'), asyncHandler(async (req, res, next) => {
  if (req.body._method !== 'PUT') return next();
  const b = req.body;
  const image = models.galleryImages.find(req.params.id);
  if (!image) return res.status(404).send('Not found');
  const missing = missingFields(b, ['label']);
  if (missing.length) return failValidation(req, res, `/admin/gallery/${req.params.id}/edit`, 'Label is required.');
  const data = { label: b.label, sort_order: parseInt(b.sort_order || '0', 10), is_published: boolField(b.is_published) ? 1 : 0 };
  if (req.file) {
    data.image = await storeOptimizedImage(req.file.buffer, 'gallery', { maxWidth: 1600, quality: 80 });
    deleteOldUpload(image.image);
  }
  models.galleryImages.update(req.params.id, data);
  req.flash('success', 'Image updated.');
  res.redirect('/admin/gallery');
}));
router.post('/gallery/:id', (req, res) => {
  if (req.body._method !== 'DELETE') return res.status(405).send('Method not allowed');
  const image = models.galleryImages.find(req.params.id);
  if (image) deleteOldUpload(image.image);
  models.galleryImages.remove(req.params.id);
  req.flash('success', 'Image deleted.');
  res.redirect('/admin/gallery');
});

// ================= BLOG =================
router.get('/blog', (req, res) => res.render('admin/blog/index', { posts: models.blogPosts.allOrdered() }));
router.get('/blog/create', (req, res) => res.render('admin/blog/create', {}));
router.get('/blog/:id/edit', (req, res) => {
  const post = models.blogPosts.find(req.params.id);
  if (!post) return res.status(404).send('Not found');
  res.render('admin/blog/edit', { post });
});
router.post('/blog', upload.single('image_upload'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (missingFields(b, ['title', 'excerpt']).length) {
    return failValidation(req, res, '/admin/blog/create', 'Title and excerpt are required.');
  }
  const image = req.file ? await storeOptimizedImage(req.file.buffer, 'blog', { maxWidth: 1200, quality: 80 }) : null;
  models.blogPosts.create({
    title: b.title, tag: b.tag || '', excerpt: b.excerpt, image,
    published_date: b.published_date || null, sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'Blog post added.');
  res.redirect('/admin/blog');
}));
router.post('/blog/:id', upload.single('image_upload'), asyncHandler(async (req, res, next) => {
  if (req.body._method !== 'PUT') return next();
  const b = req.body;
  const post = models.blogPosts.find(req.params.id);
  if (!post) return res.status(404).send('Not found');
  if (missingFields(b, ['title', 'excerpt']).length) {
    return failValidation(req, res, `/admin/blog/${req.params.id}/edit`, 'Title and excerpt are required.');
  }
  const data = {
    title: b.title, tag: b.tag || '', excerpt: b.excerpt,
    published_date: b.published_date || null, sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  };
  if (req.file) {
    data.image = await storeOptimizedImage(req.file.buffer, 'blog', { maxWidth: 1200, quality: 80 });
    deleteOldUpload(post.image);
  }
  models.blogPosts.update(req.params.id, data);
  req.flash('success', 'Blog post updated.');
  res.redirect('/admin/blog');
}));
router.post('/blog/:id', (req, res) => {
  if (req.body._method !== 'DELETE') return res.status(405).send('Method not allowed');
  const post = models.blogPosts.find(req.params.id);
  if (post) deleteOldUpload(post.image);
  models.blogPosts.remove(req.params.id);
  req.flash('success', 'Blog post deleted.');
  res.redirect('/admin/blog');
});

// ================= TESTIMONIALS =================
router.get('/testimonials', (req, res) => res.render('admin/testimonials/index', { testimonials: models.testimonials.allOrdered() }));
router.get('/testimonials/create', (req, res) => res.render('admin/testimonials/create', {}));
router.get('/testimonials/:id/edit', (req, res) => {
  const testimonial = models.testimonials.find(req.params.id);
  if (!testimonial) return res.status(404).send('Not found');
  res.render('admin/testimonials/edit', { testimonial });
});
function clampRating(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 5;
  return Math.min(5, Math.max(1, n));
}

router.post('/testimonials', upload.single('photo_upload'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (missingFields(b, ['name', 'location', 'quote']).length) {
    return failValidation(req, res, '/admin/testimonials/create', 'Name, location and quote are required.');
  }
  const photo = req.file ? await storeOptimizedImage(req.file.buffer, 'testimonials', { maxWidth: 500, quality: 82 }) : null;
  models.testimonials.create({
    name: b.name, location: b.location, quote: b.quote, photo,
    rating: clampRating(b.rating), sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'Testimonial added.');
  res.redirect('/admin/testimonials');
}));
router.post('/testimonials/:id', upload.single('photo_upload'), asyncHandler(async (req, res, next) => {
  if (req.body._method !== 'PUT') return next();
  const b = req.body;
  const testimonial = models.testimonials.find(req.params.id);
  if (!testimonial) return res.status(404).send('Not found');
  if (missingFields(b, ['name', 'location', 'quote']).length) {
    return failValidation(req, res, `/admin/testimonials/${req.params.id}/edit`, 'Name, location and quote are required.');
  }
  const data = {
    name: b.name, location: b.location, quote: b.quote,
    rating: clampRating(b.rating), sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  };
  if (req.file) {
    data.photo = await storeOptimizedImage(req.file.buffer, 'testimonials', { maxWidth: 500, quality: 82 });
    deleteOldUpload(testimonial.photo);
  }
  models.testimonials.update(req.params.id, data);
  req.flash('success', 'Testimonial updated.');
  res.redirect('/admin/testimonials');
}));
router.post('/testimonials/:id', (req, res) => {
  if (req.body._method !== 'DELETE') return res.status(405).send('Method not allowed');
  const testimonial = models.testimonials.find(req.params.id);
  if (testimonial) deleteOldUpload(testimonial.photo);
  models.testimonials.remove(req.params.id);
  req.flash('success', 'Testimonial deleted.');
  res.redirect('/admin/testimonials');
});

// ================= FAQs =================
router.get('/faqs', (req, res) => res.render('admin/faqs/index', { faqs: models.faqs.allOrdered() }));
router.get('/faqs/create', (req, res) => res.render('admin/faqs/create', {}));
router.get('/faqs/:id/edit', (req, res) => {
  const faq = models.faqs.find(req.params.id);
  if (!faq) return res.status(404).send('Not found');
  res.render('admin/faqs/edit', { faq });
});
router.post('/faqs', (req, res) => {
  const b = req.body;
  if (missingFields(b, ['question', 'answer']).length) {
    return failValidation(req, res, '/admin/faqs/create', 'Question and answer are required.');
  }
  models.faqs.create({
    question: b.question, answer: b.answer, sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'FAQ added.');
  res.redirect('/admin/faqs');
});
router.post('/faqs/:id', (req, res, next) => {
  if (req.body._method !== 'PUT') return next();
  const b = req.body;
  if (!models.faqs.find(req.params.id)) return res.status(404).send('Not found');
  if (missingFields(b, ['question', 'answer']).length) {
    return failValidation(req, res, `/admin/faqs/${req.params.id}/edit`, 'Question and answer are required.');
  }
  models.faqs.update(req.params.id, {
    question: b.question, answer: b.answer, sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'FAQ updated.');
  res.redirect('/admin/faqs');
});
router.post('/faqs/:id', (req, res) => {
  if (req.body._method !== 'DELETE') return res.status(405).send('Method not allowed');
  models.faqs.remove(req.params.id);
  req.flash('success', 'FAQ deleted.');
  res.redirect('/admin/faqs');
});

// ================= PRICING PLANS =================
router.get('/pricing-plans', (req, res) => res.render('admin/pricing-plans/index', { plans: models.pricingPlans.allOrdered() }));
router.get('/pricing-plans/create', (req, res) => res.render('admin/pricing-plans/create', {}));
router.get('/pricing-plans/:id/edit', (req, res) => {
  const plan = models.pricingPlans.find(req.params.id);
  if (!plan) return res.status(404).send('Not found');
  res.render('admin/pricing-plans/edit', { plan });
});
router.post('/pricing-plans', (req, res) => {
  const b = req.body;
  if (missingFields(b, ['name', 'tagline']).length) {
    return failValidation(req, res, '/admin/pricing-plans/create', 'Plan name and tagline are required.');
  }
  models.pricingPlans.create({
    name: b.name, tagline: b.tagline, features: b.features || '',
    is_popular: boolField(b.is_popular) ? 1 : 0, sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'Pricing plan added.');
  res.redirect('/admin/pricing-plans');
});
router.post('/pricing-plans/:id', (req, res, next) => {
  if (req.body._method !== 'PUT') return next();
  const b = req.body;
  if (!models.pricingPlans.find(req.params.id)) return res.status(404).send('Not found');
  if (missingFields(b, ['name', 'tagline']).length) {
    return failValidation(req, res, `/admin/pricing-plans/${req.params.id}/edit`, 'Plan name and tagline are required.');
  }
  models.pricingPlans.update(req.params.id, {
    name: b.name, tagline: b.tagline, features: b.features || '',
    is_popular: boolField(b.is_popular) ? 1 : 0, sort_order: parseInt(b.sort_order || '0', 10),
    is_published: boolField(b.is_published) ? 1 : 0,
  });
  req.flash('success', 'Pricing plan updated.');
  res.redirect('/admin/pricing-plans');
});
router.post('/pricing-plans/:id', (req, res) => {
  if (req.body._method !== 'DELETE') return res.status(405).send('Method not allowed');
  models.pricingPlans.remove(req.params.id);
  req.flash('success', 'Pricing plan deleted.');
  res.redirect('/admin/pricing-plans');
});

// ================= QUOTATIONS =================
router.get('/quotations', (req, res) => {
  res.render('admin/quotations/index', { quotations: models.quotations.all() });
});

router.get('/quotations/create', (req, res) => {
  const booking = req.query.booking_id ? models.bookings.find(req.query.booking_id) : null;
  const quoteNumber = models.quotations.generateQuoteNumber();
  const defaultValidUntil = new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10);
  res.render('admin/quotations/create', { booking, quoteNumber, defaultValidUntil });
});

router.post('/quotations', (req, res) => {
  const b = req.body;

  if (missingFields(b, ['quote_number', 'client_name']).length) {
    return failValidation(req, res, '/admin/quotations/create', 'Quote number and client name are required.');
  }

  const descriptions = b.item_description === undefined ? [] : (Array.isArray(b.item_description) ? b.item_description : [b.item_description]);
  const quantities = Array.isArray(b.item_quantity) ? b.item_quantity : [b.item_quantity];
  const prices = Array.isArray(b.item_price) ? b.item_price : [b.item_price];
  const lineItems = descriptions
    .map((desc, i) => ({ description: desc, quantity: Number(quantities[i]), unit_price: Number(prices[i]) }))
    .filter((item) => item.description && String(item.description).trim() && !Number.isNaN(item.quantity) && !Number.isNaN(item.unit_price));

  if (!lineItems.length) {
    return failValidation(req, res, '/admin/quotations/create', 'At least one valid line item (description, quantity, price) is required.');
  }

  const existing = models.quotations.all().find((q) => q.quote_number === b.quote_number);
  if (existing) {
    return failValidation(req, res, '/admin/quotations/create', `Quote number "${b.quote_number}" is already in use — please use a different number.`);
  }

  const quotation = models.quotations.create({
    quote_number: b.quote_number,
    booking_id: b.booking_id || null,
    client_name: b.client_name,
    client_email: b.client_email || null,
    client_phone: b.client_phone || null,
    client_address: b.client_address || null,
    service_type: b.service_type || null,
    discount_type: b.discount_type || null,
    discount_value: b.discount_type ? Number(b.discount_value || 0) : null,
    notes: b.notes || null,
    valid_until: b.valid_until || null,
    line_items: JSON.stringify(lineItems),
  });

  res.redirect(`/admin/quotations/${quotation.id}/pdf`);
});

router.post('/quotations/:id', (req, res) => {
  if (req.body._method === 'DELETE') {
    models.quotations.remove(req.params.id);
    req.flash('success', 'Quotation deleted.');
    return res.redirect('/admin/quotations');
  }
  res.status(405).send('Method not allowed');
});

router.get('/quotations/:id/pdf', (req, res) => {
  const quotation = models.quotations.find(req.params.id);
  if (!quotation) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${quotation.quote_number}.pdf"`);
  renderQuotationPdf(quotation, res);
});

router.get('/quotations/:id/download', (req, res) => {
  const quotation = models.quotations.find(req.params.id);
  if (!quotation) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quotation.quote_number}.pdf"`);
  renderQuotationPdf(quotation, res);
});

module.exports = router;
