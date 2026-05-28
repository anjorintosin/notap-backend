import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

export const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().trim().min(1).required(),
  companyName: Joi.string().trim().min(1).required(),
  companyType: Joi.string().valid('local_partner', 'partner', 'acquirer').required(),
  registrationNumber: Joi.string().trim().min(1).required(),
  sector: Joi.string().trim().min(1).required(),
  address: Joi.string().trim().min(1).required(),
  contactPhone: Joi.string().trim().min(1).required(),
  inviteToken: Joi.string().optional(),
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const setPasswordSchema = Joi.object({
  password: Joi.string().min(8).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  token: Joi.string().required(),
});
