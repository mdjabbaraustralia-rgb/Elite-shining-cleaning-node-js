const db = require('./db');

function now() {
  return new Date().toISOString();
}

function boolify(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const f of fields) out[f] = !!out[f];
  return out;
}

function featuresList(featuresText) {
  return String(featuresText || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- generic CRUD factory for the simple "published + ordered" tables ----------
function makeResource(table, boolFields = ['is_published']) {
  return {
    published() {
      return db.prepare(`SELECT * FROM ${table} WHERE is_published = 1 ORDER BY sort_order, id`).all().map((r) => boolify(r, boolFields));
    },
    allOrdered() {
      return db.prepare(`SELECT * FROM ${table} ORDER BY sort_order, id`).all().map((r) => boolify(r, boolFields));
    },
    find(id) {
      return boolify(db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id), boolFields);
    },
    remove(id) {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    },
  };
}

const services = {
  ...makeResource('services'),
  create(data) {
    const stmt = db.prepare(`INSERT INTO services (icon, title, short_description, description, features, badge_text, image, sort_order, is_published, created_at, updated_at)
      VALUES (@icon, @title, @short_description, @description, @features, @badge_text, @image, @sort_order, @is_published, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE services SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({ ...data, id, updated_at: now() });
    return this.find(id);
  },
  featuresList,
};

const galleryImages = {
  ...makeResource('gallery_images'),
  create(data) {
    const stmt = db.prepare(`INSERT INTO gallery_images (image, label, sort_order, is_published, created_at, updated_at)
      VALUES (@image, @label, @sort_order, @is_published, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE gallery_images SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({ ...data, id, updated_at: now() });
    return this.find(id);
  },
};

const blogPosts = {
  ...makeResource('blog_posts'),
  create(data) {
    const stmt = db.prepare(`INSERT INTO blog_posts (title, tag, excerpt, image, published_date, sort_order, is_published, created_at, updated_at)
      VALUES (@title, @tag, @excerpt, @image, @published_date, @sort_order, @is_published, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE blog_posts SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({ ...data, id, updated_at: now() });
    return this.find(id);
  },
};

const testimonials = {
  ...makeResource('testimonials'),
  create(data) {
    const stmt = db.prepare(`INSERT INTO testimonials (name, photo, location, quote, rating, sort_order, is_published, created_at, updated_at)
      VALUES (@name, @photo, @location, @quote, @rating, @sort_order, @is_published, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE testimonials SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({ ...data, id, updated_at: now() });
    return this.find(id);
  },
};

const faqs = {
  ...makeResource('faqs'),
  create(data) {
    const stmt = db.prepare(`INSERT INTO faqs (question, answer, sort_order, is_published, created_at, updated_at)
      VALUES (@question, @answer, @sort_order, @is_published, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE faqs SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({ ...data, id, updated_at: now() });
    return this.find(id);
  },
};

const pricingPlans = {
  ...makeResource('pricing_plans', ['is_published', 'is_popular']),
  create(data) {
    const stmt = db.prepare(`INSERT INTO pricing_plans (name, tagline, features, is_popular, sort_order, is_published, created_at, updated_at)
      VALUES (@name, @tagline, @features, @is_popular, @sort_order, @is_published, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  update(id, data) {
    const fields = Object.keys(data).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE pricing_plans SET ${fields}, updated_at = @updated_at WHERE id = @id`).run({ ...data, id, updated_at: now() });
    return this.find(id);
  },
  featuresList,
};

// ---------- bookings ----------
const bookings = {
  all({ search = '', dateFrom = '', dateTo = '' } = {}) {
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR suburb LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (dateFrom) {
      sql += ' AND date(created_at) >= date(?)';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND date(created_at) <= date(?)';
      params.push(dateTo);
    }
    sql += ' ORDER BY created_at DESC';
    return db.prepare(sql).all(...params);
  },
  find(id) {
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  },
  create(data) {
    const stmt = db.prepare(`INSERT INTO bookings (name, email, phone, suburb, service_type, property_size, frequency, preferred_date, message, status, created_at, updated_at)
      VALUES (@name, @email, @phone, @suburb, @service_type, @property_size, @frequency, @preferred_date, @message, 'new', @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  updateStatus(id, status) {
    db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id);
    return this.find(id);
  },
  remove(id) {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  },
};

// ---------- quotations ----------
function computeQuotationTotals(q) {
  const items = JSON.parse(q.line_items || '[]');
  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);
  let discountAmount = 0;
  if (q.discount_type && q.discount_value) {
    discountAmount = q.discount_type === 'percentage'
      ? Math.round(subtotal * (Number(q.discount_value) / 100) * 100) / 100
      : Math.min(Number(q.discount_value), subtotal);
  }
  const total = Math.round((subtotal - discountAmount) * 100) / 100;
  return { ...q, line_items: items, subtotal, discount_amount: discountAmount, total };
}

const quotations = {
  all() {
    return db.prepare('SELECT * FROM quotations ORDER BY created_at DESC').all().map(computeQuotationTotals);
  },
  find(id) {
    const row = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
    return row ? computeQuotationTotals(row) : null;
  },
  create(data) {
    const stmt = db.prepare(`INSERT INTO quotations (quote_number, booking_id, client_name, client_email, client_phone, client_address, service_type, line_items, discount_type, discount_value, notes, valid_until, created_at, updated_at)
      VALUES (@quote_number, @booking_id, @client_name, @client_email, @client_phone, @client_address, @service_type, @line_items, @discount_type, @discount_value, @notes, @valid_until, @created_at, @updated_at)`);
    const info = stmt.run({ ...data, created_at: now(), updated_at: now() });
    return this.find(info.lastInsertRowid);
  },
  remove(id) {
    db.prepare('DELETE FROM quotations WHERE id = ?').run(id);
  },
  generateQuoteNumber() {
    const last = db.prepare('SELECT quote_number FROM quotations ORDER BY id DESC LIMIT 1').get();
    const lastNum = last ? parseInt(String(last.quote_number).replace(/\D/g, ''), 10) : 1000;
    return `Q-${lastNum + 1}`;
  },
};

// ---------- users (admin auth) ----------
const users = {
  findByName(name) {
    return db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  },
  find(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
};

module.exports = {
  services,
  galleryImages,
  blogPosts,
  testimonials,
  faqs,
  pricingPlans,
  bookings,
  quotations,
  users,
  featuresList,
};
