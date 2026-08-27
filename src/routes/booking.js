const express = require('express');
const router = express.Router();
const models = require('../lib/models');

function validateBooking(body) {
  const errors = {};
  const data = {};

  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  data.name = str(body.name);
  if (!data.name) errors.name = 'Full name is required.';
  else if (data.name.length > 120) errors.name = 'Full name is too long.';

  data.email = str(body.email);
  if (!data.email) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Please enter a valid email address.';

  data.phone = str(body.phone);
  if (!data.phone) errors.phone = 'Phone number is required.';

  data.suburb = str(body.suburb);
  if (!data.suburb) errors.suburb = 'Suburb is required.';

  data.service_type = str(body.service_type);
  if (!data.service_type) errors.service_type = 'Please select a service.';

  data.property_size = str(body.property_size) || null;
  data.frequency = str(body.frequency) || null;
  data.preferred_date = str(body.preferred_date) || null;
  data.message = str(body.message) || null;

  return { data, errors, valid: Object.keys(errors).length === 0 };
}

router.post('/booking', (req, res) => {
  const { data, errors, valid } = validateBooking(req.body);

  if (!valid) {
    req.flash('errors', errors);
    req.flash('old', req.body);
    return res.redirect(req.get('Referer') || '/');
  }

  models.bookings.create(data);

  req.flash('success', "Thanks! Your quote request has been received — our team will call you within one business hour.");
  res.redirect(req.get('Referer') || '/');
});

module.exports = router;
