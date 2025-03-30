import * as nodemailer from 'nodemailer';
import { Request, Response } from 'express';

import { check, sanitize, validationResult } from 'express-validator';

const transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: process.env.SENDGRID_USER,
    pass: process.env.SENDGRID_PASSWORD
  }
});

/**
 * GET /contact
 * Contact form page.
 */
export let getContact = (req: Request, res: Response) => {
  res.render('contact', {
    title: 'Contact'
  });
};

/**
 * POST /contact
 * Send a contact form via Nodemailer.
 */
export let postContact = async (req: Request, res: Response) => { 
  await check('name', 'Name cannot be blank').not().isEmpty().run(req);
  await check('email', 'Email is not valid').isEmail().run(req);
  await check('message', 'Message cannot be blank').not().isEmpty().run(req);
  await sanitize('email').normalizeEmail({ gmail_remove_dots: false }).run(req);

  const result = validationResult(req);

  if (!result.isEmpty()) {
    req.flash('errors', result.array());
    return res.redirect('/contact');
  }

  const mailOptions = {
    to: 'your@email.com',
    from: `${req.body.name} <${req.body.email}>`,
    subject: 'Contact Form',
    text: req.body.message
  };

  transporter.sendMail(mailOptions, (err: { message: any; }) => {
    if (err) {
      req.flash('errors', { msg: err.message });
      return res.redirect('/contact');
    }
    req.flash('success', { msg: 'Email has been sent successfully!' });
    res.redirect('/contact');
  });
};
